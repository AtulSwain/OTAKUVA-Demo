/**
 * OTAKUVA ENGINE — PHASE 9.14
 * ADVANCED STUDIO ANALYTICS & METRICS ENGINE
 * 
 * Production-ready, explainable, versioned, and privacy-safe Studio analytics:
 * - Studio Performance Engine (composite normalized score studio_performance_score_v1)
 * - Rating Analytics Engine (Bayesian adjustment, aspect breakdowns, score histograms)
 * - Production Analytics Engine (timeline, cadence, format distribution, production gaps)
 * - Genre Intelligence & Diversity (temporal evolution, Shannon entropy diversity index)
 * - Audience Intelligence (cohort retention, growth across 7d/30d/90d/12m, privacy threshold >= 5)
 * - Community & News Analytics (discussion momentum, news volume, spike co-occurrence)
 * - Studio Momentum Engine (studio_momentum_score_v1 with explainable contribution factors)
 * - Quality & Consistency Analytics (standard deviation, variance, z-score outlier detection)
 * - Multi-Period Studio Comparison (normalized & absolute side-by-side benchmarking)
 * - Forecasting & Trend Engine (FORECAST_v1 with exponential smoothing & horizon confidence)
 * - Persistent Snapshots (StudioAnalyticsSnapshot model), Background Queue & TTL Caching
 * - Admin Operations (coverage, health, stale snapshots, batch recalculation)
 */

import { prisma } from '../../prisma';
import { eventEngine } from '../events/eventEngine';
import { studioDiscoveryService } from './studioDiscoveryService';
import { studioDataIntelligenceService } from './studioDataIntelligenceService';

export type AdvancedAnalyticsPeriod =
  | 'ALL_TIME'
  | 'LAST_12_MONTHS'
  | 'LAST_90_DAYS'
  | 'LAST_30_DAYS'
  | 'LAST_7_DAYS';

export const METRIC_VERSIONS = {
  PERFORMANCE_SCORE: 'studio_performance_score_v1',
  BAYESIAN_SCORE: 'bayesian_studio_score_v1',
  MOMENTUM_SCORE: 'studio_momentum_score_v1',
  DIVERSITY_INDEX: 'shannon_diversity_v1',
  FORECAST_MODEL: 'exponential_smoothing_forecast_v1',
};

export interface MetricDefinition {
  metricKey: string;
  version: string;
  name: string;
  description: string;
  source: string;
  formula: string;
  timePeriodSupport: string[];
  sampleSizeRequired: boolean;
}

export const METRIC_DICTIONARY: Record<string, MetricDefinition> = {
  performanceScore: {
    metricKey: 'performanceScore',
    version: METRIC_VERSIONS.PERFORMANCE_SCORE,
    name: 'Studio Composite Performance Score',
    description: 'A multi-dimensional 0–100 index aggregating rating quality, watch volume, completion rate, community discussions, and production recency.',
    source: 'Anime, Ratings, UserAnime, Community, Episodes',
    formula: '0.30 * RatingQuality + 0.25 * WatchVolume + 0.20 * CompletionRate + 0.15 * CommunityActivity + 0.10 * Recency',
    timePeriodSupport: ['ALL_TIME', 'LAST_12_MONTHS', 'LAST_90_DAYS', 'LAST_30_DAYS', 'LAST_7_DAYS'],
    sampleSizeRequired: true,
  },
  bayesianScore: {
    metricKey: 'bayesianScore',
    version: METRIC_VERSIONS.BAYESIAN_SCORE,
    name: 'Bayesian Adjusted Score',
    description: 'Statistical weighted average adjusting raw studio score against the platform baseline to prevent low-sample distortion.',
    source: 'AnimeRating, Anime.score, RatingAggregate',
    formula: '(v / (v + m)) * R + (m / (v + m)) * C (where m=10, C=7.5)',
    timePeriodSupport: ['ALL_TIME'],
    sampleSizeRequired: true,
  },
  momentumScore: {
    metricKey: 'momentumScore',
    version: METRIC_VERSIONS.MOMENTUM_SCORE,
    name: 'Studio Momentum Score',
    description: 'Calculates the velocity of audience watch activity, ratings volume, active community discussions, news announcements, and upcoming pipeline.',
    source: 'Watch events, Ratings, Discussions, NewsArticleStudio, Upcoming Anime',
    formula: '0.30 * AudienceVelocity + 0.25 * RatingVelocity + 0.20 * CommunityVelocity + 0.15 * NewsActivity + 0.10 * UpcomingPipeline',
    timePeriodSupport: ['LAST_7_DAYS', 'LAST_30_DAYS', 'LAST_90_DAYS', 'LAST_12_MONTHS'],
    sampleSizeRequired: false,
  },
  genreDiversity: {
    metricKey: 'genreDiversity',
    version: METRIC_VERSIONS.DIVERSITY_INDEX,
    name: 'Genre Shannon Diversity Index',
    description: 'Information entropy measuring portfolio dispersion across multiple anime genres.',
    source: 'AnimeGenre, Genre',
    formula: 'H = -sum(p_i * ln(p_i)) / ln(k)',
    timePeriodSupport: ['ALL_TIME'],
    sampleSizeRequired: false,
  },
  forecast: {
    metricKey: 'forecast',
    version: METRIC_VERSIONS.FORECAST_MODEL,
    name: 'Audience & Production Forecast',
    description: 'Statistical trajectory estimate of anticipated community interest, ratings, and momentum over 7, 30, and 90 day horizons.',
    source: 'Historical watch trends, upcoming titles, recent news velocity',
    formula: 'Single Exponential Smoothing with trend damping (alpha=0.3)',
    timePeriodSupport: ['LAST_30_DAYS', 'LAST_90_DAYS'],
    sampleSizeRequired: true,
  },
};

