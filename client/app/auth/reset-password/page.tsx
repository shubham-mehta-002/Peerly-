'use client';

import { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { ErrorMessage } from '@/components/ui/error-message';
import { useResetPassword } from '@/lib/hooks/useAuth';
import type { ApiError } from '@/lib/types';

function ResetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const reset = useResetPassword();

  const mismatch = confirm.length > 0 && password !== confirm;
  const weak = password.length > 0 && password.length < 8;
  const strength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3;
  const strengthColor = ['', '#C0392B', '#E67E22', 'var(--accent)'];
  const strengthLabel = ['', 'Weak', 'Good', 'Strong'];

  const errorMsg = reset.error
    ? ((reset.error as ApiError).response?.data?.error ?? 'Reset failed')
    : null;

  return (
    <div className="flex flex-col gap-4">
      {!token && <ErrorMessage message="Invalid reset link. Request a new one." />}

      <div className="flex flex-col gap-2">
        <FormInput
          label="New password"
          type="password"
          showToggle
          placeholder="Min. 8 characters"
          value={password}
          onChange={e => setPassword((e.target as HTMLInputElement).value)}
          error={weak ? 'At least 8 characters' : ''}
        />
        {password.length > 0 && (
          <div className="flex items-center gap-2.5">
            <div className="flex-1 flex gap-1">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex-1 h-[3px] rounded-full transition-colors duration-200"
                  style={{ background: i <= strength ? strengthColor[strength] : 'var(--border)' }} />
              ))}
            </div>
            <span className="text-xs font-medium min-w-[40px]" style={{ color: strengthColor[strength] }}>
              {strengthLabel[strength]}
            </span>
          </div>
        )}
      </div>

      <FormInput
        label="Confirm password"
        type="password"
        showToggle
        placeholder="••••••••"
        value={confirm}
        onChange={e => setConfirm((e.target as HTMLInputElement).value)}
        error={mismatch ? "Passwords don't match" : ''}
      />
      <ErrorMessage message={errorMsg} />
      <Button
        disabled={!password || !confirm || mismatch || weak || !token || reset.isPending}
        onClick={() => reset.mutate({ token, newPassword: password }, {
          onSuccess: () => {
            toast.success('Password updated — you can sign in now');
            router.push('/auth/login');
          },
          onError: (e) => toast.error((e as ApiError).response?.data?.error ?? 'Reset failed'),
        })}
        className="w-full justify-center mt-1"
      >
        {reset.isPending ? 'Saving…' : 'Set new password'}
      </Button>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-7">
          <h1 className="text-[22px] font-semibold text-[var(--foreground)] tracking-tight mb-2">Choose a new password</h1>
          <p className="text-sm text-[var(--muted)] leading-relaxed">Min. 8 characters.</p>
        </div>
        <Suspense fallback={<div className="text-[var(--muted)]">Loading…</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
