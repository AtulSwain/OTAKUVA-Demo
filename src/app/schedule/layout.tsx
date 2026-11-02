import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Anime Release Schedule',
  description: 'When every new anime episode airs this week, in your local time and Japan time, with where to watch each one.',
  alternates: { canonical: '/schedule' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