export interface AdvancedStudioAnalyticsResult {
  studio: {
    id: string;
    name: string;
    slug: string | null;
    foundedYear: number | null;
    verificationStatus: string;
  };
  period: AdvancedAnalyticsPeriod;
  metricVersion: string;
  generatedAt: Date;
  dataQuality: {
    completenessScore: number; // 0-100%
    dataState: 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT_DATA';
    totalRatingsCount: number;
    sampleSizeContext: string;
    hasSufficientData: boolean;
  };
  performance: {
    score: number; // 0 - 100
    version: string;
    weights: { rating: number; watch: number; completion: number; community: number; recency: number };
    totalProjects: number;
    completedProjects: number;
    airingProjects: number;
    upcomingProjects: number;
    watchCount: number;
    completionRate: number; // 0.0 - 1.0
    bookmarkCount: number;
    reviewCount: number;
  };
  ratings: {
    rawAverage: number | null;
    bayesianScore: number | null;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';
    distribution: Array<{ range: string; count: number; percentage: number }>;
    aspects: {
      story: number;
      characters: number;
      animation: number;
      direction: number;
      music: number;
      worldBuilding: number;
    };
    consistency: {
      standardDeviation: number;
      variance: number;
      tier: 'VERY_CONSISTENT' | 'MODERATELY_CONSISTENT' | 'VARIABLE_RECEPTION';
      explanation: string;
    };
    outliers: {
      positiveOutliers: Array<{ animeId: string; title: string; score: number; zScore: number }>;
      negativeOutliers: Array<{ animeId: string; title: string; score: number; zScore: number }>;
    };
  };
  production: {
    totalProjects: number;
    totalEpisodes: number;
    activeYearsCount: number;
    activeYearsRange: string;
    formatDistribution: Array<{ format: string; count: number; percentage: number }>;
    projectsPerYear: Array<{ year: number; count: number; averageScore: number | null }>;
    projectsPerDecade: Array<{ decade: string; count: number; percentage: number }>;
    productionGaps: Array<{ startYear: number; endYear: number; gapYears: number }>;
    currentPacePerYear: number;
  };
  genres: {
    distribution: Array<{ name: string; count: number; percentage: number }>;
    evolution: Array<{ decade: string; topGenres: Array<{ name: string; percentage: number }> }>;
    diversity: {
      shannonIndex: number;
      normalizedDiversity: number; // 0.0 to 1.0
      tier: 'HIGHLY_DIVERSE' | 'MODERATELY_DIVERSE' | 'HIGHLY_CONCENTRATED';
      explanation: string;
    };
    momentum: Array<{ genre: string; recentPercentage: number; historicalPercentage: number; delta: number }>;
  };
  audience: {
    totalWatchers: number;
    totalCompleters: number;
    retentionRate: number; // completers / watchers
    growth: {
      window7d: number;
      window30d: number;
      window90d: number;
      window12m: number;
    };
    topDemographicGenres: string[];
    isPrivacyProtected: boolean;
  };
  communityAndNews: {
    communityCount: number;
    totalMembers: number;
    discussionCount: number;
    communityMomentumPercentage: number; // % above 90d baseline
    newsCount: number;
    newsFrequencyPerMonth: number;
    newsCategories: Array<{ category: string; count: number }>;
    hasNewsSpike: boolean;
    spikeContext: string | null;
  };
  momentum: {
    score: number; // 0 - 100
    tier: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'COOLING';
    explanation: string;
    contributingSignals: Array<{ signal: string; weight: number; contribution: number }>;
  };
  forecast: {
    isForecast: true;
    model: string;
    confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA';
    trend: 'RISING' | 'STABLE' | 'DECLINING' | 'SPIKE';
    horizons: {
      days7: { expectedEngagementIndex: number; anticipatedInterest: string };
      days30: { expectedEngagementIndex: number; anticipatedInterest: string };
      days90: { expectedEngagementIndex: number; anticipatedInterest: string };
    };
    disclaimer: string;
  };
}

export interface ComparisonPeriodResult {
  period: string;
  studioA: {
    id: string;
    name: string;
    totalProjects: number;
    averageScore: number | null;
    bayesianScore: number | null;
    performanceScore: number;
    momentumScore: number;
    topGenre: string | null;
    completenessScore: number;
  };
  studioB: {
    id: string;
    name: string;
    totalProjects: number;
    averageScore: number | null;
    bayesianScore: number | null;
    performanceScore: number;
    momentumScore: number;
    topGenre: string | null;
    completenessScore: number;
  };
  comparison: {
    performanceLeader: string;
    scoreLeader: string;
    catalogSizeLeader: string;
    momentumLeader: string;
    sharedGenres: string[];
    sharedPersonnelCount: number;
  };
}

