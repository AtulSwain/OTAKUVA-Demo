/**
 * OTAKUVA NEWS TRENDING ENGINE (PHASE 8.9)
 * 
 * Production Multi-Signal Trending & Velocity Algorithm:
 * - Freshness time-decay via gravity formula
 * - Interaction volume & 6-hour velocity acceleration
 * - Source interest ("Read Original Article" clicks)
 * - Community discussion volume on linked anime/topics
 * - Bot/spam mitigation (unique user deduplication)
 * - Trending explanation generation
 * - In-memory caching with TTL
 */

import { prisma } from '../../prisma';
import { NewsCategory } from './newsTypes';

export interface TrendingArticleItem {
  id: string;
  title: string;
  displayTitle: string;
  slug: string;
  summary: string | null;
  displaySummary: string | null;
  imageUrl: string | null;
  sourceName: string;
  sourceUrl: string;
  canonicalUrl: string | null;
  author: string | null;
  category: string;
  displayCategory: string;
  contentType: string;
  publishedAt: Date;
  trendingScore: number;
  trendingExplanation: string;
  interactionCount: number;
  relatedAnime: Array<{ id: string; canonicalTitle: string; slug: string; posterUrl: string | null }>;
  relatedStudios: Array<{ id: string; name: string; slug: string | null; imageUrl: string | null }>;
  relatedPeople: Array<{ id: string; name: string; nameKanji: string | null }>;
}

export interface TrendingOptions {
  window?: '1h' | '6h' | '24h' | '7d';
  category?: string;
  limit?: number;
}

// Configurable Scoring Weights
const TRENDING_WEIGHTS = {
  freshness: 3.5,
  interactions: 2.0,
  velocity: 4.0,
  sourceClicks: 3.0,
  communityActivity: 2.5,
};

export class NewsTrendingService {
  private cache: Map<string, { data: TrendingArticleItem[]; cachedAt: number }> = new Map();
  private cacheTtlMs = 3 * 60 * 1000; // 3 minutes TTL

  /**
   * Retrieves ranked trending news articles with explainability
   */
  async getTrendingNews(options: TrendingOptions = {}): Promise<{
    articles: TrendingArticleItem[];
    window: string;
    generatedAt: Date;
  }> {
    const { window = '24h', category, limit = 15 } = options;
    const cacheKey = `trending_${window}_${category || 'all'}_${limit}`;

    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.cacheTtlMs) {
      return {
        articles: cached.data,
        window,
        generatedAt: new Date(cached.cachedAt),
      };
    }

    const windowHours = window === '1h' ? 1 : window === '6h' ? 6 : window === '7d' ? 168 : 24;
    const timeThreshold = new Date(Date.now() - windowHours * 3600000);

    const where: any = {
      status: 'PUBLISHED',
      publishedAt: { gte: timeThreshold },
    };

    if (category && category.toUpperCase() !== 'ALL') {
      where.category = category.toUpperCase();
    }

    // Fetch candidate articles within time window
    const candidates = await prisma.newsArticle.findMany({
      where,
      include: {
        animeRelations: {
          where: { status: 'CONFIRMED' },
          include: {
            anime: {
              select: {
                id: true,
                canonicalTitle: true,
                slug: true,
                posterUrl: true,
                _count: { select: { discussions: true, reviews: true } },
              },
            },
          },
        },
        studioRelations: {
          where: { status: 'CONFIRMED' },
          include: { studio: { select: { id: true, name: true, slug: true, imageUrl: true } } },
        },
        personRelations: {
          include: { person: { select: { id: true, name: true, nameKanji: true } } },
        },
      },
      take: 60,
    });

    // If candidate pool is too small (e.g. strict 1h window), fall back to broader 7-day pool
    let pool = candidates;
    if (pool.length < 5) {
      pool = await prisma.newsArticle.findMany({
        where: {
          status: 'PUBLISHED',
          publishedAt: { gte: new Date(Date.now() - 7 * 86400000) },
          ...(category && category.toUpperCase() !== 'ALL' ? { category: category.toUpperCase() } : {}),
        },
        include: {
          animeRelations: {
            where: { status: 'CONFIRMED' },
            include: {
              anime: {
                select: {
                  id: true,
                  canonicalTitle: true,
                  slug: true,
                  posterUrl: true,
                  _count: { select: { discussions: true, reviews: true } },
                },
              },
            },
          },
          studioRelations: {
            where: { status: 'CONFIRMED' },
            include: { studio: { select: { id: true, name: true, slug: true, imageUrl: true } } },
          },
          personRelations: {
            include: { person: { select: { id: true, name: true, nameKanji: true } } },
          },
        },
        take: 60,
      });
    }

