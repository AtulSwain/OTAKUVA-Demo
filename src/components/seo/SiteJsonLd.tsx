import { JsonLd } from './JsonLd';
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL, absoluteUrl } from '../../lib/seo/site';

/**
 * Site-level structured data (2026-11-02): who we are (Organization) and the
 * site search, so Google can show a search box for OTAKUVA in results.
 * Rendered on the homepage and on /welcome (where signed-out visitors land).
 */
export function SiteJsonLd() {
  return (
    <JsonLd
      data={[
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: SITE_URL,
          description: DEFAULT_DESCRIPTION,
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
            'query-input': 'required name=search_term_string',
          },
        },
        { '@context': 'https://schema.org', '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: absoluteUrl('/app-icons/512.png') },
      ]}
    />
  );
}
