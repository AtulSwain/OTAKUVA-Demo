import type { Metadata } from 'next';
import { discussionMetadata } from '../../../lib/seo/pageSeo';

// Search-engine title / description for this page (its page component runs in the browser).
export function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  return discussionMetadata(params.id);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
