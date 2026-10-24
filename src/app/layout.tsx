import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';
import { AppShell } from '../components/shell/AppShell';
import { inter } from './fonts';

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
  applicationName: 'OTAKUVA',
  // Installed to the home screen (and the basis for a store wrapper later).
  appleWebApp: { capable: true, title: 'OTAKUVA', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: '#141416',
  width: 'device-width',
  initialScale: 1,
  // Draw under the notch / home bar; safe-area padding keeps content clear of them.
  viewportFit: 'cover',
  // On-screen keyboards resize the page instead of covering docked UI
  // such as the mobile reply composer.
  interactiveWidget: 'resizes-content',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
