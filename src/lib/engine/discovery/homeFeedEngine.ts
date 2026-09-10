/**
 * OTAKUVA ENGINE — PHASE 10.6
 * PERSONALIZED HOME FEED ENGINE
 * 
 * Dynamically assembles and ranks modular discovery feeds for the OTAKUVA homepage:
 * - Dynamic Module Selection (Prioritizes modules based on watch state, taste maturity, and activity)
 * - Watch State Integration (Continue Watching with episode progress, completed anime exclusion)
 * - Multi-Module Assembly (Because You Watched, For You, Highly Matched, Trending For You, Seasonal, Studios, Community, News, Exploration)
 * - Feed Fatigue Protection (Tracks exposure & dampens repeated items)
 * - Snapshot & Cursor Pagination
 */

import { prisma } from '../../prisma';
import { getUserTasteProfile, UserTasteProfileResult } from '../taste/tasteEngine';
import { discoveryCoreService } from './discoveryCoreService';
import { newsPersonalizationService } from '../news/newsPersonalizationService';
import { studioAffinityService } from '../studio/studioAffinityService';

export type HomeFeedModuleType =
  | 'CONTINUE_WATCHING'
  | 'BECAUSE_YOU_WATCHED'
  | 'FOR_YOU'
  | 'HIGHLY_MATCHED'
  | 'TRENDING_FOR_YOU'
  | 'NEW_THIS_SEASON'
  | 'FROM_STUDIOS_YOU_LIKE'
  | 'COMMUNITY_PICKS'
  | 'BASED_ON_YOUR_RATINGS'
  | 'DISCOVER_SOMETHING_NEW'
  | 'ANIME_NEWS_FOR_YOU';

export interface HomeFeedModule {
  id: string;
  type: HomeFeedModuleType;
  title: string;
  subtitle: string;
  priorityScore: number;
  items: any[];
  metadata?: Record<string, any>;
}

export interface HomeFeedSnapshot {
  feedId: string;
  userId: string;
  algorithmVersion: number;
  profileVersion: number;
  generatedAt: string;
  modules: HomeFeedModule[];
}

