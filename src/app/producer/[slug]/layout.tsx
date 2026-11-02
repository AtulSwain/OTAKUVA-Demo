import type { Metadata } from 'next';
import { producerMetadata } from '../../../lib/seo/pageSeo';

// Search-engine title / description for this page (its page component runs in the browser).
export function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  return producerMetadata(params.slug);
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
