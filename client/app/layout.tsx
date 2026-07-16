import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
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
      <body suppressHydrationWarning>
        <QueryProvider>
          <SkeletonProvider>
            <TweaksProvider>
              {children}
              <Toaster
                position="bottom-right"
                theme="dark"
                richColors
                closeButton
                toastOptions={{ duration: 3500 }}
              />
            </TweaksProvider>
          </SkeletonProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
