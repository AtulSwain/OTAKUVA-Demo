/**
 * How the sitemap is split (2026-11-02). A sitemap file may hold at most
 * 50,000 URLs, so the big tables get several files of PAGE_SIZE each. The
 * list is fixed (no database call to plan it), with room to grow; a file
 * past the end of its table is simply empty.
 *
 *   0        core pages + genres + studios + news
 *   1–3      anime         (75k capacity; 18k today)
 *   4–6      creators      (75k; 46k today)
 *   7–11     characters    (125k; 94k today)
 */
export const SITEMAP_PAGE_SIZE = 25_000;

export type SitemapPart = { kind: 'core' } | { kind: 'anime' | 'people' | 'characters'; page: number };

const PLAN: SitemapPart[] = [
  { kind: 'core' },
  ...[0, 1, 2].map((page) => ({ kind: 'anime' as const, page })),
  ...[0, 1, 2].map((page) => ({ kind: 'people' as const, page })),
  ...[0, 1, 2, 3, 4].map((page) => ({ kind: 'characters' as const, page })),
];

export const SITEMAP_IDS: number[] = PLAN.map((_, i) => i);

export const sitemapPart = (id: number): SitemapPart | null => PLAN[id] ?? null;
