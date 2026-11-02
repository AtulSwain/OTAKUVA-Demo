import { jsonLdString } from '../../lib/seo/site';

/** Structured data for search engines (schema.org JSON-LD). Server-rendered. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