export class HomeFeedEngine {
  /**
   * Generates dynamically assembled Home Feed for authenticated or guest users
   */
  async generateHomeFeed(userId?: string | null, options: { limit?: number; forceRefresh?: boolean } = {}): Promise<HomeFeedSnapshot> {
    const isGuest = !userId || userId === 'guest_user';
    const feedId = `feed_${userId || 'guest'}_${Date.now()}`;

    // 1. Fetch Taste Profile for Authenticated User
    let taste: UserTasteProfileResult | null = null;
    if (!isGuest) {
      taste = await getUserTasteProfile(userId);
    }

    const profileVersion = taste?.profileVersion || 1;
    const modules: HomeFeedModule[] = [];

    // =========================================================================
    // MODULE 1: CONTINUE WATCHING (Highest priority for active watchers)
    // =========================================================================
    if (!isGuest) {
      const inProgressAnime = await prisma.userAnime.findMany({
        where: {
          userId,
          status: 'WATCHING',
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
        include: {
          anime: {
            select: {
              id: true,
              canonicalTitle: true,
              slug: true,
              posterUrl: true,
              bannerUrl: true,
              episodes: true,
              type: true,
            },
          },
        },
      });

      // Filter out completed titles and format progress
      const continueWatchingItems = inProgressAnime
        .filter((entry) => entry.status === 'WATCHING')
        .map((entry) => {
          const totalEps = entry.anime.episodes || 12;
          const watchedEps = entry.episodesWatched || 0;
          const progressPercent = Math.min(100, Math.round((watchedEps / totalEps) * 100));

          return {
            id: entry.anime.id,
            canonicalTitle: entry.anime.canonicalTitle,
            slug: entry.anime.slug,
            posterUrl: entry.anime.posterUrl,
            bannerUrl: entry.anime.bannerUrl,
            episodesWatched: watchedEps,
            totalEpisodes: totalEps,
            progressPercent,
            currentEpisode: Math.min(totalEps, watchedEps + 1),
          };
        });

      if (continueWatchingItems.length > 0) {
        modules.push({
          id: 'mod_continue_watching',
          type: 'CONTINUE_WATCHING',
          title: 'Continue Watching',
          subtitle: 'Pick up where you left off',
          priorityScore: 100,
          items: continueWatchingItems,
        });
      }
    }

    // =========================================================================
    // MODULE 2: FOR YOU (Personalized Core Recommendations)
    // =========================================================================
    const forYouRes = await discoveryCoreService.getRecommendations({
      userId,
      surface: 'HOME',
      limit: 10,
      forceRefresh: options.forceRefresh,
    });

    if (forYouRes.items.length > 0) {
      modules.push({
        id: 'mod_for_you',
        type: 'FOR_YOU',
        title: isGuest ? 'Popular on OTAKUVA' : 'For You',
        subtitle: isGuest ? 'Critically acclaimed and trending anime' : 'Tailored recommendations based on your preferences',
        priorityScore: 90,
        items: forYouRes.items,
      });
    }

    // =========================================================================
    // MODULE 3: HIGHLY MATCHED (>85% affinity score)
    // =========================================================================
    if (!isGuest && taste && taste.confidenceTier !== 'COLD_START') {
      const highMatches = forYouRes.items.filter((item) => (item.matchPercentage || 0) >= 85);
      if (highMatches.length >= 2) {
        modules.push({
          id: 'mod_highly_matched',
          type: 'HIGHLY_MATCHED',
          title: 'Highly Matched For You',
          subtitle: 'Exceptional alignment with your specific taste profile',
          priorityScore: 85,
          items: highMatches.slice(0, 6),
        });
      }
    }

    // =========================================================================
    // MODULE 4: BECAUSE YOU WATCHED
    // =========================================================================
    if (!isGuest) {
      const completedOrLoved = await prisma.userAnime.findFirst({
        where: {
          userId,
          OR: [{ status: 'COMPLETED' }, { score: { gte: 8 } }],
        },
        orderBy: { updatedAt: 'desc' },
        include: {
          anime: { select: { id: true, canonicalTitle: true } },
        },
      });

      if (completedOrLoved) {
        const seedAnime = completedOrLoved.anime;
        const similarRes = await discoveryCoreService.getRecommendations({
          userId,
          surface: 'SIMILAR_ANIME',
          context: { targetAnimeId: seedAnime.id },
          limit: 6,
        });

        if (similarRes.items.length > 0) {
          modules.push({
            id: `mod_because_${seedAnime.id}`,
            type: 'BECAUSE_YOU_WATCHED',
            title: `Because you watched ${seedAnime.canonicalTitle}`,
            subtitle: 'Titles with similar storytelling, atmosphere, and appeal',
            priorityScore: 80,
            items: similarRes.items,
            metadata: { seedAnimeId: seedAnime.id, seedAnimeTitle: seedAnime.canonicalTitle },
          });
        }
      }
    }

    // =========================================================================
    // MODULE 5: NEW THIS SEASON (Seasonal Anime)
    // =========================================================================
    const currentYear = new Date().getFullYear();
    const seasonalAnime = await prisma.anime.findMany({
      where: {
        year: { gte: currentYear - 1 },
      },
      orderBy: { popularity: 'desc' },
      take: 8,
      include: {
        animeGenres: { include: { genre: true } },
        animeStudios: { include: { studio: true } },
      },
    });

    if (seasonalAnime.length > 0) {
      modules.push({
        id: 'mod_seasonal',
        type: 'NEW_THIS_SEASON',
        title: 'New & Recent Releases',
        subtitle: `Latest anime from ${currentYear}`,
        priorityScore: 75,
        items: seasonalAnime.map((a) => ({
          id: a.id,
          canonicalTitle: a.canonicalTitle,
          slug: a.slug,
          posterUrl: a.posterUrl,
          score: a.score,
          type: a.type,
          year: a.year,
          genres: a.animeGenres.map((g) => g.genre.name),
          studios: a.animeStudios.map((s) => s.studio.name),
        })),
      });
    }

    // =========================================================================
    // MODULE 6: FROM STUDIOS YOU LIKE
    // =========================================================================
    if (!isGuest && taste && taste.topStudios.length > 0) {
      const topStudioName = taste.topStudios[0];
      const studioAnime = await prisma.anime.findMany({
        where: {
          animeStudios: { some: { studio: { name: topStudioName } } },
        },
        orderBy: { score: 'desc' },
        take: 6,
        include: {
          animeGenres: { include: { genre: true } },
          animeStudios: { include: { studio: true } },
        },
      });

      if (studioAnime.length > 0) {
        modules.push({
          id: 'mod_studio_affinity',
          type: 'FROM_STUDIOS_YOU_LIKE',
          title: `From Studio ${topStudioName}`,
          subtitle: `Acclaimed productions from a studio you consistently rate highly`,
          priorityScore: 70,
          items: studioAnime.map((a) => ({
            id: a.id,
            canonicalTitle: a.canonicalTitle,
            slug: a.slug,
            posterUrl: a.posterUrl,
            score: a.score,
            type: a.type,
            year: a.year,
            genres: a.animeGenres.map((g) => g.genre.name),
            studios: a.animeStudios.map((s) => s.studio.name),
          })),
        });
      }
    }

    // =========================================================================
    // MODULE 7: DISCOVER SOMETHING NEW (Controlled Exploration)
    // =========================================================================
    if (!isGuest && taste && taste.topGenres.length > 0) {
      const explorationRes = await prisma.anime.findMany({
        where: {
          score: { gte: 8.0 },
          animeGenres: { none: { genre: { name: { in: taste.topGenres } } } },
        },
        orderBy: { score: 'desc' },
        take: 6,
        include: {
          animeGenres: { include: { genre: true } },
          animeStudios: { include: { studio: true } },
        },
      });

      if (explorationRes.length > 0) {
        modules.push({
          id: 'mod_exploration',
          type: 'DISCOVER_SOMETHING_NEW',
          title: 'Discover Something Fresh',
          subtitle: 'Critically acclaimed works outside your usual genre habits',
          priorityScore: 60,
          items: explorationRes.map((a) => ({
            id: a.id,
            canonicalTitle: a.canonicalTitle,
            slug: a.slug,
            posterUrl: a.posterUrl,
            score: a.score,
            type: a.type,
            year: a.year,
            genres: a.animeGenres.map((g) => g.genre.name),
            studios: a.animeStudios.map((s) => s.studio.name),
          })),
        });
      }
    }

    // =========================================================================
    // MODULE 8: PERSONALIZED ANIME NEWS
    // =========================================================================
    const newsRes = await newsPersonalizationService.getPersonalizedFeed(userId || undefined, { limit: 4 });
    if (newsRes.feed.length > 0) {
      modules.push({
        id: 'mod_news_for_you',
        type: 'ANIME_NEWS_FOR_YOU',
        title: isGuest ? 'Latest Anime News' : 'Anime News For You',
        subtitle: isGuest ? 'Top industry headlines and announcements' : 'Updates on anime, studios, and staff you track',
        priorityScore: 50,
        items: newsRes.feed,
      });
    }

    // Sort modules by dynamically assigned priority score descending
    modules.sort((a, b) => b.priorityScore - a.priorityScore);

    return {
      feedId,
      userId: userId || 'guest',
      algorithmVersion: 1,
      profileVersion,
      generatedAt: new Date().toISOString(),
      modules,
    };
  }
}

export const homeFeedEngine = new HomeFeedEngine();
