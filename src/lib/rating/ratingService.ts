/**
 * OTAKUVA Proprietary Rating Service
 * 
 * Manages transactional rating submissions, category scores, audit events,
 * aggregate computations, and anti-abuse signal detection.
 */

import { prisma } from '../prisma';
import { emitEngineEvent } from '../engine/events/eventEngine';
import {
  RATING_ALGORITHM_VERSION,
  RATING_CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_EXPLANATION_TEXT,
  RatingCategoryType,
  RatingSummaryResult,
  calculateRawAverage,
  calculateMedian,
  calculateVariance,
  calculateStandardDeviation,
  calculateConfidence,
  calculateBayesianScore,
  calculateDistribution,
  calculateCategoryPercentages,
} from './ratingEngine';

export interface SubmitRatingInput {
  userId: string;
  animeId: string;
  score: number; // 0.5 - 10.0, 0.5 increment
  categoryScores?: Partial<Record<RatingCategoryType, number>>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Validates rating score constraints (0.5 to 10.0, 0.5 precision)
 */
export function validateRatingScore(score: number): { valid: boolean; error?: string; normalized: number } {
  if (typeof score !== 'number' || isNaN(score)) {
    return { valid: false, error: 'Rating must be a valid number.', normalized: 0 };
  }
  if (score < 0.5 || score > 10.0) {
    return { valid: false, error: 'Rating must be between 0.5 and 10.0.', normalized: 0 };
  }
  // Enforce 0.5 step increments (e.g. 7.5, 8.0, 8.5)
  const normalized = Math.round(score * 2) / 2;
  if (Math.abs(score - normalized) > 0.001) {
    return { valid: false, error: 'Rating must be in increments of 0.5 (e.g., 7.5, 8.0, 8.5).', normalized };
  }
  return { valid: true, normalized };
}

/**
 * Submits or updates a user rating with optional category ratings atomically
 */
export async function submitUserRating(input: SubmitRatingInput) {
  const { userId, animeId, score, categoryScores, ipAddress, userAgent } = input;

  const scoreValidation = validateRatingScore(score);
  if (!scoreValidation.valid) {
    throw new Error(scoreValidation.error);
  }
  const cleanScore = scoreValidation.normalized;

  // Validate category ratings if provided
  const cleanCategoryScores: { category: RatingCategoryType; score: number }[] = [];
  if (categoryScores && typeof categoryScores === 'object') {
    for (const cat of RATING_CATEGORIES) {
      const val = categoryScores[cat];
      if (typeof val === 'number' && !isNaN(val)) {
        const catVal = validateRatingScore(val);
        if (!catVal.valid) {
          throw new Error(`Invalid category score for ${CATEGORY_LABELS[cat]}: ${catVal.error}`);
        }
        cleanCategoryScores.push({ category: cat, score: catVal.normalized });
      }
    }
  }

  // Check existing rating for audit log previous value
  const existingRating = await prisma.animeRating.findUnique({
    where: { userId_animeId: { userId, animeId } },
    include: { categoryScores: true },
  });

  const isUpdate = Boolean(existingRating && !existingRating.deletedAt);
  const previousScore = existingRating && !existingRating.deletedAt ? existingRating.rating : null;
  const eventType = isUpdate ? 'UPDATED' : 'CREATED';

  // Execute database transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Upsert AnimeRating
    const rating = await tx.animeRating.upsert({
      where: { userId_animeId: { userId, animeId } },
      create: {
        userId,
        animeId,
        rating: cleanScore,
        deletedAt: null,
      },
      update: {
        rating: cleanScore,
        deletedAt: null,
        updatedAt: new Date(),
      },
    });

    // 2. Upsert Category Ratings if provided
    for (const catItem of cleanCategoryScores) {
      await tx.ratingCategoryScore.upsert({
        where: {
          ratingId_category: {
            ratingId: rating.id,
            category: catItem.category,
          },
        },
        create: {
          ratingId: rating.id,
          category: catItem.category,
          score: catItem.score,
        },
        update: {
          score: catItem.score,
          updatedAt: new Date(),
        },
      });
    }

    // 3. Create Immutable Audit Event
    await tx.ratingEvent.create({
      data: {
        ratingId: rating.id,
        userId,
        animeId,
        previousScore,
        newScore: cleanScore,
        eventType,
        categoryScoresJson: cleanCategoryScores.length > 0 ? JSON.stringify(cleanCategoryScores) : null,
        ipHash: ipAddress ? ipAddress.slice(0, 32) : null,
        userAgent: userAgent ? userAgent.slice(0, 255) : null,
      },
    });

    // 4. Update UserAnime library state if user has it tracked
    const existingUserAnime = await tx.userAnime.findUnique({
      where: { userId_animeId: { userId, animeId } },
    });
    if (existingUserAnime) {
      await tx.userAnime.update({
        where: { userId_animeId: { userId, animeId } },
        data: { score: cleanScore },
      });
    }

    return rating;
  });

  // Recompute statistical aggregates asynchronously
  await recalculateAnimeAggregates(animeId);

  // Emit standardized Engine event
  await emitEngineEvent({
    eventType: isUpdate ? 'RATING_UPDATED' : 'RATING_CREATED',
    userId,
    entityType: 'ANIME',
    entityId: animeId,
    metadata: {
      score: cleanScore,
      previousScore,
      categoryScores: cleanCategoryScores,
    },
  });

  if (cleanCategoryScores.length > 0) {
    await emitEngineEvent({
      eventType: isUpdate ? 'ASPECT_RATING_UPDATED' : 'ASPECT_RATING_CREATED',
      userId,
      entityType: 'ANIME',
      entityId: animeId,
      metadata: {
        categoryScores: cleanCategoryScores,
      },
    });
  }

  // Background Anti-Abuse Signal Check
  await detectRatingAnomalies(userId, animeId, cleanScore);

  return result;
}

