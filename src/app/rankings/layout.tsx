import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Anime Rankings',
  description: 'The top anime ranked by how well each episode keeps viewers watching, plus the highest-rated and most popular series.',
  alternates: { canonical: '/rankings' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
