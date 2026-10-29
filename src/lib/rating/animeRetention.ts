import { prisma } from '../prisma';
import { computeAnimeRetention, RETENTION_MAX, RETENTION_MIN, type AnimeRetention, type EpisodeRetentionStat } from './retentionScore';

/**
 * Anime-level retention straight from the stored episode ratings — computed
 * on read, so a rating change is reflected everywhere on the next request
 * (no cached total to drift out of sync). Rules: `retentionScore.ts`.
 */

/** Only valid ratings count (whole numbers 1–100, on a numbered episode). */
export const VALID_RETENTION_WHERE = {
  episodeNumber: { not: null },
  retention: { gte: RETENTION_MIN, lte: RETENTION_MAX },
} as const;

export async function getAnimeRetentions(animeIds: string[]): Promise<Map<string, AnimeRetention>> {
  const ids = Array.from(new Set(animeIds.filter(Boolean)));
  const out = new Map<string, AnimeRetention>();
  if (ids.length === 0) return out;

  const [perEpisode, perMember, anime] = await Promise.all([
    prisma.episodeRating.groupBy({
      by: ['animeId', 'episodeNumber'],
      where: { animeId: { in: ids }, ...VALID_RETENTION_WHERE },
      _sum: { retention: true },
      _count: { retention: true },
    }),
    prisma.episodeRating.groupBy({
      by: ['animeId', 'userId'],
      where: { animeId: { in: ids }, ...VALID_RETENTION_WHERE },
    }),
    prisma.anime.findMany({ where: { id: { in: ids } }, select: { id: true, episodes: true } }),
  ]);

  const episodes = new Map<string, EpisodeRetentionStat[]>();
  for (const row of perEpisode) {
    if (!row.animeId || row.episodeNumber === null) continue;
    const list = episodes.get(row.animeId) ?? [];
    list.push({ number: row.episodeNumber, sum: row._sum.retention ?? 0, count: row._count.retention });
    episodes.set(row.animeId, list);
  }
  const raters = new Map<string, number>();
  for (const row of perMember) if (row.animeId) raters.set(row.animeId, (raters.get(row.animeId) ?? 0) + 1);
  const declared = new Map(anime.map((a) => [a.id, a.episodes]));

  for (const id of ids) {
    out.set(id, computeAnimeRetention(episodes.get(id) ?? [], raters.get(id) ?? 0, declared.get(id)));
  }
  return out;
}

export async function getAnimeRetention(animeId: string): Promise<AnimeRetention> {
  return (await getAnimeRetentions([animeId])).get(animeId)!;
}

export interface RetentionRankingItem {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  type: string | null;
  year: number | null;
  retention: AnimeRetention;
}

/**
 * Every anime with retention ratings, ranked by the raw anime score. Titles
 * with enough data (`rated`) and those still Provisional are kept apart.
 */
export async function getRetentionRankings(limit = 100): Promise<{ rated: RetentionRankingItem[]; provisional: RetentionRankingItem[] }> {
  const withRatings = await prisma.episodeRating.groupBy({ by: ['animeId'], where: VALID_RETENTION_WHERE });
  const ids = withRatings.map((r) => r.animeId).filter((id): id is string => Boolean(id));
  if (ids.length === 0) return { rated: [], provisional: [] };
  const [scores, anime] = await Promise.all([
    getAnimeRetentions(ids),
    prisma.anime.findMany({
      where: { id: { in: ids }, isAdult: false },
      select: { id: true, slug: true, canonicalTitle: true, posterUrl: true, type: true, year: true },
    }),
  ]);
  const items: RetentionRankingItem[] = anime.map((a) => ({
    id: a.id,
    slug: a.slug,
    title: a.canonicalTitle,
    posterUrl: a.posterUrl || null,
    type: a.type,
    year: a.year,
    retention: scores.get(a.id)!,
  }));
  // Highest raw score first; ties → more ratings → more rated episodes → title.
  const order = (x: RetentionRankingItem, y: RetentionRankingItem) =>
    (y.retention.raw ?? 0) - (x.retention.raw ?? 0) ||
    y.retention.totalRatings - x.retention.totalRatings ||
    y.retention.ratedEpisodes - x.retention.ratedEpisodes ||
    x.title.localeCompare(y.title);
  return {
    rated: items.filter((i) => i.retention.status === 'rated').sort(order).slice(0, limit),
    provisional: items.filter((i) => i.retention.status === 'provisional').sort(order).slice(0, limit),
  };
}
