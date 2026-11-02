import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'This Day in Anime History',
  description: 'Anime premieres, finales and milestones on this day in anime history.',
  alternates: { canonical: '/history' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
