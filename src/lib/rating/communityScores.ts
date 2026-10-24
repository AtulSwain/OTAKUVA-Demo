import { prisma } from '../prisma';

/**
 * Members' figures for many anime at once — what every card and poster shows
 * instead of the provider (MAL/AniList) score (2026-10-21, owner).
 *
 * - `score`: the OTAKUVA score, the same number the anime page shows
 *   (RatingAggregate.rawAverage, one counted score per member — see
 *   `recalculateAnimeAggregates`). Null until a member has rated it.
 * - `retention`: community retention 0–100, computed exactly like
 *   `getEpisodeRatingSummary` (each member's episode average, rounded, then
 *   averaged over members). Null until someone rated an episode.
 *
 * Nothing is filled in: an anime nobody rated has nulls and cards show nothing.
 */
export type CommunityScore = {
  score: number | null;
  ratingCount: number;
  retention: number | null;
  retentionMembers: number;
};

export const MAX_COMMUNITY_SCORE_IDS = 200;

export async function getCommunityScores(animeIds: string[]): Promise<Record<string, CommunityScore>> {
  const ids = Array.from(new Set(animeIds.filter((id) => typeof id === 'string' && id.length > 0 && id.length <= 64))).slice(
    0,
    MAX_COMMUNITY_SCORE_IDS
  );
  if (ids.length === 0) return {};

  const [aggregates, memberRetention] = await Promise.all([
    prisma.ratingAggregate.findMany({
      where: { animeId: { in: ids }, ratingCount: { gt: 0 } },
      select: { animeId: true, ratingCount: true, rawAverage: true },
    }),
    prisma.episodeRating.groupBy({
      by: ['animeId', 'userId'],
      where: { animeId: { in: ids }, episodeNumber: { not: null }, retention: { not: null } },
      _avg: { retention: true },
    }),
  ]);

  const out: Record<string, CommunityScore> = {};
  const entry = (id: string) => (out[id] ??= { score: null, ratingCount: 0, retention: null, retentionMembers: 0 });

  for (const a of aggregates) {
    if (a.rawAverage === null) continue;
    const e = entry(a.animeId);
    e.score = a.rawAverage;
    e.ratingCount = a.ratingCount;
  }

  const byAnime = new Map<string, number[]>();
  for (const r of memberRetention) {
    if (!r.animeId || r._avg.retention === null) continue;
    byAnime.set(r.animeId, [...(byAnime.get(r.animeId) ?? []), Math.round(r._avg.retention)]);
  }
  for (const [animeId, list] of byAnime) {
    const e = entry(animeId);
    e.retention = Math.round(list.reduce((sum, v) => sum + v, 0) / list.length);
    e.retentionMembers = list.length;
  }

  return out;
}