/**
 * Deletes / soft-deletes a user rating and recalculates community aggregates
 */
export async function deleteUserRating(userId: string, animeId: string) {
  const existing = await prisma.animeRating.findUnique({
    where: { userId_animeId: { userId, animeId } },
  });

  if (!existing || existing.deletedAt) {
    return { success: false, message: 'Rating not found or already deleted.' };
  }

  await prisma.$transaction(async (tx) => {
    // 1. Soft-delete AnimeRating
    await tx.animeRating.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    // 2. Log Audit Event
    await tx.ratingEvent.create({
      data: {
        ratingId: existing.id,
        userId,
        animeId,
        previousScore: existing.rating,
        newScore: 0,
        eventType: 'DELETED',
      },
    });

    // 3. Update UserAnime library state
    const userAnime = await tx.userAnime.findUnique({
      where: { userId_animeId: { userId, animeId } },
    });
    if (userAnime) {
      await tx.userAnime.update({
        where: { userId_animeId: { userId, animeId } },
        data: { score: null },
      });
    }
  });

  // Recalculate aggregates
  await recalculateAnimeAggregates(animeId);

  // Emit standardized Engine event
  await emitEngineEvent({
    eventType: 'RATING_DELETED',
    userId,
    entityType: 'ANIME',
    entityId: animeId,
    metadata: {
      deletedScore: existing.rating,
    },
  });

  return { success: true };
}

/**
 * Retrieves the authenticated user's rating & category breakdown
 */
export async function getUserRating(userId: string, animeId: string) {
  const rating = await prisma.animeRating.findFirst({
    where: {
      userId,
      animeId,
      deletedAt: null,
    },
    include: {
      categoryScores: true,
    },
  });

  if (!rating) {
    return { hasRated: false, yourRating: null, yourCategoryRatings: {} };
  }

  const yourCategoryRatings: Partial<Record<RatingCategoryType, number>> = {};
  rating.categoryScores.forEach((cs) => {
    yourCategoryRatings[cs.category as RatingCategoryType] = cs.score;
  });

  return {
    hasRated: true,
    yourRating: rating.rating,
    yourCategoryRatings,
    updatedAt: rating.updatedAt.toISOString(),
  };
}

/**
 * Recalculates all canonical statistical aggregates for an anime
 */
