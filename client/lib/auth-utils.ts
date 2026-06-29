const ACCESS_KEY = 'peerly_access_token';
const REFRESH_KEY = 'peerly_refresh_token';
const COOKIE_OPTS = 'path=/; max-age=86400; SameSite=Lax';

export function setTokens(accessToken: string, refreshToken: string): void {
  if (!accessToken || !refreshToken) {
    throw new TypeError('setTokens: both accessToken and refreshToken must be non-empty');
  }
  if (typeof window === 'undefined') return;
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
  document.cookie = `${ACCESS_KEY}=${accessToken}; ${COOKIE_OPTS}`;
  document.cookie = `${REFRESH_KEY}=${refreshToken}; ${COOKIE_OPTS}`;
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY) || null;
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY) || null;
}

export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  document.cookie = `${ACCESS_KEY}=; path=/; max-age=0`;
  document.cookie = `${REFRESH_KEY}=; path=/; max-age=0`;
}

export function isAuthenticated(): boolean {
  return !!(getAccessToken() && getRefreshToken());
}
