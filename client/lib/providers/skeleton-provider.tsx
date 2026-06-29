'use client';

import { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export function SkeletonProvider({ children }: { children: React.ReactNode }) {
    return (
        <SkeletonTheme baseColor="#2a2f3a" highlightColor="#363c4a">
            {children}
        </SkeletonTheme>
    );
}
