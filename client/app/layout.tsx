import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { QueryProvider } from '@/lib/providers/query-provider';
import { SkeletonProvider } from '@/lib/providers/skeleton-provider';
import { TweaksProvider } from '@/lib/providers/tweaks-provider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['300', '400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Peerly',
  description: 'Your campus, your community.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body>
        <QueryProvider>
          <SkeletonProvider>
            <TweaksProvider>
              {children}
            </TweaksProvider>
          </SkeletonProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
