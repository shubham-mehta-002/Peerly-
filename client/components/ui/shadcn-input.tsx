import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ShadcnInputProps extends React.InputHTMLAttributes<HTMLInputElement> { }

const ShadcnInput = React.forwardRef<HTMLInputElement, ShadcnInputProps>(
    ({ className, type, ...props }, ref) => {
        return (
            <input
                type={type}
                className={cn(
                    'flex h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50',
                    className
                )}
                ref={ref}
                {...props}
            />
        );
    }
);
ShadcnInput.displayName = 'ShadcnInput';

export { ShadcnInput };
