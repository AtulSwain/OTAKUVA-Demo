import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Anime News',
  description: 'The latest anime news: announcements, trailers, release dates, staff and studio updates, gathered from trusted anime news sources.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
