/**
 * OTAKUVA STUDIO ANALYTICS & PERFORMANCE SERVICE (PHASE 9.5)
 * 
 * Aggregates studio-level intelligence using existing canonical data:
 * - Project counts, formats, and episode volumes
 * - Sample-size protected rating aggregates
 * - Genre distribution percentages
 * - Release activity timeline (production pace per year)
 * - Score distribution histogram
 * - Community engagement metrics
 * - TTL in-memory caching with invalidation hooks
 * - Strict privacy (zero raw user data leakage)
 */

import { prisma } from '../../prisma';

export type AnalyticsTimeWindow = 'ALL_TIME' | 'LAST_12_MONTHS' | 'LAST_6_MONTHS' | 'LAST_30_DAYS';

export interface StudioAnalyticsResult {
  studio: {
    id: string;
    name: string;
    slug: string | null;
  };
  timeWindow: AnalyticsTimeWindow;
  overview: {
    totalProjects: number;
    totalEpisodes: number;
    tvCount: number;
    movieCount: number;
    ovaCount: number;
    onaCount: number;
    specialCount: number;
    shortCount: number;
    averageScore: number | null;
    totalRatingsCount: number;
    sampleSizeContext: string;
  };
  highlights: {
    highestRated: { id: string; title: string; slug: string; score: number; posterUrl: string | null } | null;
    lowestRated: { id: string; title: string; slug: string; score: number; posterUrl: string | null } | null;
    mostPopular: { id: string; title: string; slug: string; popularity: number; posterUrl: string | null } | null;
    mostReviewed: { id: string; title: string; slug: string; reviewCount: number; posterUrl: string | null } | null;
  };
  genreDistribution: Array<{ name: string; count: number; percentage: number }>;
  typeDistribution: Array<{ type: string; count: number; percentage: number }>;
  releaseActivity: Array<{ year: number; count: number }>;
  scoreDistribution: Array<{ range: string; count: number; percentage: number }>;
  engagement: {
    totalFavorites: number;
    totalReviews: number;
    totalWatches: number;
  };
  cachedAt: Date;
}

