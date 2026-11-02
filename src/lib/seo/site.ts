/**
 * SEO basics (2026-11-02): the site's public address and small helpers for
 * page metadata, the sitemap and structured data (JSON-LD).
 *
 * SITE_URL comes from NEXT_PUBLIC_APP_URL (set in Vercel). When the site
 * moves to its own domain, change that one variable: canonical links, the
 * sitemap, robots.txt and share previews all follow.
 */
export const SITE_NAME = 'OTAKUVA';

const FALLBACK_URL = process.env.NODE_ENV === 'production' ? 'https://otakuva-demo.vercel.app' : 'http://localhost:3000';

export const SITE_URL = (process.env.NEXT_PUBLIC_APP_URL || FALLBACK_URL).replace(/\/+$/, '');

export const DEFAULT_DESCRIPTION =
  'Track every anime you watch, rate each episode by how much it kept you watching, and talk anime with people who love it. Schedules, seasons, studios, creators and news in one place.';

/** Absolute URL for a site path ("/anime/x" → "https://…/anime/x"). */
export const absoluteUrl = (path: string) => (/^https?:\/\//i.test(path) ? path : `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`);

/**
 * Plain one-paragraph description for a meta tag: tags stripped, spaces
 * collapsed, cut at a word boundary near `max` characters. Never invents text;
 * empty in → null out.
 */
export function metaDescription(text: string | null | undefined, max = 160): string | null {
  if (!text) return null;
  const plain = text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\[(?:written by|source)[^\]]*\]/gi, ' ')
    .replace(/\(source:[^)]*\)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return null;
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max - 1);
  const atWord = cut.lastIndexOf(' ');
  return `${(atWord > max * 0.6 ? cut.slice(0, atWord) : cut).replace(/[\s,;:.–—-]+$/, '')}…`;
}

/** Only http(s) images can be share-preview images. */
export const shareImage = (url: string | null | undefined): string | null =>
  url && /^https?:\/\//i.test(url) ? url : url && url.startsWith('/') ? absoluteUrl(url) : null;

/** Serialises JSON-LD safely for a <script> tag (no "</script>" breakout). */
export const jsonLdString = (data: unknown) => JSON.stringify(data).replace(/</g, '\\u003c');
