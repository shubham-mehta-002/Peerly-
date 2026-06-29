'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { FormInput } from '@/components/ui/form-input';
import { ErrorMessage } from '@/components/ui/error-message';
import { useOnboardingCampuses, useCompleteOnboarding, useCheckUsername } from '@/lib/hooks/useAuth';
import type { ApiError } from '@/lib/types';

const steps = ['Campus', 'Profile', 'Done'];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [campusId, setCampusId] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  const { data: campuses = [], isLoading: loadingCampuses } = useOnboardingCampuses();
  const complete = useCompleteOnboarding();
  const checkUsername = useCheckUsername();

  useEffect(() => {
    if (username.length < 3) { setUsernameState('idle'); return; }
    setUsernameState('checking');
    const t = setTimeout(() => {
      checkUsername.mutate(username, {
        onSuccess: d => setUsernameState(d.available ? 'available' : 'taken'),
        onError: () => setUsernameState('idle'),
      });
    }, 600);
    return () => clearTimeout(t);
  }, [username]);

  const handleComplete = () => {
    if (!name || !username || !campusId || usernameState !== 'available') return;
    complete.mutate({ name, username, bio: bio || undefined, campus_id: campusId });
  };

  const completeError = complete.error
    ? ((complete.error as ApiError).response?.data?.error ?? 'Something went wrong')
    : null;

  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-[480px]">

        <div className="mb-9 text-center">
          <div className="text-[22px] font-bold text-[var(--foreground)] tracking-tight">Peerly</div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-9">
          {steps.map((s, i) => (
            <div key={s} style={{ display: 'contents' }}>
              <div className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[13px] font-semibold transition-all duration-300"
                  style={{
                    background: i <= step ? 'var(--accent)' : 'var(--border)',
                    color: i <= step ? '#fff' : 'var(--muted)',
                  }}
                >
                  {i < step ? '✓' : i + 1}
                </div>
                <span
                  className="text-[11px] font-[inherit] tracking-wider uppercase"
                  style={{
                    color: i <= step ? 'var(--foreground)' : 'var(--muted)',
                    fontWeight: i === step ? 600 : 400,
                  }}
                >
                  {s}
                </span>
              </div>
              {i < steps.length - 1 && (
                <div
                  className="flex-[2] h-px mb-[22px] transition-colors duration-300"
                  style={{ background: i < step ? 'var(--accent)' : 'var(--border)' }}
                />
              )}
            </div>
          ))}
        </div>

        <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl px-7 py-8">

          {step === 0 && (
            <div className="flex flex-col gap-5">
              <div>
                <h2 className="text-[20px] font-semibold text-[var(--foreground)] mb-1.5">Select your campus</h2>
                <p className="text-sm text-[var(--muted)] leading-relaxed">Your campus is locked after setup and determines which content you see.</p>
              </div>
              {loadingCampuses ? (
                <div className="text-sm text-[var(--muted)]">Loading campuses…</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {campuses.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setCampusId(c.id)}
                      className="text-left px-4 py-3.5 rounded-lg cursor-pointer font-[inherit] text-sm transition-all duration-150"
                      style={{
                        border: `1px solid ${campusId === c.id ? 'var(--accent)' : 'var(--border)'}`,
                        background: campusId === c.id ? 'rgba(45,106,79,.07)' : 'var(--background)',
                        color: 'var(--foreground)',
                        fontWeight: campusId === c.id ? 600 : 400,
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
              <Button disabled={!campusId} onClick={() => setStep(1)} className="self-end">
                Continue →
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-[20px] font-semibold text-[var(--foreground)] mb-1.5">Set up your profile</h2>
                <p className="text-sm text-[var(--muted)]">You can always update this later.</p>
              </div>
              <FormInput
                label="Full name"
                placeholder="Priya Sharma"
                value={name}
                onChange={e => setName((e.target as HTMLInputElement).value)}
              />
              <FormInput
                label="Username"
                placeholder="priya_sharma"
                value={username}
                onChange={e => setUsername((e.target as HTMLInputElement).value)}
                hint={
                  usernameState === 'available' ? '✓ Username is available' :
                    usernameState === 'checking' ? 'Checking…' :
                      'Letters, numbers, underscores only'
                }
                error={usernameState === 'taken' ? 'This username is taken' : ''}
              />
              <FormInput
                label="Bio"
                placeholder="2nd year CSE, loves football and bad puns"
                multiline
                rows={2}
                value={bio}
                onChange={e => setBio((e.target as HTMLTextAreaElement).value)}
              />
              <ErrorMessage message={completeError} />
              <div className="flex justify-between mt-1">
                <Button variant="ghost" onClick={() => setStep(0)}>← Back</Button>
                <Button
                  onClick={handleComplete}
                  disabled={!name || usernameState !== 'available' || complete.isPending}
                >
                  {complete.isPending ? 'Saving…' : 'Save & Continue →'}
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
