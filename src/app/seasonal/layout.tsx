import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Seasonal Anime',
  description: 'Every anime airing this season, last season and next season, with studios, genres, schedules and members’ episode ratings.',
  alternates: { canonical: '/seasonal' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