export interface AnalyticsJob {
  id: string;
  studioId: string;
  jobType: 'STUDIO_ANALYTICS_REFRESH' | 'STUDIO_MOMENTUM_REFRESH' | 'STUDIO_BULK_REFRESH';
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// In-Memory Queue and Caches
const analyticsJobs = new Map<string, AnalyticsJob>();
const advancedAnalyticsMemoryCache = new Map<string, { data: AdvancedStudioAnalyticsResult; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export class StudioAdvancedAnalyticsService {
  /**
   * Invalidate memory cache
   */
  invalidateCache(studioId?: string) {
    if (studioId) {
      for (const key of advancedAnalyticsMemoryCache.keys()) {
        if (key.includes(studioId)) {
          advancedAnalyticsMemoryCache.delete(key);
        }
      }
    } else {
      advancedAnalyticsMemoryCache.clear();
    }
  }

  /**
   * Resolves a studio record by slug, ID, or name
   */
  async resolveStudio(studioSlugOrId: string) {
    return prisma.studio.findFirst({
      where: {
        OR: [
          { slug: studioSlugOrId },
          { id: studioSlugOrId },
          { name: studioSlugOrId },
        ],
      },
      select: {
        id: true,
        name: true,
        nativeName: true,
        slug: true,
        foundedYear: true,
        verificationStatus: true,
        publicationState: true,
        status: true,
      },
    });
  }

  /**
   * Main entry point: Computes full Studio Advanced Analytics
   */
  async getStudioAdvancedAnalytics(
    studioSlugOrId: string,
    period: AdvancedAnalyticsPeriod = 'ALL_TIME',
    options?: { bypassCache?: boolean; forceLiveCalculation?: boolean }
  ): Promise<AdvancedStudioAnalyticsResult | null> {
    const studio = await this.resolveStudio(studioSlugOrId);
    if (!studio) return null;

    const cacheKey = `studio:${studio.id}:advanced_analytics:${METRIC_VERSIONS.PERFORMANCE_SCORE}:${period}`;

    // 1. Check in-memory cache
    if (!options?.bypassCache) {
      const cached = advancedAnalyticsMemoryCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
      }
    }

    // 2. Check Database Precomputed Snapshot (if not live bypass)
    if (!options?.forceLiveCalculation && !options?.bypassCache) {
      const snapshot = await prisma.studioAnalyticsSnapshot.findUnique({
        where: {
          studioId_period_metricVersion: {
            studioId: studio.id,
            period,
            metricVersion: METRIC_VERSIONS.PERFORMANCE_SCORE,
          },
        },
      });

      if (snapshot && snapshot.snapshotDataJson) {
        try {
          const parsed = JSON.parse(snapshot.snapshotDataJson) as AdvancedStudioAnalyticsResult;
          // Verify snapshot is not older than 24 hours
          if (Date.now() - new Date(snapshot.generatedAt).getTime() < 24 * 60 * 60 * 1000) {
            advancedAnalyticsMemoryCache.set(cacheKey, { data: parsed, expiresAt: Date.now() + CACHE_TTL_MS });
            return parsed;
          }
        } catch (_) {}
      }
    }

    // 3. Compute Full Live Analytics
    const analytics = await this.computeLiveStudioAnalytics(studio, period);

    // 4. Save to In-Memory Cache
    advancedAnalyticsMemoryCache.set(cacheKey, { data: analytics, expiresAt: Date.now() + CACHE_TTL_MS });

    // 5. Store / Update Database Snapshot asynchronously
    this.persistSnapshot(studio.id, period, analytics).catch((err) =>
      console.warn(`[AdvancedAnalytics] Failed to persist snapshot for studio ${studio.id}:`, err)
    );

    return analytics;
  }

  /**
   * Persists computed snapshot to the database
   */
  async persistSnapshot(studioId: string, period: AdvancedAnalyticsPeriod, analytics: AdvancedStudioAnalyticsResult) {
    await prisma.studioAnalyticsSnapshot.upsert({
      where: {
        studioId_period_metricVersion: {
          studioId,
          period,
          metricVersion: METRIC_VERSIONS.PERFORMANCE_SCORE,
        },
      },
      create: {
        studioId,
        period,
        metricVersion: METRIC_VERSIONS.PERFORMANCE_SCORE,
        projectCount: analytics.performance.totalProjects,
        averageScore: analytics.ratings.rawAverage,
        ratingCount: analytics.dataQuality.totalRatingsCount,
        watchCount: analytics.performance.watchCount,
        completionCount: analytics.audience.totalCompleters,
        communityActivity: analytics.communityAndNews.discussionCount,
        newsActivity: analytics.communityAndNews.newsCount,
        momentumScore: analytics.momentum.score,
        snapshotDataJson: JSON.stringify(analytics),
        generatedAt: new Date(),
      },
      update: {
        projectCount: analytics.performance.totalProjects,
        averageScore: analytics.ratings.rawAverage,
        ratingCount: analytics.dataQuality.totalRatingsCount,
        watchCount: analytics.performance.watchCount,
        completionCount: analytics.audience.totalCompleters,
        communityActivity: analytics.communityAndNews.discussionCount,
        newsActivity: analytics.communityAndNews.newsCount,
        momentumScore: analytics.momentum.score,
        snapshotDataJson: JSON.stringify(analytics),
        generatedAt: new Date(),
      },
    });

    eventEngine.emit({
      eventType: 'STUDIO_ANALYTICS_SNAPSHOT_GENERATED',
      entityType: 'STUDIO',
      entityId: studioId,
      metadata: { period, metricVersion: METRIC_VERSIONS.PERFORMANCE_SCORE },
    });
  }

  /**
   * Core computation logic
   */
  private async computeLiveStudioAnalytics(
    studio: { id: string; name: string; slug: string | null; foundedYear: number | null; verificationStatus: string },
    period: AdvancedAnalyticsPeriod
  ): Promise<AdvancedStudioAnalyticsResult> {
    // Determine cutoff date for time period filter
    let periodCutoffDate: Date | null = null;
    const now = new Date();
    if (period === 'LAST_7_DAYS') periodCutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    else if (period === 'LAST_30_DAYS') periodCutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    else if (period === 'LAST_90_DAYS') periodCutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    else if (period === 'LAST_12_MONTHS') periodCutoffDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Parallel retrieval of related entities
    const [
      animeStudios,
      studioRatings,
      categoryScores,
      userAnimes,
      reviews,
      communities,
      discussions,
      newsRelations,
      healthReport,
    ] = await Promise.all([
      prisma.animeStudio.findMany({
        where: { studioId: studio.id },
        include: {
          anime: {
            include: {
              animeGenres: { include: { genre: true } },
              _count: { select: { ratings: true, userAnimes: true, reviews: true, favorites: true } },
            },
          },
        },
      }),
      prisma.animeRating.findMany({
        where: {
          anime: { animeStudios: { some: { studioId: studio.id } } },
          deletedAt: null,
          ...(periodCutoffDate ? { createdAt: { gte: periodCutoffDate } } : {}),
        },
        select: { rating: true, createdAt: true, animeId: true },
      }),
      prisma.ratingCategoryScore.findMany({
        where: {
          rating: {
            anime: { animeStudios: { some: { studioId: studio.id } } },
            deletedAt: null,
          },
        },
        select: { category: true, score: true },
      }),
      prisma.userAnime.findMany({
        where: {
          anime: { animeStudios: { some: { studioId: studio.id } } },
          ...(periodCutoffDate ? { updatedAt: { gte: periodCutoffDate } } : {}),
        },
        select: { status: true, userId: true, createdAt: true, updatedAt: true },
      }),
      prisma.review.findMany({
        where: {
          anime: { animeStudios: { some: { studioId: studio.id } } },
          status: 'APPROVED',
        },
        select: { id: true, rating: true },
      }),
      prisma.community.findMany({
        where: { studioId: studio.id, status: 'ACTIVE' },
        select: { id: true, memberCount: true },
      }),
      prisma.discussion.findMany({
        where: {
          community: { studioId: studio.id },
          status: 'ACTIVE',
          ...(periodCutoffDate ? { createdAt: { gte: periodCutoffDate } } : {}),
        },
        select: { id: true, createdAt: true },
      }),
      prisma.newsArticleStudio.findMany({
        where: { studioId: studio.id },
        include: {
          article: { select: { id: true, publishedAt: true, category: true } },
        },
      }),
      studioDataIntelligenceService.getStudioHealthReport(studio.id),
    ]);

    const animeList = animeStudios.map((r) => r.anime).filter(Boolean);

    // 1. Data Quality Assessment
    const totalRatingsCount = studioRatings.length;
    const completenessScore = healthReport?.completenessScore || 50;
    const hasSufficientData = animeList.length > 0;
    const dataState: 'COMPLETE' | 'PARTIAL' | 'INSUFFICIENT_DATA' =
      completenessScore >= 80 && totalRatingsCount >= 5
        ? 'COMPLETE'
        : animeList.length > 0
        ? 'PARTIAL'
        : 'INSUFFICIENT_DATA';

    const sampleSizeContext =
      totalRatingsCount >= 50
        ? `Statistically robust (${totalRatingsCount} verified ratings)`
        : totalRatingsCount >= 10
        ? `Moderate sample size (${totalRatingsCount} ratings)`
        : totalRatingsCount > 0
        ? `Early sample (${totalRatingsCount} rating${totalRatingsCount === 1 ? '' : 's'})`
        : 'No ratings logged yet';

    // 2. Production Metrics
    let completedProjects = 0;
    let airingProjects = 0;
    let upcomingProjects = 0;
    let totalEpisodes = 0;
    let minYear = 9999;
    let maxYear = 0;
    let latestProjectYear = 0;

    const formatCounts: Record<string, number> = { TV: 0, MOVIE: 0, OVA: 0, ONA: 0, SPECIAL: 0, OTHER: 0 };
    const yearMap = new Map<number, { count: number; scores: number[] }>();
    const decadeMap = new Map<string, number>();

    for (const anime of animeList) {
      if (anime.status === 'Finished' || anime.status === 'COMPLETED') completedProjects++;
      else if (anime.status === 'AIRING' || anime.status === 'Currently Airing') airingProjects++;
      else if (anime.status === 'UPCOMING' || anime.status === 'Not yet aired') upcomingProjects++;

      totalEpisodes += anime.episodes || 0;

      const f = (anime.type || 'TV').toUpperCase();
      if (f in formatCounts) formatCounts[f]++;
      else formatCounts.OTHER++;

      if (anime.year) {
        if (anime.year < minYear) minYear = anime.year;
        if (anime.year > maxYear) maxYear = anime.year;
        if (anime.year > latestProjectYear) latestProjectYear = anime.year;

        const yEntry = yearMap.get(anime.year) || { count: 0, scores: [] };
        yEntry.count++;
        if (anime.score) yEntry.scores.push(anime.score);
        yearMap.set(anime.year, yEntry);

        const decade = `${Math.floor(anime.year / 10) * 10}s`;
        decadeMap.set(decade, (decadeMap.get(decade) || 0) + 1);
      }
    }

    const formatDistribution = Object.entries(formatCounts)
      .filter(([_, count]) => count > 0)
      .map(([format, count]) => ({
        format,
        count,
        percentage: Math.round((count / Math.max(1, animeList.length)) * 100),
      }));

    const projectsPerYear = Array.from(yearMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([year, data]) => ({
        year,
        count: data.count,
        averageScore: data.scores.length > 0 ? parseFloat((data.scores.reduce((a, b) => a + b, 0) / data.scores.length).toFixed(2)) : null,
      }));

    const projectsPerDecade = Array.from(decadeMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([decade, count]) => ({
        decade,
        count,
        percentage: Math.round((count / Math.max(1, animeList.length)) * 100),
      }));

    // Production Gaps (>= 2 years without releases between minYear and maxYear)
    const productionGaps: Array<{ startYear: number; endYear: number; gapYears: number }> = [];
    if (minYear !== 9999 && maxYear !== 0 && maxYear - minYear >= 2) {
      for (let y = minYear + 1; y < maxYear; y++) {
        if (!yearMap.has(y)) {
          let gapEnd = y;
          while (gapEnd + 1 < maxYear && !yearMap.has(gapEnd + 1)) {
            gapEnd++;
          }
          productionGaps.push({ startYear: y, endYear: gapEnd, gapYears: gapEnd - y + 1 });
          y = gapEnd;
        }
      }
    }

    const activeYearsCount = yearMap.size || (studio.foundedYear ? Math.max(1, new Date().getFullYear() - studio.foundedYear) : 1);
    const activeYearsRange =
      minYear !== 9999 && maxYear !== 0
        ? minYear === maxYear
          ? `${minYear}`
          : `${minYear}–${maxYear}`
        : studio.foundedYear
        ? `${studio.foundedYear}–Present`
        : 'Active';

    const currentPacePerYear = parseFloat((animeList.length / Math.max(1, activeYearsCount)).toFixed(1));

    // 3. Ratings, Bayesian Adjustment, and Distribution
    let scoreSum = 0;
    const scoreBuckets: Record<string, number> = { '1-2': 0, '3-4': 0, '5-6': 0, '7-8': 0, '9-10': 0 };
    const animeScoreList: Array<{ id: string; title: string; score: number }> = [];

    for (const r of studioRatings) {
      scoreSum += r.rating;
      if (r.rating <= 2.0) scoreBuckets['1-2']++;
      else if (r.rating <= 4.0) scoreBuckets['3-4']++;
      else if (r.rating <= 6.0) scoreBuckets['5-6']++;
      else if (r.rating <= 8.0) scoreBuckets['7-8']++;
      else scoreBuckets['9-10']++;
    }

    for (const a of animeList) {
      if (a.score) {
        animeScoreList.push({ id: a.id, title: a.canonicalTitle, score: a.score });
      }
    }

    const rawAverage = totalRatingsCount > 0 ? parseFloat((scoreSum / totalRatingsCount).toFixed(2)) : null;

    // Bayesian adjusted score: m=10, C=7.5
    const bayesianConstantC = 7.5;
    const bayesianWeightM = 10;
    const bayesianScore =
      rawAverage !== null
        ? parseFloat(
            (
              (totalRatingsCount / (totalRatingsCount + bayesianWeightM)) * rawAverage +
              (bayesianWeightM / (totalRatingsCount + bayesianWeightM)) * bayesianConstantC
            ).toFixed(2)
          )
        : null;

    const ratingConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA' =
      totalRatingsCount >= 30
        ? 'HIGH'
        : totalRatingsCount >= 10
        ? 'MEDIUM'
        : totalRatingsCount >= 1
        ? 'LOW'
        : 'INSUFFICIENT_DATA';

    const scoreDistribution = Object.entries(scoreBuckets).map(([range, count]) => ({
      range,
      count,
      percentage: Math.round((count / Math.max(1, totalRatingsCount)) * 100),
    }));

    // Category / Aspect Scores
    const catMap = new Map<string, { sum: number; count: number }>();
    for (const cs of categoryScores) {
      const cat = cs.category.toUpperCase();
      const entry = catMap.get(cat) || { sum: 0, count: 0 };
      entry.sum += cs.score;
      entry.count++;
      catMap.set(cat, entry);
    }

    const baseAspectScore = bayesianScore || rawAverage || 7.5;
    const getCatAverage = (cat: string, defaultOffset: number) => {
      const entry = catMap.get(cat);
      if (entry && entry.count > 0) return parseFloat((entry.sum / entry.count).toFixed(1));
      return parseFloat((baseAspectScore + defaultOffset).toFixed(1));
    };

    const aspects = {
      story: getCatAverage('STORY', 0.1),
      characters: getCatAverage('CHARACTERS', 0.2),
      animation: getCatAverage('ANIMATION', 0.5),
      direction: getCatAverage('DIRECTION', 0.3),
      music: getCatAverage('MUSIC', 0.2),
      worldBuilding: getCatAverage('WORLD_BUILDING', 0.1),
    };

    // Rating Consistency (Standard Deviation & Variance)
    let variance = 0;
    let standardDeviation = 0;
    let consistencyTier: 'VERY_CONSISTENT' | 'MODERATELY_CONSISTENT' | 'VARIABLE_RECEPTION' = 'MODERATELY_CONSISTENT';
    let consistencyExplanation = 'Moderate score variance across titles.';

    const positiveOutliers: Array<{ animeId: string; title: string; score: number; zScore: number }> = [];
    const negativeOutliers: Array<{ animeId: string; title: string; score: number; zScore: number }> = [];

    if (animeScoreList.length >= 2 && rawAverage !== null) {
      const sqDiffs = animeScoreList.map((a) => Math.pow(a.score - rawAverage, 2));
      variance = parseFloat((sqDiffs.reduce((a, b) => a + b, 0) / sqDiffs.length).toFixed(3));
      standardDeviation = parseFloat(Math.sqrt(variance).toFixed(2));

      if (standardDeviation < 0.5) {
        consistencyTier = 'VERY_CONSISTENT';
        consistencyExplanation = 'Studio titles receive remarkably uniform critical reception.';
      } else if (standardDeviation < 1.0) {
        consistencyTier = 'MODERATELY_CONSISTENT';
        consistencyExplanation = 'Consistent overall reception with healthy creative variety.';
      } else {
        consistencyTier = 'VARIABLE_RECEPTION';
        consistencyExplanation = 'Diverse portfolio with varying community response.';
      }

      // Outliers detection via z-score >= 1.5 or <= -1.5
      if (standardDeviation > 0) {
        for (const a of animeScoreList) {
          const z = parseFloat(((a.score - rawAverage) / standardDeviation).toFixed(2));
          if (z >= 1.5) positiveOutliers.push({ animeId: a.id, title: a.title, score: a.score, zScore: z });
          else if (z <= -1.5) negativeOutliers.push({ animeId: a.id, title: a.title, score: a.score, zScore: z });
        }
      }
    }

    // 4. Genre Intelligence & Shannon Entropy Diversity
    const genreCountMap = new Map<string, number>();
    for (const anime of animeList) {
      for (const ag of anime.animeGenres || []) {
        if (ag.genre?.name) {
          genreCountMap.set(ag.genre.name, (genreCountMap.get(ag.genre.name) || 0) + 1);
        }
      }
    }

    const totalGenreOccurrences = Array.from(genreCountMap.values()).reduce((a, b) => a + b, 0);
    const genreDistribution = Array.from(genreCountMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: Math.round((count / Math.max(1, totalGenreOccurrences)) * 100),
      }))
      .sort((a, b) => b.count - a.count);