export async function recalculateAnimeAggregates(animeId: string): Promise<RatingSummaryResult> {
  // 1. Calculate Global Average (C) across all valid active ratings in OTAKUVA
  const allValidRatings = await prisma.animeRating.findMany({
    where: { deletedAt: null },
    select: { rating: true },
  });
  const globalAverage =
    allValidRatings.length > 0
      ? calculateRawAverage(allValidRatings.map((r) => r.rating)) || 7.5
      : 7.5;

  // 2. Fetch all valid ratings for this anime
  const animeRatings = await prisma.animeRating.findMany({
    where: {
      animeId,
      deletedAt: null,
    },
    include: {
      categoryScores: true,
    },
  });

  const scores = animeRatings.map((r) => r.rating);
  const ratingCount = scores.length;
  const rawAverage = calculateRawAverage(scores);
  const median = calculateMedian(scores);
  const variance = calculateVariance(scores, rawAverage);
  const standardDeviation = calculateStandardDeviation(variance);
  const confidence = calculateConfidence(ratingCount);
  const bayesianScore = calculateBayesianScore(rawAverage, ratingCount, globalAverage, 25);
  const distribution = calculateDistribution(scores);

  // 3. Upsert Overall RatingAggregate
  await prisma.ratingAggregate.upsert({
    where: { animeId },
    create: {
      animeId,
      ratingCount,
      rawAverage,
      medianScore: median,
      bayesianScore,
      variance,
      standardDeviation,
      confidence,
      distributionJson: JSON.stringify(distribution),
      algorithmVersion: RATING_ALGORITHM_VERSION,
    },
    update: {
      ratingCount,
      rawAverage,
      medianScore: median,
      bayesianScore,
      variance,
      standardDeviation,
      confidence,
      distributionJson: JSON.stringify(distribution),
      algorithmVersion: RATING_ALGORITHM_VERSION,
      updatedAt: new Date(),
    },
  });

  // 4. Update canonical Anime record score & scoredBy
  if (bayesianScore !== null) {
    await prisma.anime.update({
      where: { id: animeId },
      data: {
        score: bayesianScore,
        scoredBy: ratingCount,
      },
    }).catch(() => {});
  }

  // 5. Compute Category Aggregates
  const categoryScoresMap: Record<RatingCategoryType, number[]> = {} as any;
  for (const cat of RATING_CATEGORIES) {
    categoryScoresMap[cat] = [];
  }

  animeRatings.forEach((r) => {
    r.categoryScores.forEach((cs) => {
      const cat = cs.category as RatingCategoryType;
      if (categoryScoresMap[cat]) {
        categoryScoresMap[cat].push(cs.score);
      }
    });
  });

  // Calculate category averages
  const activeCategoryAverages: { category: RatingCategoryType; average: number }[] = [];
  const rawCategoryStats: Record<
    RatingCategoryType,
    {
      responseCount: number;
      average: number | null;
      median: number | null;
      variance: number | null;
      stdDev: number | null;
      confidence: ReturnType<typeof calculateConfidence>;
    }
  > = {} as any;

  for (const cat of RATING_CATEGORIES) {
    const catScores = categoryScoresMap[cat];
    const catCount = catScores.length;
    const catAvg = calculateRawAverage(catScores);
    const catMed = calculateMedian(catScores);
    const catVar = calculateVariance(catScores, catAvg);
    const catStd = calculateStandardDeviation(catVar);
    const catConf = calculateConfidence(catCount);

    rawCategoryStats[cat] = {
      responseCount: catCount,
      average: catAvg,
      median: catMed,
      variance: catVar,
      stdDev: catStd,
      confidence: catConf,
    };

    if (catAvg !== null && catCount > 0) {
      activeCategoryAverages.push({ category: cat, average: catAvg });
    }
  }

  // Calculate normalized Hare-Niemeyer category percentages (summing to strictly 100%)
  const normalizedPercentages = calculateCategoryPercentages(activeCategoryAverages);
  const percentageMap = new Map<RatingCategoryType, number>();
  normalizedPercentages.forEach((p) => percentageMap.set(p.category, p.percentage));

  // Upsert each category aggregate in database
  const categoriesResult: RatingSummaryResult['categories'] = [];

  for (const cat of RATING_CATEGORIES) {
    const stats = rawCategoryStats[cat];
    const pct = percentageMap.get(cat) || 0;

    await prisma.ratingCategoryAggregate.upsert({
      where: {
        animeId_category: {
          animeId,
          category: cat,
        },
      },
      create: {
        animeId,
        category: cat,
        responseCount: stats.responseCount,
        averageScore: stats.average,
        medianScore: stats.median,
        variance: stats.variance,
        standardDeviation: stats.stdDev,
        percentageShare: pct,
        confidence: stats.confidence,
      },
      update: {
        responseCount: stats.responseCount,
        averageScore: stats.average,
        medianScore: stats.median,
        variance: stats.variance,
        standardDeviation: stats.stdDev,
        percentageShare: pct,
        confidence: stats.confidence,
        updatedAt: new Date(),
      },
    });

    if (stats.average !== null) {
      categoriesResult.push({
        category: cat,
        label: CATEGORY_LABELS[cat],
        averageScore: stats.average,
        percentage: pct,
        responseCount: stats.responseCount,
        confidence: stats.confidence,
      });
    }
  }

  const categoryPercentageTotal = categoriesResult.reduce((sum, c) => sum + c.percentage, 0);

  return {
    score: bayesianScore,
    ratingCount,
    rawAverage,
    median,
    variance,
    standardDeviation,
    confidence,
    distribution,
    categories: categoriesResult,
    categoryPercentageTotal: categoriesResult.length > 0 ? categoryPercentageTotal : 0,
    algorithmVersion: RATING_ALGORITHM_VERSION,
    explanatoryNote: CATEGORY_EXPLANATION_TEXT,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Retrieves the canonical public rating summary for an anime
 */
export async function getRatingSummary(animeId: string): Promise<RatingSummaryResult> {
  return await recalculateAnimeAggregates(animeId);
}

export const getAnimeRatingSummary = getRatingSummary;

/**
 * Anomaly and anti-abuse signal detection
 */
async function detectRatingAnomalies(userId: string, animeId: string, score: number) {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentRatingsByUser = await prisma.ratingEvent.count({
      where: {
        userId,
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    // Velocity spike check (>15 ratings in 5 minutes by one user)
    if (recentRatingsByUser > 15) {
      await prisma.ratingRiskSignal.create({
        data: {
          userId,
          animeId,
          riskScore: 0.85,
          signalType: 'VELOCITY_SPIKE',
          detailsJson: JSON.stringify({
            recentRatingsCount: recentRatingsByUser,
            timeWindow: '5m',
            scoreSubmitted: score,
          }),
          status: 'PENDING',
        },
      });
    }
  } catch (err) {
    // Non-blocking anti-abuse check
    console.error('Error running anomaly check:', err);
  }
}
