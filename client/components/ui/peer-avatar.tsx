'use client';

import * as React from 'react';
import { ShadcnAvatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn-avatar';
import { useTweaks } from '@/lib/providers/tweaks-provider';
import { cn } from '@/lib/utils';

interface PeerlyAvatarProps {
    name?: string;
    src?: string;
    size?: number;
    anon?: boolean;
    className?: string;
}

export function PeerlyAvatar({ name = '?', src, size = 32, anon = false, className }: PeerlyAvatarProps) {
    const { anonStyle } = useTweaks();

    const initials = name
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

    const sizeStyle: React.CSSProperties = { width: size, height: size };

    if (anon) {
        const char = anonStyle === 'ghost' ? '?' : '—';
        return (
            <ShadcnAvatar
                className={cn('shrink-0', className)}
                style={sizeStyle}
            >
                <AvatarFallback
                    className="bg-[var(--border)] text-[var(--muted)] font-semibold"
                    style={{ fontSize: size * 0.4, letterSpacing: anonStyle !== 'ghost' ? '-0.5px' : undefined }}
                >
                    {char}
                </AvatarFallback>
            </ShadcnAvatar>
        );
    }

    if (src) {
        return (
            <ShadcnAvatar className={cn('shrink-0', className)} style={sizeStyle}>
                <AvatarImage src={src} alt={name} />
                <AvatarFallback
                    className="bg-[var(--accent)] text-white font-semibold"
                    style={{ fontSize: size * 0.38 }}
                >
                    {initials}
                </AvatarFallback>
            </ShadcnAvatar>
        );
    }

    return (
        <ShadcnAvatar className={cn('shrink-0', className)} style={sizeStyle}>
            <AvatarFallback
                className="bg-[var(--accent)] text-white font-semibold"
                style={{ fontSize: size * 0.38 }}
            >
                {initials}
            </AvatarFallback>
        </ShadcnAvatar>
    );
}