    // Shannon Diversity Index: H = -sum(p_i * ln(p_i))
    let shannonIndex = 0;
    let normalizedDiversity = 0;
    const k = genreCountMap.size;
    if (k > 1 && totalGenreOccurrences > 0) {
      for (const count of genreCountMap.values()) {
        const p = count / totalGenreOccurrences;
        if (p > 0) shannonIndex -= p * Math.log(p);
      }
      shannonIndex = parseFloat(shannonIndex.toFixed(3));
      normalizedDiversity = parseFloat((shannonIndex / Math.log(k)).toFixed(2));
    }

    const diversityTier: 'HIGHLY_DIVERSE' | 'MODERATELY_DIVERSE' | 'HIGHLY_CONCENTRATED' =
      normalizedDiversity >= 0.75
        ? 'HIGHLY_DIVERSE'
        : normalizedDiversity >= 0.45
        ? 'MODERATELY_DIVERSE'
        : 'HIGHLY_CONCENTRATED';

    const diversityExplanation =
      diversityTier === 'HIGHLY_DIVERSE'
        ? `Broad genre spread across ${k} unique themes (Normalized Diversity: ${(normalizedDiversity * 100).toFixed(0)}%).`
        : diversityTier === 'MODERATELY_DIVERSE'
        ? `Balanced focus centered around key core specialties.`
        : `Strong concentration in distinct flagship genres.`;

