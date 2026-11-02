import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Anime Creators, Directors & Voice Actors',
  description: 'Browse anime directors, writers, composers, character designers and voice actors, with every credit and voice role.',
  alternates: { canonical: '/artists' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
