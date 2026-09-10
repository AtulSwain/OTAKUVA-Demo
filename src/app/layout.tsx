import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import { AppShell } from '../components/shell/AppShell';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'OTAKUVA — Track what you watch.',
  description: 'OTAKUVA is a premium digital archive, anime discovery, tracking, statistics, and community platform.',
  keywords: ['anime', 'tracker', 'anime database', 'otakuva', 'anime list', 'seasonal anime', 'ratings'],
  authors: [{ name: 'OTAKUVA' }],
  openGraph: {
    title: 'OTAKUVA — Track what you watch.',
    description: 'A premium digital archive for anime and the people who watch it.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#08090A',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
