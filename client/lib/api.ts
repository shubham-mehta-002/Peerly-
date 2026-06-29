import axios, { AxiosRequestConfig } from 'axios';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth-utils';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// --- Refresh queue state (module-level, not React state) ---
let isRefreshing = false;
type QueueEntry = { resolve: (token: string) => void; reject: (err: unknown) => void };
const refreshQueue: QueueEntry[] = [];

// Helper to flush the queue after a successful refresh
function flushQueue(token: string) {
  refreshQueue.forEach(entry => entry.resolve(token));
  refreshQueue.length = 0;
}

// Helper to reject all queued entries on refresh failure
function rejectQueue(err: unknown) {
  refreshQueue.forEach(entry => entry.reject(err));
  refreshQueue.length = 0;
}

// --- Request interceptor: attach access token ---
api.interceptors.request.use(config => {
  if (typeof window === 'undefined') {
    return config;
  }
  const token = getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// --- Response interceptor: refresh-queue on 401 ---
api.interceptors.response.use(
  res => res,
  async (err) => {
    // 1. Pass through non-401 errors unchanged
    if (err.response?.status !== 401) {
      return Promise.reject(err);
    }

    const config = err.config as AxiosRequestConfig & { __retried?: boolean };

    // 2. Auth routes themselves must never trigger a refresh
    if (config?.url?.startsWith('/api/auth/')) {
      return Promise.reject(err);
    }

    // 3. No refresh token available → clear and redirect
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearTokens();
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      return Promise.reject(err);
    }

    // 4. Already retried this request → prevent infinite loop
    if (config?.__retried) {
      return Promise.reject(err);
    }

    // 5. Another refresh is already in flight → queue this request
    if (isRefreshing) {
      return new Promise<unknown>((resolve, reject) => {
        refreshQueue.push({
          resolve: (newToken: string) => {
            if (config.headers) {
              config.headers.Authorization = `Bearer ${newToken}`;
            } else {
              config.headers = { Authorization: `Bearer ${newToken}` };
            }
            config.__retried = true;
            resolve(api(config));
          },
          reject,
        });
      });
    }

    // 6. Kick off the token refresh
    isRefreshing = true;

    try {
      const { data } = await api.post<{ accessToken: string; refreshToken: string }>(
        '/api/auth/refresh-token',
        { refreshToken }
      );

      setTokens(data.accessToken, data.refreshToken);

      // Flush queued requests with the new token
      flushQueue(data.accessToken);

      // Retry the original request
      config.__retried = true;
      if (config.headers) {
        config.headers.Authorization = `Bearer ${data.accessToken}`;
      } else {
        config.headers = { Authorization: `Bearer ${data.accessToken}` };
      }
      return api(config);
    } catch (refreshErr) {
      clearTokens();
      rejectQueue(refreshErr);
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/login';
      }
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
