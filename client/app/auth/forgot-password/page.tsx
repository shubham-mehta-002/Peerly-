'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { ErrorMessage } from '@/components/ui/error-message';
import { useForgotPassword } from '@/lib/hooks/useAuth';
import type { ApiError } from '@/lib/types';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const router = useRouter();
  const forgot = useForgotPassword();

  const errorMsg = forgot.error
    ? ((forgot.error as ApiError).response?.data?.error ?? (forgot.error as ApiError).message)
    : null;

  const handleSend = () => {
    if (!email.trim()) return;
    forgot.mutate({ email }, {
      onSuccess: () => { setSent(true); toast.success('Reset link sent — check your inbox'); },
      onError: () => toast.error('Failed to send reset link'),
    });
  };

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-[400px]">
        <button
          onClick={() => router.push('/auth/login')}
          className="flex items-center gap-1.5 bg-transparent border-none cursor-pointer font-[inherit] text-[13px] text-[var(--muted)] p-0 mb-9"
        >
          ← Back to sign in
        </button>

        {!sent ? (
          <>
            <div className="mb-7">
              <h1 className="text-[22px] font-semibold text-[var(--foreground)] tracking-tight mb-2">Reset your password</h1>
              <p className="text-sm text-[var(--muted)] leading-relaxed">
                Enter your college email and we&apos;ll send a reset link.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <ErrorMessage message={errorMsg} />
              <FormInput
                label="College email"
                placeholder="yourname@thapar.edu"
                type="email"
                value={email}
                onChange={e => setEmail((e.target as HTMLInputElement).value)}
              />
              <Button
                disabled={!email.trim() || forgot.isPending}
                onClick={handleSend}
                className="w-full justify-center"
              >
                {forgot.isPending ? 'Sending…' : 'Send reset link'}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="w-14 h-14 rounded-full bg-[var(--card)] border border-[var(--border)] flex items-center justify-center text-2xl mx-auto mb-5">✉</div>
            <h1 className="text-[20px] font-semibold text-[var(--foreground)] tracking-tight mb-2.5">Check your inbox</h1>
            <p className="text-sm text-[var(--muted)] leading-relaxed mb-6">
              We sent a reset link to <strong className="text-[var(--foreground)]">{email}</strong>. Expires in 60 minutes.
            </p>
            <div className="flex flex-col gap-2.5">
              <Button variant="secondary" onClick={() => setSent(false)} className="w-full justify-center">
                Resend email
              </Button>
              <button
                onClick={() => router.push('/auth/login')}
                className="bg-transparent border-none cursor-pointer font-[inherit] text-[13px] text-[var(--muted)] underline underline-offset-[3px]"
              >
                Back to sign in
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
