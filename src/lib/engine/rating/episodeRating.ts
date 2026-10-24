/**
 * OTAKUVA EPISODE RATING ENGINE (compatibility layer).
 *
 * Since 2026-10-19 episode ratings live in src/lib/rating/episodeRatings.ts
 * (keyed by anime + episode number, only for aired episodes, feeding the
 * OTAKUVA Score). These functions keep the older /api/episodes/:id/* routes
 * working, but every write goes through that one path.
 */

import { prisma } from '../../prisma';
import { emitEngineEvent } from '../events/eventEngine';
import { deleteEpisodeRating as deleteByNumber, submitEpisodeRating } from '../../rating/episodeRatings';

export interface RateEpisodeInput {
  userId: string;
  animeId: string;
  episodeNumber: number;
  rating: number; // 0.5 to 10.0, 0.1 steps
  review?: string;
}

/** Rates an aired episode (with an optional short note). */
export async function rateEpisode(input: RateEpisodeInput) {
  const { userId, animeId, episodeNumber, rating, review } = input;
  const existing = await prisma.episodeRating.findFirst({ where: { userId, animeId, episodeNumber }, select: { id: true } });
  const saved = await submitEpisodeRating({ userId, animeId, episodeNumber, score: rating, note: review });

  await emitEngineEvent({
    eventType: 'EPISODE_RATED',
    userId,
    entityType: 'EPISODE',
    entityId: saved.id,
    metadata: { animeId, episodeNumber, rating: saved.score, isUpdate: Boolean(existing), hasReview: Boolean(saved.note) },
  });
  return saved;
}

/** Deletes a user's rating of one episode. */
export async function deleteEpisodeRating(userId: string, animeId: string, episodeNumber: number) {
  try {
    await deleteByNumber(userId, animeId, episodeNumber);
  } catch {
    return { success: false, message: 'Rating not found' };
  }
  await emitEngineEvent({
    eventType: 'EPISODE_RATING_DELETED',
    userId,
    entityType: 'EPISODE',
    entityId: `${animeId}:${episodeNumber}`,
    metadata: { animeId, episodeNumber },
  });
  return { success: true };
}

/** Ratings and notes for one episode. */
export async function getEpisodeRatings(animeId: string, episodeNumber: number, limit = 20) {
  const ratings = await prisma.episodeRating.findMany({
    where: { animeId, episodeNumber },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { id: true, username: true, avatarUrl: true } } },
  });
  const agg = await prisma.episodeRating.aggregate({ where: { animeId, episodeNumber }, _avg: { rating: true }, _count: true });
  return {
    ratings,
    averageScore: agg._avg.rating !== null ? parseFloat(agg._avg.rating.toFixed(2)) : null,
    totalRatings: agg._count,
  };
}

/** One user's rating of one episode. */
export async function getUserEpisodeRating(userId: string, animeId: string, episodeNumber: number) {
  const rating = await prisma.episodeRating.findFirst({ where: { userId, animeId, episodeNumber } });
  if (!rating) return { hasRated: false, yourRating: null, review: null };
  return { hasRated: true, yourRating: rating.rating, review: rating.review, updatedAt: rating.updatedAt };
}