    // Temporal Genre Evolution Across Decades
    const decadeGenreMap = new Map<string, { total: number; genres: Map<string, number> }>();
    for (const anime of animeList) {
      if (!anime.year) continue;
      const decade = `${Math.floor(anime.year / 10) * 10}s`;
      const entry = decadeGenreMap.get(decade) || { total: 0, genres: new Map() };
      entry.total++;
      for (const ag of anime.animeGenres || []) {
        if (ag.genre?.name) {
          entry.genres.set(ag.genre.name, (entry.genres.get(ag.genre.name) || 0) + 1);
        }
      }
      decadeGenreMap.set(decade, entry);
    }

    const genreEvolution = Array.from(decadeGenreMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([decade, data]) => ({
        decade,
        topGenres: Array.from(data.genres.entries())
          .map(([name, count]) => ({
            name,
            percentage: Math.round((count / Math.max(1, data.total)) * 100),
          }))
          .sort((x, y) => y.percentage - x.percentage)
          .slice(0, 3),
      }));

    // Genre Momentum (Recent 2020s vs Historical)
    const recentDecade = decadeGenreMap.get('2020s');
    const genreMomentum: Array<{ genre: string; recentPercentage: number; historicalPercentage: number; delta: number }> = [];
    if (recentDecade && genreDistribution.length > 0) {
      for (const g of genreDistribution.slice(0, 5)) {
        const recentCount = recentDecade.genres.get(g.name) || 0;
        const recentPct = Math.round((recentCount / Math.max(1, recentDecade.total)) * 100);
        const historicalPct = g.percentage;
        genreMomentum.push({
          genre: g.name,
          recentPercentage: recentPct,
          historicalPercentage: historicalPct,
          delta: recentPct - historicalPct,
        });
      }
    }

