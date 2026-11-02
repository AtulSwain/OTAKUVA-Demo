import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Anime Discussions',
  description: 'Episode talk, theories, recommendations and debates from anime fans.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
