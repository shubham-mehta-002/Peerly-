'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { setTokens, clearTokens, getRefreshToken } from '@/lib/auth-utils';
import { disconnectSocket } from '@/lib/socket';

export interface MeResponse {
  id: string;
  email: string;
  is_admin: boolean;
  created_at: string;
  profile: {
    name: string | null;
    username: string | null;
    bio: string | null;
    campus_id: string | null;
    onboarding_completed: boolean;
    avatar_url: string | null;
    updated_at: string;
  } | null;
}

export function useMe() {
  return useQuery<MeResponse>({
    queryKey: ['me'],
    queryFn: () => api.get('/api/auth/me').then(r => r.data),
    retry: false,
    staleTime: 5 * 60_000,
  });
}

export function useLogin() {
  const router = useRouter();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api.post<{ accessToken: string; refreshToken: string; onboarding_completed: boolean }>('/api/auth/login', body).then(r => r.data),
    onSuccess: data => {
      setTokens(data.accessToken, data.refreshToken);
      qc.invalidateQueries({ queryKey: ['me'] });
      router.push(data.onboarding_completed ? '/feed' : '/onboarding');
    },
  });
}

export function useRegister() {
  return useMutation({
    mutationFn: (body: { email: string; password: string }) =>
      api.post<{ email: string; pending_verification: true }>('/api/auth/register', body).then(r => r.data),
  });
}

export function useVerifyEmail() {
  const router = useRouter();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (body: { email: string; otp: string }) =>
      api.post<{ accessToken: string; refreshToken: string; onboarding_completed: boolean }>('/api/auth/verify-email', body).then(r => r.data),
    onSuccess: data => {
      setTokens(data.accessToken, data.refreshToken);
      qc.invalidateQueries({ queryKey: ['me'] });
      router.push('/onboarding');
    },
  });
}

export function useResendOTP() {
  return useMutation({
    mutationFn: (email: string) =>
      api.post('/api/auth/send-otp', { email }).then(r => r.data),
  });
}

export function useGoogleAuth() {
  // Google OAuth is not yet implemented on the backend.
  // This is a placeholder to avoid import errors in existing code.
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (_idToken: string): Promise<{ accessToken: string; refreshToken: string; onboarding_completed: boolean }> => {
      return Promise.reject(new Error('Google auth is not yet supported'));
    },
    onSuccess: (data) => {
      setTokens(data.accessToken, data.refreshToken);
      qc.invalidateQueries({ queryKey: ['me'] });
      router.push(data.onboarding_completed ? '/feed' : '/onboarding');
    },
  });
}

export interface DomainCheckResult {
  status: 'active' | 'inactive' | 'not_found' | 'invalid';
  domain: string;
  college_name?: string | null;
}

export function useCheckDomain() {
  return useMutation({
    mutationFn: (email: string) =>
      api.get<DomainCheckResult>(`/api/auth/check-domain?email=${encodeURIComponent(email)}`).then(r => r.data),
  });
}

export function useLogout() {
  const router = useRouter();
  const qc = useQueryClient();

  return async () => {
    disconnectSocket();
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) {
        await api.post('/api/auth/logout', { refreshToken });
      }
    } catch {
      // fire-and-forget: ignore errors
    } finally {
      clearTokens();
      qc.clear();
      router.push('/auth/login');
    }
  };
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: (body: { email: string }) =>
      api.post('/api/auth/forgot-password', body).then(r => r.data),
  });
}

export function useResetPassword() {
  const router = useRouter();
  return useMutation({
    mutationFn: (body: { token: string; newPassword: string }) =>
      api.post('/api/auth/reset-password', body).then(r => r.data),
    onSuccess: () => router.push('/auth/login'),
  });
}

export function useCheckUsername() {
  return useMutation({
    mutationFn: (username: string) =>
      api.get<{ available: boolean }>(`/api/auth/check-username?username=${encodeURIComponent(username)}`).then(r => r.data),
  });
}

export function useCompleteOnboarding() {
  const router = useRouter();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; username: string; bio?: string; campus_id: string }) =>
      api.post<{ accessToken: string; refreshToken: string; profile: unknown }>('/api/onboarding/complete', body).then(r => r.data),
    onSuccess: data => {
      setTokens(data.accessToken, data.refreshToken);
      qc.invalidateQueries({ queryKey: ['me'] });
      router.push('/feed');
    },
  });
}

export function useOnboardingCampuses() {
  return useQuery<{ id: string; name: string; college_id: string }[]>({
    queryKey: ['onboarding-campuses'],
    queryFn: () => api.get('/api/onboarding/campuses').then(r => r.data),
    staleTime: Infinity,
  });
}
