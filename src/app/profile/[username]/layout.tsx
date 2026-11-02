import type { Metadata } from 'next';
import { profileMetadata } from '../../../lib/seo/pageSeo';

// Search-engine title / description for this page (its page component runs in the browser).
export function generateMetadata({ params }: { params: { username: string } }): Promise<Metadata> {
  return profileMetadata(params.username);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
