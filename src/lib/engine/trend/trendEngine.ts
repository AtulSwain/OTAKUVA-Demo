/**
 * OTAKUVA TREND & MOMENTUM ENGINE
 * Distinguishes POPULAR, TRENDING, and RISING anime using velocity, growth rate, and time-decay momentum.
 */

import { prisma } from '../../prisma';
import { TREND_CONFIG } from '../config';

export interface TrendCalculationResult {
  animeId: string;
  interactionVolume: number;
  interactionVelocity: number;
  growthRatePercent: number;
  momentumScore: number;
  trendTier: 'POPULAR' | 'TRENDING' | 'RISING';
}

/**
 * Calculates trend metrics and momentum for all active anime
 */
export async function calculateAnimeTrends(): Promise<TrendCalculationResult[]> {
  const now = new Date();
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const animeList = await prisma.anime.findMany({
    take: 100,
    select: {
      id: true,
      canonicalTitle: true,
      score: true,
      popularity: true,
      _count: {
        select: {
          ratings: true,
          reviews: true,
          userAnimes: true,
          discussions: true,
        },
      },
    },
  });

  const results: TrendCalculationResult[] = [];

  for (const a of animeList) {
    const totalVolume =
      (a._count.ratings || 0) * 3 +
      (a._count.reviews || 0) * 4 +
      (a._count.userAnimes || 0) * 2 +
      (a._count.discussions || 0) * 3;

    // Recent events in last 48h
    const recentEventsCount = await prisma.eventLog.count({
      where: {
        entityId: a.id,
        createdAt: { gte: fortyEightHoursAgo },
      },
    });

    // Prior baseline events between 7 days ago and 48h ago
    const priorEventsCount = await prisma.eventLog.count({
      where: {
        entityId: a.id,
        createdAt: { gte: sevenDaysAgo, lt: fortyEightHoursAgo },
      },
    });

    // Interaction Velocity = recent events / 2 days
    const interactionVelocity = parseFloat((recentEventsCount / 2.0).toFixed(2));

    // Growth Rate = ((recent - prior_daily) / prior_daily) * 100
    const priorDailyRate = Math.max(1.0, priorEventsCount / 5.0);
    const growthRatePercent = parseFloat((((interactionVelocity - priorDailyRate) / priorDailyRate) * 100).toFixed(1));

    // Momentum Score combines velocity + growth rate + baseline quality
    const momentumScore = parseFloat((interactionVelocity * 1.5 + Math.max(0, growthRatePercent) * 0.1).toFixed(2));

    // Determine Tier
    let trendTier: 'POPULAR' | 'TRENDING' | 'RISING' = 'POPULAR';
    if (growthRatePercent >= TREND_CONFIG.MOMENTUM_GROWTH_THRESHOLD_RISING && recentEventsCount >= 3) {
      trendTier = 'RISING';
    } else if (interactionVelocity >= 2.0 || recentEventsCount >= TREND_CONFIG.MIN_VOLUME_FOR_TRENDING) {
      trendTier = 'TRENDING';
    } else {
      trendTier = 'POPULAR';
    }

    // Persist in AnimeTrendMetric
    await prisma.animeTrendMetric.upsert({
      where: { animeId: a.id },
      update: {
        interactionVolume: totalVolume,
        interactionVelocity,
        growthRatePercent,
        momentumScore,
        trendTier,
        timeDecayScore: interactionVelocity,
        updatedAt: now,
      },
      create: {
        animeId: a.id,
        interactionVolume: totalVolume,
        interactionVelocity,
        growthRatePercent,
        momentumScore,
        trendTier,
        timeDecayScore: interactionVelocity,
      },
    });

    results.push({
      animeId: a.id,
      interactionVolume: totalVolume,
      interactionVelocity,
      growthRatePercent,
      momentumScore,
      trendTier,
    });
  }

  return results;
}

/**
 * Returns categorized lists: Popular, Trending, and Rising titles
 */
export async function getCategorizedTrends() {
  const [popular, trending, rising] = await Promise.all([
    prisma.animeTrendMetric.findMany({
      where: { trendTier: 'POPULAR' },
      orderBy: { interactionVolume: 'desc' },
      take: 10,
      include: {
        anime: {
          select: { id: true, canonicalTitle: true, slug: true, posterUrl: true, score: true, year: true, type: true },
        },
      },
    }),
    prisma.animeTrendMetric.findMany({
      where: { trendTier: 'TRENDING' },
      orderBy: { interactionVelocity: 'desc' },
      take: 10,
      include: {
        anime: {
          select: { id: true, canonicalTitle: true, slug: true, posterUrl: true, score: true, year: true, type: true },
        },
      },
    }),
    prisma.animeTrendMetric.findMany({
      where: { trendTier: 'RISING' },
      orderBy: { momentumScore: 'desc' },
      take: 10,
      include: {
        anime: {
          select: { id: true, canonicalTitle: true, slug: true, posterUrl: true, score: true, year: true, type: true },
        },
      },
    }),
  ]);

  return { popular, trending, rising };
}
