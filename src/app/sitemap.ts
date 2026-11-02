import type { MetadataRoute } from 'next';
import { prisma } from '../lib/prisma';
import { absoluteUrl } from '../lib/seo/site';
import { SITEMAP_IDS, SITEMAP_PAGE_SIZE, sitemapPart } from '../lib/seo/sitemapPlan';
import { logger } from '../lib/logger';

// Built on request (never at build time, so a build never needs the DB).
export const dynamic = 'force-dynamic';

// Genres the site never lists (same rule as GET /api/genres).
const ADULT_GENRES = ['Hentai', 'Erotica'];

/** Public pages that aren't one entity. */
const CORE_PATHS: { path: string; changeFrequency: 'hourly' | 'daily' | 'weekly'; priority: number }[] = [
  { path: '/', changeFrequency: 'hourly', priority: 1 },
  { path: '/anime', changeFrequency: 'daily', priority: 0.9 },
  { path: '/schedule', changeFrequency: 'hourly', priority: 0.9 },
  { path: '/seasonal', changeFrequency: 'daily', priority: 0.9 },
  { path: '/announced', changeFrequency: 'daily', priority: 0.8 },
  { path: '/upcoming', changeFrequency: 'daily', priority: 0.8 },
  { path: '/news', changeFrequency: 'hourly', priority: 0.8 },
  { path: '/rankings', changeFrequency: 'daily', priority: 0.8 },
  { path: '/top-picks', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/browse', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/studios', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/artists', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/charts', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/collections', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/articles', changeFrequency: 'daily', priority: 0.6 },
  { path: '/community', changeFrequency: 'daily', priority: 0.6 },
  { path: '/discussions', changeFrequency: 'daily', priority: 0.6 },
  { path: '/history', changeFrequency: 'weekly', priority: 0.5 },
];

export async function generateSitemaps() {
  return SITEMAP_IDS.map((id) => ({ id }));
}

/**
 * sitemap/<id>.xml (2026-11-02) — every public page search engines should
 * know about, split per sitemapPlan.ts. Adult titles are left out. A
 * database error gives an empty file for that part (logged) rather than a 500.
 */
export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const part = sitemapPart(Number(id));
  if (!part) return [];
  try {
    if (part.kind === 'core') return await coreEntries();
    const skip = part.page * SITEMAP_PAGE_SIZE;
    const take = SITEMAP_PAGE_SIZE;

    if (part.kind === 'anime') {
      const rows = await prisma.anime.findMany({
        where: { isAdult: false },
        select: { slug: true, updatedAt: true },
        orderBy: { id: 'asc' },
        skip,
        take,
      });
      return rows.map((r) => ({ url: absoluteUrl(`/anime/${r.slug}`), lastModified: r.updatedAt, changeFrequency: 'weekly', priority: 0.8 }));
    }
    if (part.kind === 'people') {
      const rows = await prisma.person.findMany({
        where: { slug: { not: null } },
        select: { slug: true },
        orderBy: { id: 'asc' },
        skip,
        take,
      });
      return rows.map((r) => ({ url: absoluteUrl(`/person/${r.slug}`), changeFrequency: 'monthly', priority: 0.5 }));
    }
    const rows = await prisma.character.findMany({
      where: { slug: { not: null } },
      select: { slug: true },
      orderBy: { id: 'asc' },
      skip,
      take,
    });
    return rows.map((r) => ({ url: absoluteUrl(`/character/${r.slug}`), changeFrequency: 'monthly', priority: 0.4 }));
  } catch (error) {
    logger.error('Sitemap part failed', { error: error as Error, component: 'seo/sitemap', tags: { sitemapId: String(id) } });
    return [];
  }
}

async function coreEntries(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [genres, studios, news] = await Promise.all([
    prisma.genre.findMany({ where: { name: { notIn: ADULT_GENRES } }, select: { slug: true } }),
    prisma.studio.findMany({ where: { slug: { not: null } }, select: { slug: true, updatedAt: true } }),
    prisma.newsArticle.findMany({
      where: { status: 'PUBLISHED', deletedAt: null },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 20_000,
    }),
  ]);
  return [
    ...CORE_PATHS.map((p) => ({ url: absoluteUrl(p.path), lastModified: now, changeFrequency: p.changeFrequency, priority: p.priority })),
    ...genres.map((g) => ({ url: absoluteUrl(`/genre/${g.slug}`), changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...studios.map((s) => ({ url: absoluteUrl(`/studio/${s.slug}`), lastModified: s.updatedAt, changeFrequency: 'weekly' as const, priority: 0.6 })),
    ...news.map((n) => ({ url: absoluteUrl(`/news/${n.slug}`), lastModified: n.updatedAt, changeFrequency: 'monthly' as const, priority: 0.5 })),
  ];
}