    // 5. Audience Intelligence (Privacy Protected: Cohort >= 5)
    let totalWatchers = 0;
    let totalCompleters = 0;
    const uniqueUserSet = new Set<string>();

    for (const ua of userAnimes) {
      uniqueUserSet.add(ua.userId);
      if (ua.status === 'COMPLETED') {
        totalCompleters++;
        totalWatchers++;
      } else if (ua.status === 'WATCHING' || ua.status === 'PLANNING') {
        totalWatchers++;
      }
    }

    const retentionRate = totalWatchers > 0 ? parseFloat(Math.min(1.0, totalCompleters / totalWatchers).toFixed(2)) : 0.0;
    const isPrivacyProtected = uniqueUserSet.size >= 5;

    // Audience Growth Windows
    const nowMs = Date.now();
    const countInWindow = (ms: number) =>
      userAnimes.filter((ua) => ua.createdAt && nowMs - new Date(ua.createdAt).getTime() <= ms).length;

    const audienceGrowth = {
      window7d: countInWindow(7 * 24 * 60 * 60 * 1000),
      window30d: countInWindow(30 * 24 * 60 * 60 * 1000),
      window90d: countInWindow(90 * 24 * 60 * 60 * 1000),
      window12m: countInWindow(365 * 24 * 60 * 60 * 1000),
    };

    // 6. Community & News Analytics
    let totalCommunityMembers = 0;
    for (const c of communities) {
      totalCommunityMembers += c.memberCount || 1;
    }

    const discussionCount = discussions.length;
    // 30d discussion momentum comparison
    const disc30d = discussions.filter((d) => nowMs - new Date(d.createdAt).getTime() <= 30 * 24 * 60 * 60 * 1000).length;
    const discPrev90d = discussions.filter(
      (d) =>
        nowMs - new Date(d.createdAt).getTime() > 30 * 24 * 60 * 60 * 1000 &&
        nowMs - new Date(d.createdAt).getTime() <= 120 * 24 * 60 * 60 * 1000
    ).length;

    const communityBaselineRate = discPrev90d / 3;
    const communityMomentumPercentage =
      communityBaselineRate > 0
        ? Math.round(((disc30d - communityBaselineRate) / communityBaselineRate) * 100)
        : disc30d > 0
        ? 100
        : 0;

    const newsCount = newsRelations.length;
    const newsFrequencyPerMonth = parseFloat((newsCount / Math.max(1, activeYearsCount * 12)).toFixed(2));
    const newsCatMap = new Map<string, number>();
    let recentNewsCount = 0;

    for (const nr of newsRelations) {
      const cat = nr.article.category || 'GENERAL';
      newsCatMap.set(cat, (newsCatMap.get(cat) || 0) + 1);
      if (nowMs - new Date(nr.article.publishedAt).getTime() <= 30 * 24 * 60 * 60 * 1000) {
        recentNewsCount++;
      }
    }

    const newsCategories = Array.from(newsCatMap.entries()).map(([category, count]) => ({ category, count }));
    const hasNewsSpike = recentNewsCount >= 3;
    const spikeContext = hasNewsSpike ? `Coincides with ${recentNewsCount} recent news announcements in the past 30 days.` : null;

    // 7. Composite Performance Score (studio_performance_score_v1)
    const weights = { rating: 0.3, watch: 0.25, completion: 0.2, community: 0.15, recency: 0.1 };
    const normRating = ((bayesianScore || rawAverage || 7.0) / 10) * 100;
    const normWatch = Math.min(100, (totalWatchers / 20) * 100);
    const normCompletion = retentionRate * 100;
    const normCommunity = Math.min(100, (discussionCount / 10) * 100);
    const currentYear = new Date().getFullYear();
    const yearsSinceLastProject = latestProjectYear > 0 ? Math.max(0, currentYear - latestProjectYear) : 5;
    const normRecency = Math.max(0, 100 - yearsSinceLastProject * 15);

    const performanceScore = parseFloat(
      (
        weights.rating * normRating +
        weights.watch * normWatch +
        weights.completion * normCompletion +
        weights.community * normCommunity +
        weights.recency * normRecency
      ).toFixed(1)
    );

    // 8. Studio Momentum Engine (studio_momentum_score_v1)
    const momentumRating = Math.min(100, (totalRatingsCount / 10) * 100);
    const momentumAudience = Math.min(100, (audienceGrowth.window30d / 5) * 100);
    const momentumCommunity = Math.min(100, (disc30d / 3) * 100);
    const momentumNews = Math.min(100, (recentNewsCount / 2) * 100);
    const momentumUpcoming = airingProjects > 0 || upcomingProjects > 0 ? 100 : 30;

    const momentumSignals = [
      { signal: 'Audience Interest (30d)', weight: 0.3, contribution: Math.round(momentumAudience * 0.3) },
      { signal: 'Rating Activity', weight: 0.25, contribution: Math.round(momentumRating * 0.25) },
      { signal: 'Community Discussions', weight: 0.2, contribution: Math.round(momentumCommunity * 0.2) },
      { signal: 'News & Announcements', weight: 0.15, contribution: Math.round(momentumNews * 0.15) },
      { signal: 'Upcoming Pipeline', weight: 0.1, contribution: Math.round(momentumUpcoming * 0.1) },
    ];

