import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Anime Communities',
  description: 'Join anime communities and talk about the shows you love with other fans.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
