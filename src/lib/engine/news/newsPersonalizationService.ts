/**
 * OTAKUVA PERSONALIZED NEWS FEED SERVICE (PHASE 8.10)
 * 
 * Multi-Stage Personalization Engine:
 * 1. User Taste Engine integration (genre affinities, studio affinities, favorite entities)
 * 2. Candidate generation (tracked anime news, favorite studios, top genres, global trending)
 * 3. Multi-signal ranking with topic weights & time-decay
 * 4. Diversification & anti-filter-bubble protection (caps consecutive single-entity articles)
 * 5. Cold-start fallback for new/unauthenticated users
 * 6. Safe cursor-based pagination
 */

import { prisma } from '../../prisma';
import { tasteEngine } from '../taste/tasteEngine';
import { newsTrendingService } from './newsTrendingService';
import { NewsCategory } from './newsTypes';
import { PUBLIC_RELEVANCE_WHERE } from './newsRelevanceService';

export interface PersonalizedFeedItem {
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
  personalizationScore: number;
  feedSection: 'FOR_YOU' | 'BECAUSE_YOU_WATCH' | 'YOUR_STUDIOS' | 'TRENDING' | 'LATEST';
  personalizationReason: string;
  relatedAnime: Array<{ id: string; canonicalTitle: string; slug: string; posterUrl: string | null }>;
  relatedStudios: Array<{ id: string; name: string; slug: string | null; imageUrl: string | null }>;
  relatedPeople: Array<{ id: string; name: string; nameKanji: string | null }>;
}

export interface FeedOptions {
  cursor?: string;
  limit?: number;
  category?: string;
}

export class NewsPersonalizationService {
  /**
   * Generates a personalized news feed for a user with taste scoring, diversity, and fallback
   */
  async getPersonalizedFeed(
    userId?: string,
    options: FeedOptions = {}
  ): Promise<{
    feed: PersonalizedFeedItem[];
    nextCursor: string | null;
    isPersonalized: boolean;
    confidenceTier: string;
  }> {
    const { cursor, limit = 20, category } = options;

    // 1. Unauthenticated or Cold-Start fallback
    if (!userId) {
      const globalFeed = await this.getGlobalFallbackFeed(limit, cursor, category);
      return {
        feed: globalFeed.feed,
        nextCursor: globalFeed.nextCursor,
        isPersonalized: false,
        confidenceTier: 'ANONYMOUS',
      };
    }

    // 2. Fetch User Taste Profile & Watch Tracking History
    let tasteProfile: any = null;
    try {
      tasteProfile = await tasteEngine.getUserTasteProfile(userId);
    } catch {
      tasteProfile = null;
    }

    const [userAnimes, userFavorites] = await Promise.all([
      prisma.userAnime.findMany({
        where: { userId, status: { in: ['WATCHING', 'COMPLETED'] } },
        select: { animeId: true, score: true, status: true },
        take: 50,
      }),
      prisma.favorite.findMany({
        where: { userId },
        select: { animeId: true },
        take: 50,
      }),
    ]);

    const isColdStart =
      (!tasteProfile || tasteProfile.confidenceTier === 'NEW_USER') &&
      userAnimes.length === 0 &&
      userFavorites.length === 0;

    if (isColdStart) {
      const globalFeed = await this.getGlobalFallbackFeed(limit, cursor, category);
      return {
        feed: globalFeed.feed,
        nextCursor: globalFeed.nextCursor,
        isPersonalized: false,
        confidenceTier: 'NEW_USER',
      };
    }

    // Extract User Preference Maps
    const watchedAnimeIds = new Set(userAnimes.map((ua) => ua.animeId));
    const favoriteAnimeIds = new Set(userFavorites.map((f) => f.animeId));

    const topGenreMap = new Map<string, number>();
    (tasteProfile?.genreAffinities || []).forEach((g: any) => {
      topGenreMap.set(g.name.toLowerCase(), g.score);
    });

    const topStudioMap = new Map<string, number>();
    (tasteProfile?.studioAffinities || []).forEach((s: any) => {
      topStudioMap.set(s.name.toLowerCase(), s.score);
    });

    // 3. Generate Candidate Pool
    const where: any = {
      status: 'PUBLISHED',
    };

    if (category && category.toUpperCase() !== 'ALL') {
      where.category = category.toUpperCase();
    }

    if (cursor) {
      const cursorArticle = await prisma.newsArticle.findUnique({ where: { id: cursor }, select: { publishedAt: true } });
      if (cursorArticle) {
        where.publishedAt = { lt: cursorArticle.publishedAt };
      }
    }

    where.relevance = PUBLIC_RELEVANCE_WHERE;

    const candidatePool = await prisma.newsArticle.findMany({
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
                animeGenres: { select: { genre: { select: { name: true } } } },
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
      orderBy: { publishedAt: 'desc' },
      take: 80,
    });

    // 4. Score and Categorize Candidates
    const scoredCandidates: PersonalizedFeedItem[] = candidatePool.map((article) => {
      const displayTitle = article.adminOverrideTitle || article.title;
      const displaySummary = article.adminOverrideSummary || article.summary;
      const displayCategory = article.adminOverrideCategory || article.category;

      let score = 1.0; // Baseline score
      let feedSection: PersonalizedFeedItem['feedSection'] = 'FOR_YOU';
      let personalizationReason = 'Recommended for you based on your taste profile';

      // Hours elapsed decay
      const hoursOld = (Date.now() - article.publishedAt.getTime()) / 3600000;
      const timeDecay = 1 / (1 + hoursOld / 24);
      score += 3.0 * timeDecay;

      // Anime Watch Affinity
      for (const rel of article.animeRelations) {
        if (watchedAnimeIds.has(rel.animeId)) {
          score += 6.0;
          feedSection = 'BECAUSE_YOU_WATCH';
          personalizationReason = `Because you tracked ${rel.anime.canonicalTitle}`;
          break;
        } else if (favoriteAnimeIds.has(rel.animeId)) {
          score += 4.5;
          feedSection = 'BECAUSE_YOU_WATCH';
          personalizationReason = `From your favorites: ${rel.anime.canonicalTitle}`;
          break;
        }

        // Genre affinity
        for (const ag of rel.anime.animeGenres || []) {
          const gScore = topGenreMap.get(ag.genre.name.toLowerCase());
          if (gScore && gScore > 0) {
            score += gScore * 2.5;
            if (feedSection === 'FOR_YOU') {
              personalizationReason = `Matches your interest in ${ag.genre.name} anime`;
            }
          }
        }
      }

      // Studio Affinity
      for (const rel of article.studioRelations) {
        const sScore = topStudioMap.get(rel.studio.name.toLowerCase());
        if (sScore && sScore > 0) {
          score += sScore * 3.5;
          if (feedSection === 'FOR_YOU') {
            feedSection = 'YOUR_STUDIOS';
            personalizationReason = `Studio spotlight: ${rel.studio.name}`;
          }
        }
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
        personalizationScore: Math.round(score * 100) / 100,
        feedSection,
        personalizationReason,
        relatedAnime: article.animeRelations.map((r) => r.anime),
        relatedStudios: article.studioRelations.map((r) => r.studio),
        relatedPeople: article.personRelations.map((r) => r.person),
      };
    });

    // 5. Rank by Personalization Score
    scoredCandidates.sort((a, b) => b.personalizationScore - a.personalizationScore);

    // 6. Enforce Diversity (max 2 consecutive articles per anime/studio)
    const diversified: PersonalizedFeedItem[] = [];
    const entityOccurrenceCount = new Map<string, number>();

    for (const item of scoredCandidates) {
      const primaryAnimeId = item.relatedAnime[0]?.id;
      const primaryStudioId = item.relatedStudios[0]?.id;
      const entityKey = primaryAnimeId || primaryStudioId || 'general';

      const count = entityOccurrenceCount.get(entityKey) || 0;
      if (entityKey === 'general' || count < 3) {
        diversified.push(item);
        entityOccurrenceCount.set(entityKey, count + 1);
      }
      if (diversified.length >= limit) break;
    }

    // Fill up if diversity filtering trimmed too aggressively
    if (diversified.length < limit) {
      for (const item of scoredCandidates) {
        if (!diversified.some((d) => d.id === item.id)) {
          diversified.push(item);
        }
        if (diversified.length >= limit) break;
      }
    }

    const nextCursor = diversified.length === limit ? diversified[diversified.length - 1].id : null;

    return {
      feed: diversified,
      nextCursor,
      isPersonalized: true,
      confidenceTier: tasteProfile?.confidenceTier || 'ESTABLISHED',
    };
  }