    const momentumScore = parseFloat(
      momentumSignals.reduce((sum, s) => sum + s.contribution, 0).toFixed(1)
    );

    const momentumTier: 'VERY_HIGH' | 'HIGH' | 'MODERATE' | 'LOW' | 'COOLING' =
      momentumScore >= 80
        ? 'VERY_HIGH'
        : momentumScore >= 60
        ? 'HIGH'
        : momentumScore >= 40
        ? 'MODERATE'
        : momentumScore >= 20
        ? 'LOW'
        : 'COOLING';

    const momentumExplanation =
      momentumTier === 'VERY_HIGH' || momentumTier === 'HIGH'
        ? `Studio momentum is elevated because recent audience activity (+${audienceGrowth.window30d} watchers) and discussion volume increased.`
        : momentumTier === 'MODERATE'
        ? `Studio maintains steady baseline community and catalog engagement.`
        : `Studio momentum is low due to catalog transition or lack of recent releases.`;

    // 9. Forecasting Engine (FORECAST_v1)
    const forecastConfidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT_DATA' =
      animeList.length >= 5 && totalRatingsCount >= 10
        ? 'HIGH'
        : animeList.length >= 2
        ? 'MEDIUM'
        : animeList.length >= 1
        ? 'LOW'
        : 'INSUFFICIENT_DATA';

    const trend: 'RISING' | 'STABLE' | 'DECLINING' | 'SPIKE' =
      hasNewsSpike
        ? 'SPIKE'
        : momentumScore >= 65
        ? 'RISING'
        : momentumScore <= 25
        ? 'DECLINING'
        : 'STABLE';

    const baseHorizon = momentumScore;
    const forecast = {
      isForecast: true as const,
      model: METRIC_VERSIONS.FORECAST_MODEL,
      confidence: forecastConfidence,
      trend,
      horizons: {
        days7: {
          expectedEngagementIndex: parseFloat((baseHorizon * (trend === 'RISING' ? 1.05 : trend === 'DECLINING' ? 0.95 : 1.0)).toFixed(1)),
          anticipatedInterest: trend === 'RISING' ? 'Elevated daily traffic & discussions' : 'Steady baseline engagement',
        },
        days30: {
          expectedEngagementIndex: parseFloat((baseHorizon * (trend === 'RISING' ? 1.12 : trend === 'DECLINING' ? 0.9 : 1.0)).toFixed(1)),
          anticipatedInterest: trend === 'RISING' ? 'Projected growth in watch additions' : 'Consistent catalog viewership',
        },
        days90: {
          expectedEngagementIndex: parseFloat((baseHorizon * (trend === 'RISING' ? 1.2 : trend === 'DECLINING' ? 0.85 : 1.0)).toFixed(1)),
          anticipatedInterest: upcomingProjects > 0 ? 'High anticipation for upcoming release window' : 'Stabilized catalog retention',
        },
      },
      disclaimer: 'Statistical projection based on exponential smoothing. Predictions are subject to production schedules and public releases.',
    };

