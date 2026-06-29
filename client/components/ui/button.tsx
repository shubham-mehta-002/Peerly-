import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-45',
    {
        variants: {
            variant: {
                default: 'bg-[var(--accent)] text-white border-none',
                secondary: 'bg-[var(--card)] text-[var(--foreground)] border border-[var(--border)]',
                ghost: 'bg-transparent text-[var(--muted)] border-none',
                destructive: 'bg-transparent text-red-500 border border-red-500',
                outline: 'border border-[var(--border)] bg-transparent text-[var(--foreground)]',
                link: 'text-[var(--accent)] underline-offset-4 hover:underline bg-transparent border-none',
            },
            size: {
                default: 'px-[18px] py-[10px] text-sm',
                sm: 'px-3 py-1.5 text-[13px]',
                lg: 'px-6 py-3 text-[15px]',
                icon: 'h-9 w-9',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