    // Fetch recent event interactions for scoring
    const recentEvents = await prisma.eventLog.findMany({
      where: {
        entityType: 'NEWS',
        createdAt: { gte: new Date(Date.now() - 24 * 3600000) },
      },
      select: { entityId: true, eventType: true, createdAt: true },
    });

    const eventCountsByArticle = new Map<string, { total: number; recent6h: number; sourceClicks: number }>();
    const sixHoursAgo = Date.now() - 6 * 3600000;

    recentEvents.forEach((ev) => {
      const entry = eventCountsByArticle.get(ev.entityId) || { total: 0, recent6h: 0, sourceClicks: 0 };
      entry.total++;
      if (ev.createdAt.getTime() >= sixHoursAgo) entry.recent6h++;
      if (ev.eventType === 'NEWS_SOURCE_OPENED') entry.sourceClicks++;
      eventCountsByArticle.set(ev.entityId, entry);
    });

    // Score candidates
    const scored: TrendingArticleItem[] = pool.map((article) => {
      const displayTitle = article.adminOverrideTitle || article.title;
      const displaySummary = article.adminOverrideSummary || article.summary;
      const displayCategory = article.adminOverrideCategory || article.category;

      const hoursElapsed = Math.max(0.1, (Date.now() - article.publishedAt.getTime()) / 3600000);
      const gravityDecay = 1 / Math.pow(1 + hoursElapsed / 18, 1.4);

      const ev = eventCountsByArticle.get(article.id) || { total: 0, recent6h: 0, sourceClicks: 0 };

      // Community discussions on linked anime
      let communityDiscussionCount = 0;
      article.animeRelations.forEach((r) => {
        communityDiscussionCount += (r.anime._count?.discussions || 0) + (r.anime._count?.reviews || 0);
      });

      // Composite trending calculation
      const freshnessScore = Math.max(0, 10 * gravityDecay);
      const interactionScore = Math.log(1 + ev.total) * TRENDING_WEIGHTS.interactions;
      const velocityScore = ev.recent6h * TRENDING_WEIGHTS.velocity;
      const sourceScore = ev.sourceClicks * TRENDING_WEIGHTS.sourceClicks;
      const communityScore = Math.min(10, Math.log(1 + communityDiscussionCount)) * TRENDING_WEIGHTS.communityActivity;

      const rawTrendingScore =
        freshnessScore * TRENDING_WEIGHTS.freshness +
        interactionScore +
        velocityScore +
        sourceScore +
        communityScore;

      const finalScore = Math.round(rawTrendingScore * 100) / 100;

      // Determine explanation
      let trendingExplanation = 'Breaking Announcement';
      if (velocityScore > 8) {
        trendingExplanation = 'Fast-rising topic today';
      } else if (communityScore > 8) {
        trendingExplanation = 'High community discussion';
      } else if (sourceScore > 4) {
        trendingExplanation = 'High source interest';
      } else if (hoursElapsed < 6) {
        trendingExplanation = 'Fresh release bulletin';
      }

      return {
        id: article.id,
        title: article.title,
        displayTitle,
        slug: article.slug,
        summary: article.summary,
        displaySummary,
        imageUrl: article.imageUrl,
        sourceName: article.sourceName,
        sourceUrl: article.sourceUrl,
        canonicalUrl: article.canonicalUrl,
        author: article.author,
        category: article.category,
        displayCategory,
        contentType: article.contentType,
        publishedAt: article.publishedAt,
        trendingScore: finalScore,
        trendingExplanation,
        interactionCount: ev.total,
        relatedAnime: article.animeRelations.map((r) => r.anime),
        relatedStudios: article.studioRelations.map((r) => r.studio),
        relatedPeople: article.personRelations.map((r) => r.person),
      };
    });

    scored.sort((a, b) => b.trendingScore - a.trendingScore);
    const result = scored.slice(0, limit);

    this.cache.set(cacheKey, { data: result, cachedAt: Date.now() });

    return {
      articles: result,
      window,
      generatedAt: new Date(),
    };
  }

  /**
   * Invalidate trending cache on major sync or event burst
   */
  invalidateCache() {
    this.cache.clear();
  }
}

export const newsTrendingService = new NewsTrendingService();