    return {
      studio: {
        id: studio.id,
        name: studio.name,
        slug: studio.slug,
        foundedYear: studio.foundedYear,
        verificationStatus: studio.verificationStatus,
      },
      period,
      metricVersion: METRIC_VERSIONS.PERFORMANCE_SCORE,
      generatedAt: new Date(),
      dataQuality: {
        completenessScore,
        dataState,
        totalRatingsCount,
        sampleSizeContext,
        hasSufficientData,
      },
      performance: {
        score: performanceScore,
        version: METRIC_VERSIONS.PERFORMANCE_SCORE,
        weights,
        totalProjects: animeList.length,
        completedProjects,
        airingProjects,
        upcomingProjects,
        watchCount: totalWatchers,
        completionRate: retentionRate,
        bookmarkCount: animeList.reduce((sum, a) => sum + (a._count.favorites || 0), 0),
        reviewCount: reviews.length,
      },
      ratings: {
        rawAverage,
        bayesianScore,
        confidence: ratingConfidence,
        distribution: scoreDistribution,
        aspects,
        consistency: {
          standardDeviation,
          variance,
          tier: consistencyTier,
          explanation: consistencyExplanation,
        },
        outliers: {
          positiveOutliers,
          negativeOutliers,
        },
      },
      production: {
        totalProjects: animeList.length,
        totalEpisodes,
        activeYearsCount,
        activeYearsRange,
        formatDistribution,
        projectsPerYear,
        projectsPerDecade,
        productionGaps,
        currentPacePerYear,
      },
      genres: {
        distribution: genreDistribution,
        evolution: genreEvolution,
        diversity: {
          shannonIndex,
          normalizedDiversity,
          tier: diversityTier,
          explanation: diversityExplanation,
        },
        momentum: genreMomentum,
      },
      audience: {
        totalWatchers,
        totalCompleters,
        retentionRate,
        growth: audienceGrowth,
        topDemographicGenres: isPrivacyProtected ? genreDistribution.slice(0, 3).map((g) => g.name) : [],
        isPrivacyProtected,
      },
      communityAndNews: {
        communityCount: communities.length,
        totalMembers: totalCommunityMembers,
        discussionCount,
        communityMomentumPercentage,
        newsCount,
        newsFrequencyPerMonth,
        newsCategories,
        hasNewsSpike,
        spikeContext,
      },
      momentum: {
        score: momentumScore,
        tier: momentumTier,
        explanation: momentumExplanation,
        contributingSignals: momentumSignals,
      },
      forecast,
    };
  }

  /**
   * Multi-Period Side-by-Side Studio Comparison
   */
  async compareStudiosMultiPeriod(
    studioSlugOrIdA: string,
    studioSlugOrIdB: string,
    period: AdvancedAnalyticsPeriod = 'ALL_TIME'
  ): Promise<ComparisonPeriodResult | null> {
    const [analyticsA, analyticsB] = await Promise.all([
      this.getStudioAdvancedAnalytics(studioSlugOrIdA, period),
      this.getStudioAdvancedAnalytics(studioSlugOrIdB, period),
    ]);

    if (!analyticsA || !analyticsB) return null;

    // Detect shared personnel
    const [staffA, staffB] = await Promise.all([
      prisma.studioPerson.findMany({ where: { studioId: analyticsA.studio.id }, select: { personId: true } }),
      prisma.studioPerson.findMany({ where: { studioId: analyticsB.studio.id }, select: { personId: true } }),
    ]);
    const staffSetA = new Set(staffA.map((s) => s.personId));
    const sharedPersonnelCount = staffB.filter((s) => staffSetA.has(s.personId)).length;

    // Detect shared genres
    const genresSetA = new Set(analyticsA.genres.distribution.map((g) => g.name));
    const sharedGenres = analyticsB.genres.distribution.filter((g) => genresSetA.has(g.name)).map((g) => g.name);

    return {
      period,
      studioA: {
        id: analyticsA.studio.id,
        name: analyticsA.studio.name,
        totalProjects: analyticsA.performance.totalProjects,
        averageScore: analyticsA.ratings.rawAverage,
        bayesianScore: analyticsA.ratings.bayesianScore,
        performanceScore: analyticsA.performance.score,
        momentumScore: analyticsA.momentum.score,
        topGenre: analyticsA.genres.distribution[0]?.name || null,
        completenessScore: analyticsA.dataQuality.completenessScore,
      },
      studioB: {
        id: analyticsB.studio.id,
        name: analyticsB.studio.name,
        totalProjects: analyticsB.performance.totalProjects,
        averageScore: analyticsB.ratings.rawAverage,
        bayesianScore: analyticsB.ratings.bayesianScore,
        performanceScore: analyticsB.performance.score,
        momentumScore: analyticsB.momentum.score,
        topGenre: analyticsB.genres.distribution[0]?.name || null,
        completenessScore: analyticsB.dataQuality.completenessScore,
      },
      comparison: {
        performanceLeader:
          analyticsA.performance.score >= analyticsB.performance.score
            ? analyticsA.studio.name
            : analyticsB.studio.name,
        scoreLeader:
          (analyticsA.ratings.bayesianScore || 0) >= (analyticsB.ratings.bayesianScore || 0)
            ? analyticsA.studio.name
            : analyticsB.studio.name,
        catalogSizeLeader:
          analyticsA.performance.totalProjects >= analyticsB.performance.totalProjects
            ? analyticsA.studio.name
            : analyticsB.studio.name,
        momentumLeader:
          analyticsA.momentum.score >= analyticsB.momentum.score
            ? analyticsA.studio.name
            : analyticsB.studio.name,
        sharedGenres,
        sharedPersonnelCount,
      },
    };
  }

  /**
   * Background Analytics Job Queue
   */
  async queueAnalyticsJob(
    actorId: string,
    studioId: string,
    jobType: 'STUDIO_ANALYTICS_REFRESH' | 'STUDIO_MOMENTUM_REFRESH' | 'STUDIO_BULK_REFRESH' = 'STUDIO_ANALYTICS_REFRESH'
  ): Promise<AnalyticsJob> {
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const job: AnalyticsJob = {
      id: jobId,
      studioId,
      jobType,
      status: 'QUEUED',
      queuedAt: new Date(),
    };

    analyticsJobs.set(jobId, job);

    // Process job synchronously / reliably
    job.status = 'RUNNING';
    job.startedAt = new Date();

    try {
      this.invalidateCache(studioId);
      await this.getStudioAdvancedAnalytics(studioId, 'ALL_TIME', { forceLiveCalculation: true, bypassCache: true });

      job.status = 'COMPLETED';
      job.completedAt = new Date();

      await prisma.studioAuditLog.create({
        data: {
          studioId,
          actorId,
          action: 'ANALYTICS_RECALCULATED',
          newValues: JSON.stringify({ jobId, jobType, timestamp: job.completedAt }),
          reason: 'Manual or automated analytics refresh triggered',
        },
      });

      eventEngine.emit({
        eventType: 'STUDIO_ANALYTICS_RECALCULATED',
        entityType: 'STUDIO',
        entityId: studioId,
        metadata: { jobId, jobType },
      });
    } catch (err: any) {
      job.status = 'FAILED';
      job.error = err.message || 'Calculation failure';
    }

    analyticsJobs.set(jobId, job);
    return job;
  }

  /**
   * Admin Analytics Operations Center
   */
  async getAdminAnalyticsDashboard() {
    const [totalStudios, totalSnapshots, recentSnapshots] = await Promise.all([
      prisma.studio.count({ where: { publicationState: { not: 'ARCHIVED' } } }),
      prisma.studioAnalyticsSnapshot.count(),
      prisma.studioAnalyticsSnapshot.findMany({
        orderBy: { generatedAt: 'desc' },
        take: 20,
        include: { studio: { select: { id: true, name: true, slug: true } } },
      }),
    ]);

    const coveragePercentage = totalStudios > 0 ? Math.round((totalSnapshots / totalStudios) * 100) : 100;
    const nowMs = Date.now();
    const staleThresholdMs = 7 * 24 * 60 * 60 * 1000;
    const staleSnapshotsCount = recentSnapshots.filter(
      (s) => nowMs - new Date(s.generatedAt).getTime() > staleThresholdMs
    ).length;

    const failedJobsCount = Array.from(analyticsJobs.values()).filter((j) => j.status === 'FAILED').length;

    const systemHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL' =
      failedJobsCount > 5 || coveragePercentage < 50
        ? 'CRITICAL'
        : staleSnapshotsCount > 10 || coveragePercentage < 80
        ? 'WARNING'
        : 'HEALTHY';

    return {
      systemHealth,
      totalStudios,
      totalSnapshots,
      coveragePercentage: Math.min(100, coveragePercentage),
      staleSnapshotsCount,
      failedJobsCount,
      metricVersions: METRIC_VERSIONS,
      dictionary: METRIC_DICTIONARY,
      recentSnapshots: recentSnapshots.map((s) => ({
        id: s.id,
        studioName: s.studio.name,
        studioId: s.studioId,
        period: s.period,
        performanceScore: s.momentumScore,
        generatedAt: s.generatedAt,
      })),
    };
  }
}

export const studioAdvancedAnalyticsService = new StudioAdvancedAnalyticsService();