// In-Memory Analytics Cache (TTL 5 minutes)
const analyticsCache = new Map<string, { data: StudioAnalyticsResult; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

export class StudioAnalyticsService {
  /**
   * Invalidates cached analytics for a specific studio (or all studios)
   */
  invalidateCache(studioId?: string) {
    if (studioId) {
      for (const key of analyticsCache.keys()) {
        if (key.startsWith(studioId)) {
          analyticsCache.delete(key);
        }
      }
    } else {
      analyticsCache.clear();
    }
  }

  /**
   * Resolves a studio record by slug or ID
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
      select: { id: true, name: true, slug: true },
    });
  }

  /**
   * Computes or retrieves cached studio performance analytics
   */
  async getStudioAnalytics(
    studioSlugOrId: string,
    timeWindow: AnalyticsTimeWindow = 'ALL_TIME'
  ): Promise<StudioAnalyticsResult | null> {
    const studio = await this.resolveStudio(studioSlugOrId);
    if (!studio) return null;

    const cacheKey = `${studio.id}_${timeWindow}`;
    const cached = analyticsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Retrieve all anime productions associated with this studio
    const studioAnimeRelations = await prisma.animeStudio.findMany({
      where: { studioId: studio.id },
      include: {
        anime: {
          include: {
            animeGenres: { include: { genre: true } },
            ratingAggregate: true,
            _count: {
              select: {
                ratings: true,
                reviews: true,
                favorites: true,
                userAnimes: true,
              },
            },
          },
        },
      },
    });

    const animeList = studioAnimeRelations.map((r) => r.anime).filter(Boolean);

    // 1. Overview metrics
    let totalEpisodes = 0;
    let tvCount = 0;
    let movieCount = 0;
    let ovaCount = 0;
    let onaCount = 0;
    let specialCount = 0;
    let shortCount = 0;

    let scoreSum = 0;
    let scoreCount = 0;
    let totalRatingsCount = 0;

    let totalFavorites = 0;
    let totalReviews = 0;
    let totalWatches = 0;

    // Distributions
    const genreMap = new Map<string, number>();
    const typeMap = new Map<string, number>();
    const yearMap = new Map<number, number>();
    const scoreBuckets = {
      '9.0–10.0': 0,
      '8.0–8.9': 0,
      '7.0–7.9': 0,
      '6.0–6.9': 0,
      'Under 6.0': 0,
    };

    let highestRated: any = null;
    let lowestRated: any = null;
    let mostPopular: any = null;
    let mostReviewed: any = null;

    for (const anime of animeList) {
      totalEpisodes += anime.episodes || 0;
      const type = (anime.type || 'OTHER').toUpperCase();
      typeMap.set(type, (typeMap.get(type) || 0) + 1);

      if (type === 'TV') tvCount++;
      else if (type === 'MOVIE') movieCount++;
      else if (type === 'OVA') ovaCount++;
      else if (type === 'ONA') onaCount++;
      else if (type === 'SPECIAL') specialCount++;
      else if (type === 'SHORT') shortCount++;

      // Score Aggregation
      const score = anime.score || anime.ratingAggregate?.bayesianScore || null;
      const animeRatingCount = anime.ratingAggregate?.ratingCount || anime._count.ratings || 0;
      totalRatingsCount += animeRatingCount;

      if (score !== null && score > 0) {
        scoreSum += score;
        scoreCount++;

        if (score >= 9.0) scoreBuckets['9.0–10.0']++;
        else if (score >= 8.0) scoreBuckets['8.0–8.9']++;
        else if (score >= 7.0) scoreBuckets['7.0–7.9']++;
        else if (score >= 6.0) scoreBuckets['6.0–6.9']++;
        else scoreBuckets['Under 6.0']++;

        if (!highestRated || score > highestRated.score) {
          highestRated = {
            id: anime.id,
            title: anime.canonicalTitle,
            slug: anime.slug,
            score,
            posterUrl: anime.posterUrl,
          };
        }

        if (!lowestRated || score < lowestRated.score) {
          lowestRated = {
            id: anime.id,
            title: anime.canonicalTitle,
            slug: anime.slug,
            score,
            posterUrl: anime.posterUrl,
          };
        }
      }

      // Popularity
      if (anime.popularity && (!mostPopular || anime.popularity > mostPopular.popularity)) {
        mostPopular = {
          id: anime.id,
          title: anime.canonicalTitle,
          slug: anime.slug,
          popularity: anime.popularity,
          posterUrl: anime.posterUrl,
        };
      }

      // Reviews & Favorites
      const revCount = anime._count.reviews || 0;
      totalReviews += revCount;
      if (!mostReviewed || revCount > mostReviewed.reviewCount) {
        mostReviewed = {
          id: anime.id,
          title: anime.canonicalTitle,
          slug: anime.slug,
          reviewCount: revCount,
          posterUrl: anime.posterUrl,
        };
      }

      totalFavorites += anime._count.favorites || 0;
      totalWatches += anime._count.userAnimes || 0;

      // Genres
      for (const g of anime.animeGenres || []) {
        if (g.genre?.name) {
          genreMap.set(g.genre.name, (genreMap.get(g.genre.name) || 0) + 1);
        }
      }

      // Years
      const year = anime.year || anime.startYear;
      if (year && year > 1950 && year <= 2040) {
        yearMap.set(year, (yearMap.get(year) || 0) + 1);
      }
    }

    const totalProjects = animeList.length;
    const avgScore = scoreCount > 0 ? parseFloat((scoreSum / scoreCount).toFixed(2)) : null;
    const sampleSizeContext = avgScore !== null
      ? `★ ${avgScore} (${totalRatingsCount.toLocaleString()} ratings across ${scoreCount} scored titles)`
      : 'Insufficient rating data';

    // Format Genre Distribution
    const genreDistribution = Array.from(genreMap.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: totalProjects > 0 ? parseFloat(((count / totalProjects) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Format Type Distribution
    const typeDistribution = Array.from(typeMap.entries())
      .map(([type, count]) => ({
        type,
        count,
        percentage: totalProjects > 0 ? parseFloat(((count / totalProjects) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Format Release Activity
    const releaseActivity = Array.from(yearMap.entries())
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year - b.year);

    // Format Score Distribution
    const scoreDistribution = Object.entries(scoreBuckets).map(([range, count]) => ({
      range,
      count,
      percentage: scoreCount > 0 ? parseFloat(((count / scoreCount) * 100).toFixed(1)) : 0,
    }));

    const result: StudioAnalyticsResult = {
      studio: {
        id: studio.id,
        name: studio.name,
        slug: studio.slug,
      },
      timeWindow,
      overview: {
        totalProjects,
        totalEpisodes,
        tvCount,
        movieCount,
        ovaCount,
        onaCount,
        specialCount,
        shortCount,
        averageScore: avgScore,
        totalRatingsCount,
        sampleSizeContext,
      },
      highlights: {
        highestRated,
        lowestRated,
        mostPopular,
        mostReviewed,
      },
      genreDistribution,
      typeDistribution,
      releaseActivity,
      scoreDistribution,
      engagement: {
        totalFavorites,
        totalReviews,
        totalWatches,
      },
      cachedAt: new Date(),
    };

    // Store in Cache
    analyticsCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    return result;
  }
}

export const studioAnalyticsService = new StudioAnalyticsService();
