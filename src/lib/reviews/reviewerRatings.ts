/**
 * The score shown on a review is the reviewer's own rating of that anime
 * from the rating section (AnimeRating), not a separate number typed into
 * the review form — reviews no longer collect a score (2026-10-16). Reading
 * it live means re-rating an anime updates every review card at once.
 */

import { prisma } from '../prisma';

const key = (userId: string, animeId: string) => `${userId}:${animeId}`;

/**
 * A reviewer's score for each anime, same rule as the OTAKUVA Score: their
 * overall rating of the anime; only when they have none, the average of the
 * legacy per-episode scores they gave (episodes are rated by retention % since
 * 2026-10-20, which never feeds the anime score). Two queries for a whole page
 * of reviews. Missing key = they haven't rated it.
 */
export async function getReviewerRatings(pairs: Array<{ userId: string; animeId: string }>): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (pairs.length === 0) return out;
  const userIds = Array.from(new Set(pairs.map((p) => p.userId)));
  const animeIds = Array.from(new Set(pairs.map((p) => p.animeId)));
  const rows = await prisma.animeRating.findMany({
    where: { deletedAt: null, userId: { in: userIds }, animeId: { in: animeIds } },
    select: { userId: true, animeId: true, rating: true },
  });
  for (const r of rows) out.set(key(r.userId, r.animeId), r.rating);
  const episodeAverages = await prisma.episodeRating.groupBy({
    by: ['userId', 'animeId'],
    where: { userId: { in: userIds }, animeId: { in: animeIds }, episodeNumber: { not: null }, rating: { not: null } },
    _avg: { rating: true },
  });
  for (const e of episodeAverages) {
    if (e.animeId && e._avg.rating !== null && !out.has(key(e.userId, e.animeId))) {
      out.set(key(e.userId, e.animeId), Math.round(e._avg.rating * 10) / 10);
    }
  }
  return out;
}

export function reviewerRatingFrom(map: Map<string, number>, userId: string, animeId: string): number | null {
  return map.get(key(userId, animeId)) ?? null;
}

/** Snapshot stored on Review.rating at write time, so sorting reviews by score keeps working. */
export async function currentRating(userId: string, animeId: string): Promise<number | null> {
  const row = await prisma.animeRating.findUnique({
    where: { userId_animeId: { userId, animeId } },
    select: { rating: true, deletedAt: true },
  });
  if (row && !row.deletedAt) return row.rating;
  const episodes = await prisma.episodeRating.aggregate({
    where: { userId, animeId, episodeNumber: { not: null }, rating: { not: null } },
    _avg: { rating: true },
  });
  return episodes._avg.rating !== null ? Math.round(episodes._avg.rating * 10) / 10 : null;
}
