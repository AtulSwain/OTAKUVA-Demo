import { prisma } from './prisma';
import { sanitizePublicEntityName } from './normalizers';

/**
 * Collections are rules over the catalog, not hand-typed lists.
 *
 * They used to be a hardcoded array with typed-in counts ("12 Titles"), stock
 * Unsplash photos as covers, an "OTAKUVA Editorial" curator credit — and
 * every collection page showed the same top-15-by-score list. Now each
 * collection is a query: its titles, its count and its cover art all come
 * from the anime that actually match, and the rule is shown to the reader.
 * Slugs are kept so existing links still work.
 */
export interface CollectionDef {
  slug: string;
  title: string;
  description: string;
  /** Plain-language description of the rule, shown on the page. */
  rule: string;
  where: Record<string, unknown>;
  orderBy: Record<string, unknown>[];
}

const scoreDesc = { score: { sort: 'desc', nulls: 'last' } };
const base = { status: { not: 'MERGED' }, isAdult: false, posterUrl: { not: '' } };
const hasTag = (name: string) => ({
  OR: [
    { animeGenres: { some: { genre: { name } } } },
    { animeThemes: { some: { theme: { name } } } },
  ],
});

export const COLLECTIONS: CollectionDef[] = [
  {
    slug: 'best-psychological-anime',
    title: 'Best Psychological Anime',
    description: 'Tension, moral ambiguity and mind games — the highest-rated psychological titles in the catalog.',
    rule: 'Tagged Psychological · score 7.5+ · by score',
    where: { ...base, score: { gte: 7.5 }, ...hasTag('Psychological') },
    orderBy: [scoreDesc],
  },
  {
    slug: 'essential-modern-masterpieces',
    title: 'Essential Modern Anime',
    description: 'The best-rated TV series from 2015 onward.',
    rule: 'TV · 2015 or later · score 8.3+ · by score',
    where: { ...base, type: 'TV', year: { gte: 2015 }, score: { gte: 8.3 } },
    orderBy: [scoreDesc],
  },
  {
    slug: 'anime-that-will-break-your-heart',
    title: 'Acclaimed Drama',
    description: 'Drama series and films with exceptional scores.',
    rule: 'Drama · score 8.3+ · by score',
    where: { ...base, score: { gte: 8.3 }, animeGenres: { some: { genre: { name: 'Drama' } } } },
    orderBy: [scoreDesc],
  },
  {
    slug: 'start-here-anime-for-beginners',
    title: 'Start Here: Most-Watched Classics',
    description: 'Highly rated series that the most people have watched — a safe first pick.',
    rule: 'TV · score 8.0+ · by number of members',
    where: {
      ...base,
      type: 'TV',
      score: { gte: 8.0 },
      NOT: { animeGenres: { some: { genre: { name: { in: ['Ecchi', 'Hentai'] } } } } },
    },
    orderBy: [{ members: { sort: 'desc', nulls: 'last' } }, scoreDesc],
  },
];

export function getCollectionDef(slug: string): CollectionDef | undefined {
  return COLLECTIONS.find((c) => c.slug === slug);
}

export interface CollectionAnime {
  id: string;
  slug: string;
  title: string;
  posterUrl: string;
  year: number | null;
  type: string | null;
  studio: string | null;
  score: number | null;
}

export interface CollectionSummary {
  slug: string;
  title: string;
  description: string;
  rule: string;
  count: number;
  /** The top title's own art — banner when it has one, otherwise its poster. */
  coverUrl: string | null;
}

export async function getCollectionSummaries(): Promise<CollectionSummary[]> {
  const results = await Promise.all(
    COLLECTIONS.map(async (c) => {
      const [count, top] = await Promise.all([
        prisma.anime.count({ where: c.where as any }),
        prisma.anime.findMany({ where: c.where as any, orderBy: c.orderBy as any, take: 8, select: { id: true, bannerUrl: true, posterUrl: true } }),
      ]);
      return { c, count, top };
    })
  );
  // Each card gets the highest-ranked title not already used as another
  // card's cover, so the same artwork doesn't repeat across collections.
  const used = new Set<string>();
  return results.map(({ c, count, top }) => {
    const pick = top.find((a) => !used.has(a.id)) || top[0];
    if (pick) used.add(pick.id);
    return {
      slug: c.slug,
      title: c.title,
      description: c.description,
      rule: c.rule,
      count,
      coverUrl: pick?.bannerUrl || pick?.posterUrl || null,
    };
  });
}

export async function getCollectionAnime(def: CollectionDef, limit = 50): Promise<{ total: number; items: CollectionAnime[] }> {
  const [total, rows] = await Promise.all([
    prisma.anime.count({ where: def.where as any }),
    prisma.anime.findMany({
      where: def.where as any,
      orderBy: def.orderBy as any,
      take: limit,
      select: {
        id: true,
        slug: true,
        canonicalTitle: true,
        posterUrl: true,
        year: true,
        startYear: true,
        type: true,
        score: true,
        animeStudios: { select: { studio: { select: { name: true } } }, take: 1 },
      },
    }),
  ]);
  return {
    total,
    items: rows.map((a) => ({
      id: a.id,
      slug: a.slug,
      title: sanitizePublicEntityName(a.canonicalTitle),
      posterUrl: a.posterUrl,
      year: a.year ?? a.startYear ?? null,
      type: a.type || null,
      studio: a.animeStudios[0]?.studio.name ? sanitizePublicEntityName(a.animeStudios[0].studio.name) : null,
      score: typeof a.score === 'number' ? a.score : null,
    })),
  };
}
