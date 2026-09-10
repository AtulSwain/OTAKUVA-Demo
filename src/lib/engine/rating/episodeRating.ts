/**
 * OTAKUVA EPISODE RATING ENGINE
 * Handles explicit per-episode numerical ratings, micro-reviews, and deletion.
 */

import { prisma } from '../../prisma';
import { emitEngineEvent } from '../events/eventEngine';

export interface RateEpisodeInput {
  userId: string;
  animeId: string;
  episodeNumber: number;
  rating: number; // 0.0 to 10.0
  review?: string;
}

/**
 * Rates an individual episode with optional micro-review
 */
export async function rateEpisode(input: RateEpisodeInput) {
  const { userId, animeId, episodeNumber, rating, review } = input;

  if (typeof rating !== 'number' || isNaN(rating) || rating < 0 || rating > 10) {
    throw new Error('Episode rating must be between 0.0 and 10.0');
  }

  // Enforce 1 decimal place precision
  const cleanRating = Math.round(rating * 10) / 10;

  // Find or create Episode record if not present
  let episode = await prisma.episode.findFirst({
    where: { animeId, number: episodeNumber },
  });

  if (!episode) {
    episode = await prisma.episode.create({
      data: {
        animeId,
        number: episodeNumber,
        title: `Episode ${episodeNumber}`,
      },
    });
  }

  const existing = await prisma.episodeRating.findUnique({
    where: {
      userId_episodeId: {
        userId,
        episodeId: episode.id,
      },
    },
  });

  const episodeRating = await prisma.episodeRating.upsert({
    where: {
      userId_episodeId: {
        userId,
        episodeId: episode.id,
      },
    },
    update: {
      rating: cleanRating,
      review: review ? review.trim() : null,
      updatedAt: new Date(),
    },
    create: {
      userId,
      episodeId: episode.id,
      rating: cleanRating,
      review: review ? review.trim() : null,
    },
    include: {
      user: {
        select: { id: true, username: true, avatarUrl: true },
      },
      episode: true,
    },
  });

  // Emit standardized rating event
  await emitEngineEvent({
    eventType: 'EPISODE_RATED',
    userId,
    entityType: 'EPISODE',
    entityId: episode.id,
    metadata: {
      animeId,
      episodeNumber,
      rating: cleanRating,
      isUpdate: Boolean(existing),
      hasReview: Boolean(review?.trim()),
    },
  });

  return episodeRating;
}

/**
 * Deletes a user's episode rating
 */
export async function deleteEpisodeRating(userId: string, animeId: string, episodeNumber: number) {
  const episode = await prisma.episode.findFirst({
    where: { animeId, number: episodeNumber },
  });

  if (!episode) {
    return { success: false, message: 'Episode not found' };
  }

  const existing = await prisma.episodeRating.findUnique({
    where: {
      userId_episodeId: {
        userId,
        episodeId: episode.id,
      },
    },
  });

  if (!existing) {
    return { success: false, message: 'Rating not found' };
  }

  await prisma.episodeRating.delete({
    where: { id: existing.id },
  });

  await emitEngineEvent({
    eventType: 'EPISODE_RATING_DELETED',
    userId,
    entityType: 'EPISODE',
    entityId: episode.id,
    metadata: {
      animeId,
      episodeNumber,
    },
  });

  return { success: true };
}

/**
 * Get ratings and reviews for a specific episode
 */
export async function getEpisodeRatings(animeId: string, episodeNumber: number, limit = 20) {
  const episode = await prisma.episode.findFirst({
    where: { animeId, number: episodeNumber },
  });

  if (!episode) {
    return { ratings: [], averageScore: null, totalRatings: 0 };
  }

  const ratings = await prisma.episodeRating.findMany({
    where: { episodeId: episode.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { id: true, username: true, avatarUrl: true } },
    },
  });

  const total = ratings.length;
  const avg = total > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / total : null;

  return {
    ratings,
    averageScore: avg !== null ? parseFloat(avg.toFixed(2)) : null,
    totalRatings: total,
  };
}

/**
 * Get single user's rating for a specific episode
 */
export async function getUserEpisodeRating(userId: string, animeId: string, episodeNumber: number) {
  const episode = await prisma.episode.findFirst({
    where: { animeId, number: episodeNumber },
  });

  if (!episode) {
    return { hasRated: false, yourRating: null, review: null };
  }

  const rating = await prisma.episodeRating.findUnique({
    where: {
      userId_episodeId: {
        userId,
        episodeId: episode.id,
      },
    },
  });

  if (!rating) {
    return { hasRated: false, yourRating: null, review: null };
  }

  return {
    hasRated: true,
    yourRating: rating.rating,
    review: rating.review,
    updatedAt: rating.updatedAt,
  };
}
