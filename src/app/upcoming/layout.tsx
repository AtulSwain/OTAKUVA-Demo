import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Upcoming Anime',
  description: 'Anime coming soon: premiere dates, countdowns, trailers and which upcoming shows members are most hyped for.',
  alternates: { canonical: '/upcoming' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
