'use client';

import * as React from 'react';
import { Label } from '@/components/ui/label';
import { ShadcnInput } from '@/components/ui/shadcn-input';
import { cn } from '@/lib/utils';

interface FormInputProps {
    label?: string;
    placeholder?: string;
    type?: string;
    value?: string;
    onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    hint?: string;
    error?: string;
    multiline?: boolean;
    rows?: number;
    showToggle?: boolean;
    className?: string;
    id?: string;
    disabled?: boolean;
    autoComplete?: string;
}

export function FormInput({
    label,
    placeholder,
    type = 'text',
    value,
    onChange,
    hint,
    error,
    multiline,
    rows = 3,
    showToggle,
    className,
    id,
    disabled,
    autoComplete,
}: FormInputProps) {
    const [showPwd, setShowPwd] = React.useState(false);
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const isPassword = type === 'password';
    const effectiveType = isPassword && showToggle ? (showPwd ? 'text' : 'password') : type;

    const baseInputClass = cn(
        'w-full rounded-lg border bg-[var(--background)] px-3 py-[10px] text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 resize-none',
        error ? 'border-red-500' : 'border-[var(--border)]'
    );

    return (
        <div className={cn('flex flex-col gap-1', className)}>
            {label && (
                <Label htmlFor={inputId}>{label}</Label>
            )}

            {multiline ? (
                <textarea
                    id={inputId}
                    className={baseInputClass}
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange}
                    rows={rows}
                    disabled={disabled}
                />
            ) : isPassword && showToggle ? (
                <div className="relative">
                    <ShadcnInput
                        id={inputId}
                        type={effectiveType}
                        placeholder={placeholder}
                        value={value}
                        onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
                        disabled={disabled}
                        autoComplete={autoComplete}
                        className={cn(
                            'pr-10',
                            error ? 'border-red-500 focus-visible:ring-red-500' : ''
                        )}
                    />
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPwd(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
                    >
                        {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                </div>
            ) : (
                <ShadcnInput
                    id={inputId}
                    type={type}
                    placeholder={placeholder}
                    value={value}
                    onChange={onChange as React.ChangeEventHandler<HTMLInputElement>}
                    disabled={disabled}
                    autoComplete={autoComplete}
                    className={error ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
            )}

            {hint && !error && (
                <span className="text-[12px] text-[var(--muted)]">{hint}</span>
            )}
            {error && (
                <span className="text-[12px] text-red-500">{error}</span>
            )}
        </div>
    );
}

function EyeIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    );
}

function EyeOffIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
    );
}
