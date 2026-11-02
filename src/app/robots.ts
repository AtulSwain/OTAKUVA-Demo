import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/seo/site';
import { SITEMAP_IDS } from '../lib/seo/sitemapPlan';

/**
 * robots.txt (2026-11-02). Crawlers may read every public page; private or
 * per-member pages and the API are kept out. The control center is
 * deliberately NOT listed (listing it would advertise it) — it 404s without
 * the owner's key and is noindex anyway.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/library', '/settings', '/profile/you', '/l/', '/creator/', '/report-content', '/chat'],
      },
    ],
    sitemap: SITEMAP_IDS.map((id) => `${SITE_URL}/sitemap/${id}.xml`),
    host: SITE_URL,
  };
}
