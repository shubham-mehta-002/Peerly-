'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { ErrorMessage } from '@/components/ui/error-message';
import {
  useLogin, useRegister, useVerifyEmail, useResendOTP,
  useCheckDomain, type DomainCheckResult,
} from '@/lib/hooks/useAuth';
import type { ApiError } from '@/lib/types';

const PASSWORD_RULES = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
  { label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'Number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'Special character', test: (p: string) => /[^a-zA-Z0-9]/.test(p) },
];

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const passed = PASSWORD_RULES.filter(r => r.test(password)).length;
  const color = passed <= 2 ? '#C0392B' : passed <= 3 ? '#E67E22' : passed <= 4 ? '#F1C40F' : '#27AE60';
  return (
    <div className="-mt-2">
      <div className="flex gap-1 mb-1.5">
        {PASSWORD_RULES.map((_, i) => (
          <div key={i} className="flex-1 h-[3px] rounded-sm transition-colors duration-200"
            style={{ background: i < passed ? color : 'var(--border)' }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {PASSWORD_RULES.map(r => (
          <span key={r.label} className="text-[11px]"
            style={{ color: r.test(password) ? '#27AE60' : 'var(--muted)' }}>
            {r.test(password) ? '✓' : '○'} {r.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function DomainChecker({ email }: { email: string }) {
  const checkDomain = useCheckDomain();
  const [result, setResult] = useState<DomainCheckResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastChecked = useRef('');

  useEffect(() => {
    const domain = email.split('@')[1];
    if (!domain || domain.length < 3 || domain === lastChecked.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      lastChecked.current = domain;
      try { setResult(await checkDomain.mutateAsync(email)); }
      catch { setResult(null); }
    }, 600);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [email]);

  if (!email.includes('@') || !email.split('@')[1]) {
    return (
      <div className="px-3.5 py-2.5 rounded-lg text-[13px] leading-relaxed border border-[var(--border)] bg-[var(--background)] text-[var(--muted)]">
        Enter your college email above to check if your institution is supported.
      </div>
    );
  }
  if (checkDomain.isPending) {
    return (
      <div className="px-3.5 py-2.5 rounded-lg text-[13px] border border-[var(--border)] bg-[var(--background)] text-[var(--muted)]">
        Checking domain…
      </div>
    );
  }
  if (!result) return null;

  const configs: Record<string, { bg: string; border: string; color: string; icon: string; text: string }> = {
    active: { bg: 'rgba(39,174,96,.08)', border: '#27AE60', color: '#27AE60', icon: '✓', text: `${result.college_name ?? result.domain} is supported` },
    inactive: { bg: 'rgba(230,126,34,.08)', border: '#E67E22', color: '#E67E22', icon: '⚠', text: `${result.college_name ?? result.domain} is currently inactive` },
    not_found: { bg: 'rgba(192,57,43,.08)', border: '#C0392B', color: '#C0392B', icon: '✗', text: `@${result.domain} is not a whitelisted domain` },
    invalid: { bg: 'rgba(192,57,43,.08)', border: '#C0392B', color: '#C0392B', icon: '✗', text: 'Invalid email format' },
  };
  const cfg = configs[result.status];
  if (!cfg) return null;
  return (
    <div className="px-3.5 py-2.5 rounded-lg text-[13px] leading-relaxed"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
      {cfg.icon} {cfg.text}
    </div>
  );
}

export default function LoginPage() {
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [step, setStep] = useState<'auth' | 'otp'>('auth');
  const [pendingEmail, setPendingEmail] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const router = useRouter();

  const login = useLogin();
  const register = useRegister();
  const verify = useVerifyEmail();
  const resend = useResendOTP();

  const handleTabSwitch = (t: 'login' | 'signup') => {
    setTab(t); login.reset(); register.reset();
  };
  const handleEmailChange = (v: string) => {
    setEmail(v);
    if (login.error) login.reset();
    if (register.error) register.reset();
  };

  const getError = (mut: { error: unknown }) => {
    const e = mut.error as ApiError | null;
    return e?.response?.data?.error ?? e?.message ?? null;
  };
  const loginError = getError(login);
  const registerError = getError(register);
  const verifyError = getError(verify);

  if (step === 'otp') {
    return (
      <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center px-6 py-10">
        <div className="mb-12 text-center">
          <div className="text-[28px] font-bold text-[var(--foreground)] tracking-tight mb-1.5">Peerly</div>
          <div className="text-sm text-[var(--muted)]">Your campus, your community.</div>
        </div>
        <div className="w-full max-w-[400px] bg-[var(--card)] border border-[var(--border)] rounded-xl px-7 py-7">
          <h2 className="text-[18px] font-semibold text-[var(--foreground)] mb-2">Verify your email</h2>
          <p className="text-[13px] text-[var(--muted)] leading-relaxed mb-6">
            We sent a 6-digit code to <strong>{pendingEmail}</strong>. Enter it below to activate your account.
          </p>
          <ErrorMessage message={verifyError} />
          <div className="flex flex-col gap-4 mt-4">
            <FormInput
              label="Verification code"
              placeholder="000000"
              value={otp}
              onChange={e => { setOtp((e.target as HTMLInputElement).value); if (verify.error) verify.reset(); }}
            />
            <Button
              onClick={() => { if (otp.length === 6) verify.mutate({ email: pendingEmail, otp }); }}
              disabled={verify.isPending || otp.length !== 6}
              className="w-full justify-center"
            >
              {verify.isPending ? 'Verifying…' : 'Verify email'}
            </Button>
            <div className="text-center text-[13px] text-[var(--muted)]">
              Didn&apos;t receive it?{' '}
              <button
                onClick={() => resend.mutate(pendingEmail)}
                disabled={resend.isPending}
                className="bg-transparent border-none cursor-pointer text-[var(--accent)] text-[13px] p-0 font-[inherit]"
              >
                {resend.isPending ? 'Sending…' : resend.isSuccess ? 'Sent!' : 'Resend code'}
              </button>
            </div>
            <button
              onClick={() => { setStep('auth'); setOtp(''); verify.reset(); }}
              className="bg-transparent border-none cursor-pointer text-[var(--muted)] text-[13px] p-0 text-center font-[inherit]"
            >
              ← Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center px-6 py-10">
      <div className="mb-12 text-center">
        <div className="text-[28px] font-bold text-[var(--foreground)] tracking-tight mb-1.5">Peerly</div>
        <div className="text-sm text-[var(--muted)]">Your campus, your community.</div>
      </div>

      <div className="w-full max-w-[400px] bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-[var(--border)]">
          {(['login', 'signup'] as const).map(t => (
            <button key={t} onClick={() => handleTabSwitch(t)}
              className="flex-1 py-3.5 bg-transparent border-none cursor-pointer font-[inherit] text-sm transition-all duration-150"
              style={{
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--foreground)' : 'var(--muted)',
                borderBottom: tab === t ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: -1,
              }}>
              {t === 'login' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>

        <div className="px-7 py-7">
          {tab === 'login' ? (
            <div className="flex flex-col gap-4">
              <ErrorMessage message={loginError} />
              {loginError?.includes('verify your email') && (
                <button
                  onClick={() => { setPendingEmail(email); setStep('otp'); login.reset(); }}
                  className="-mt-2 text-left bg-transparent border-none cursor-pointer text-[var(--accent)] font-[inherit] text-xs p-0 underline underline-offset-2"
                >
                  Verify email now →
                </button>
              )}
              <FormInput
                label="College email"
                placeholder="yourname@thapar.edu"
                type="email"
                value={email}
                onChange={e => handleEmailChange((e.target as HTMLInputElement).value)}
              />
              <FormInput
                label="Password"
                placeholder="••••••••"
                type="password"
                showToggle
                value={password}
                onChange={e => { setPassword((e.target as HTMLInputElement).value); if (login.error) login.reset(); }}
              />
              <div className="text-right -mt-2">
                <button
                  onClick={() => router.push('/auth/forgot-password')}
                  className="bg-transparent border-none cursor-pointer text-[13px] text-[var(--accent)] font-[inherit] p-0"
                >
                  Forgot password?
                </button>
              </div>
              <Button
                onClick={() => { if (email && password) login.mutate({ email, password }); }}
                disabled={login.isPending || !email || !password}
                className="w-full justify-center mt-1"
              >
                {login.isPending ? 'Signing in…' : 'Sign in'}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <ErrorMessage message={registerError} />
              <FormInput
                label="College email"
                placeholder="yourname@thapar.edu"
                type="email"
                value={email}
                onChange={e => handleEmailChange((e.target as HTMLInputElement).value)}
              />
              <DomainChecker email={email} />
              <FormInput
                label="Password"
                placeholder="Min. 8 characters"
                type="password"
                showToggle
                value={password}
                onChange={e => setPassword((e.target as HTMLInputElement).value)}
              />
              <PasswordStrength password={password} />
              <FormInput
                label="Confirm password"
                placeholder="••••••••"
                type="password"
                showToggle
                value={confirmPassword}
                onChange={e => setConfirmPassword((e.target as HTMLInputElement).value)}
                error={confirmPassword && password !== confirmPassword ? "Passwords don't match" : ''}
              />
              <Button
                onClick={() => {
                  if (email && password && password === confirmPassword) {
                    register.mutate({ email, password }, {
                      onSuccess: data => { setPendingEmail(data.email); setStep('otp'); },
                    });
                  }
                }}
                disabled={register.isPending || !email || !password || password !== confirmPassword}
                className="w-full justify-center mt-1"
              >
                {register.isPending ? 'Creating account…' : 'Create account'}
              </Button>
            </div>
          )}
        </div>
      </div>

      <p className="mt-7 text-xs text-[var(--muted)] text-center leading-relaxed max-w-[320px]">
        By signing up you agree to our Terms of Service. Peerly is exclusively for students of whitelisted institutions.
      </p>
    </div>
  );
}