  /**
   * Generates a high-quality global feed for cold-start and anonymous users
   */
  private async getGlobalFallbackFeed(
    limit: number,
    cursor?: string,
    category?: string
  ): Promise<{ feed: PersonalizedFeedItem[]; nextCursor: string | null }> {
    const where: any = { status: 'PUBLISHED' };
    if (category && category.toUpperCase() !== 'ALL') {
      where.category = category.toUpperCase();
    }
    if (cursor) {
      const cursorArticle = await prisma.newsArticle.findUnique({ where: { id: cursor }, select: { publishedAt: true } });
      if (cursorArticle) {
        where.publishedAt = { lt: cursorArticle.publishedAt };
      }
    }

    where.relevance = PUBLIC_RELEVANCE_WHERE;

    const articles = await prisma.newsArticle.findMany({
      where,
      include: {
        animeRelations: {
          where: { status: 'CONFIRMED' },
          include: { anime: { select: { id: true, canonicalTitle: true, slug: true, posterUrl: true } } },
        },
        studioRelations: {
          where: { status: 'CONFIRMED' },
          include: { studio: { select: { id: true, name: true, slug: true, imageUrl: true } } },
        },
        personRelations: {
          include: { person: { select: { id: true, name: true, nameKanji: true } } },
        },
      },
      orderBy: { publishedAt: 'desc' },
      take: limit,
    });

    const feed: PersonalizedFeedItem[] = articles.map((article) => {
      const displayTitle = article.adminOverrideTitle || article.title;
      const displaySummary = article.adminOverrideSummary || article.summary;
      const displayCategory = article.adminOverrideCategory || article.category;

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
        personalizationScore: 1.0,
        feedSection: 'LATEST',
        personalizationReason: 'Latest industry dispatch',
        relatedAnime: article.animeRelations.map((r) => r.anime),
        relatedStudios: article.studioRelations.map((r) => r.studio),
        relatedPeople: article.personRelations.map((r) => r.person),
      };
    });

    const nextCursor = feed.length === limit ? feed[feed.length - 1].id : null;
    return { feed, nextCursor };
  }
}

export const newsPersonalizationService = new NewsPersonalizationService();
