/**
 * OTAKUVA CANONICAL EPISODE ENGINE — PHASE 3
 * 
 * Manages episode retrieval, pagination, season filtering, filler/recap categorization,
 * next/previous episode navigation, and user watch progress integration.
 */

import { prisma } from '../../prisma';
import { EpisodeDto, EpisodeDetailDto, PaginationMeta } from '../../contracts/apiContracts';
import { getAnimeDisplayTitle } from '../../animeTitleResolver';

export interface EpisodeQueryParams {
  page?: number;
  limit?: number;
  seasonId?: string;
  filler?: boolean;
}

export class EpisodeEngine {
  /**
   * Retrieves paginated episodes for an anime with user watch progress and next unwatched episode pointer
   */
  static async getAnimeEpisodes(
    animeIdOrSlug: string,
    params: EpisodeQueryParams = {},
    authUserId?: string
  ): Promise<{
    animeId: string;
    slug: string;
    title: string;
    episodes: EpisodeDto[];
    seasons?: Array<{
      id: string;
      seasonNumber: number;
      title: string;
      slug?: string;
      episodeCount: number;
    }>;
    pagination: PaginationMeta;
    progress?: {
      watchedCount: number;
      watchedEpisodes: number[];
      watchedEpisodeIds: string[];
      totalCount: number;
      percent: number | null;
      nextUnwatchedEpisodeId: string | null;
      nextUnwatchedEpisodeNumber: number | null;
    };
  }> {
    const anime = await prisma.anime.findFirst({
      where: { OR: [{ id: animeIdOrSlug }, { slug: animeIdOrSlug }] },
      select: { id: true, slug: true, canonicalTitle: true, episodes: true },
    });

    if (!anime) {
      throw new Error('Anime not found');
    }

    const page = Math.max(1, params.page || 1);
    const limit = Math.min(Math.max(1, params.limit || 50), 100);
    const skip = (page - 1) * limit;

    const where: any = { animeId: anime.id };
    if (params.seasonId) {
      where.seasonId = params.seasonId;
    }
    if (params.filler !== undefined) {
      where.filler = params.filler;
    }

    const [episodes, totalCount, seasons] = await Promise.all([
      prisma.episode.findMany({
        where,
        orderBy: { number: 'asc' },
        skip,
        take: limit,
      }),
      prisma.episode.count({ where }),
      prisma.season.findMany({
        where: { animeId: anime.id },
        orderBy: { seasonNumber: 'asc' },
        select: {
          id: true,
          seasonNumber: true,
          title: true,
          slug: true,
          episodeCount: true,
        },
      }),
    ]);

    let watchedEpisodeNumbers: number[] = [];
    let watchedEpisodeIds: string[] = [];

    if (authUserId) {
      const userProgress = await prisma.userEpisodeProgress.findMany({
        where: { userId: authUserId, animeId: anime.id, status: 'COMPLETED' },
        include: { episode: true },
      });
      watchedEpisodeNumbers = userProgress.map((p) => p.episode.number);
      watchedEpisodeIds = userProgress.map((p) => p.episodeId);
    }

    const watchedSet = new Set(watchedEpisodeIds);

    const formattedEpisodes: EpisodeDto[] = episodes.map((ep) => ({
      id: ep.id,
      animeId: ep.animeId,
      seasonId: ep.seasonId,
      number: ep.number,
      absoluteEpisodeNumber: ep.absoluteEpisodeNumber,
      canonicalOrder: ep.canonicalOrder,
      title: ep.title,
      titleJapanese: ep.titleJapanese,
      synopsis: ep.synopsis,
      airedAt: ep.airedAt ? ep.airedAt.toISOString() : null,
      duration: ep.duration,
      filler: ep.filler,
      recap: ep.recap,
      status: ep.status,
      imageUrl: ep.imageUrl,
      isWatched: watchedSet.has(ep.id) || watchedEpisodeNumbers.includes(ep.number),
    }));

    // Next episode = the lowest-numbered *released* episode the viewer hasn't
    // watched. Episodes that haven't aired yet are never "next".
    let nextUnwatchedId: string | null = null;
    let nextUnwatchedNumber: number | null = null;

    if (authUserId) {
      const now = new Date();
      const firstUnwatched = await prisma.episode.findFirst({
        where: {
          animeId: anime.id,
          id: { notIn: watchedEpisodeIds },
          status: { notIn: ['UPCOMING', 'CANCELLED'] },
          OR: [{ airedAt: null }, { airedAt: { lte: now } }],
        },
        orderBy: { number: 'asc' },
        select: { id: true, number: true },
      });
      if (firstUnwatched) {
        nextUnwatchedId = firstUnwatched.id;
        nextUnwatchedNumber = firstUnwatched.number;
      }
    }

    const totalEpisodesCount = anime.episodes || totalCount;
    const pagination: PaginationMeta = {
      page,
      limit,
      total: totalCount,
      totalPages: Math.ceil(totalCount / limit) || 1,
      hasNextPage: page * limit < totalCount,
      hasPrevPage: page > 1,
    };

    return {
      animeId: anime.id,
      slug: anime.slug,
      title: anime.canonicalTitle,
      episodes: formattedEpisodes,
      seasons: seasons.map((s) => ({
        id: s.id,
        seasonNumber: s.seasonNumber,
        title: s.title,
        slug: s.slug || undefined,
        episodeCount: s.episodeCount || 0,
      })),
      pagination,
      progress: {
        watchedCount: watchedEpisodeIds.length,
        watchedEpisodes: watchedEpisodeNumbers,
        watchedEpisodeIds,
        totalCount: totalEpisodesCount,
        percent: totalEpisodesCount > 0 ? Math.round((watchedEpisodeIds.length / totalEpisodesCount) * 100) : null,
        nextUnwatchedEpisodeId: nextUnwatchedId,
        nextUnwatchedEpisodeNumber: nextUnwatchedNumber,
      },
    };
  }

  /**
   * Retrieves full detail for an individual episode, including anime, season, and prev/next links
   */
  static async getEpisodeDetail(
    episodeId: string,
    authUserId?: string
  ): Promise<EpisodeDetailDto | null> {
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      include: {
        anime: {
          select: {
            id: true,
            slug: true,
            canonicalTitle: true,
            posterUrl: true,
            type: true,
            episodes: true,
          },
        },
        season: {
          select: {
            id: true,
            seasonNumber: true,
            title: true,
            seasonType: true,
          },
        },
      },
    });

    if (!episode) return null;

    const [prevEpisode, nextEpisode, userProgress, userRating] = await Promise.all([
      prisma.episode.findFirst({
        where: { animeId: episode.animeId, number: { lt: episode.number } },
        orderBy: { number: 'desc' },
        select: { id: true, number: true, title: true },
      }),
      prisma.episode.findFirst({
        where: { animeId: episode.animeId, number: { gt: episode.number } },
        orderBy: { number: 'asc' },
        select: { id: true, number: true, title: true },
      }),
      authUserId
        ? prisma.userEpisodeProgress.findUnique({
            where: { userId_episodeId: { userId: authUserId, episodeId: episode.id } },
          })
        : null,
      authUserId
        ? prisma.episodeRating.findUnique({
            where: { userId_episodeId: { userId: authUserId, episodeId: episode.id } },
          })
        : null,
    ]);

    const isWatched = userProgress?.status === 'COMPLETED';

    return {
      id: episode.id,
      animeId: episode.animeId,
      seasonId: episode.seasonId,
      number: episode.number,
      absoluteEpisodeNumber: episode.absoluteEpisodeNumber,
      canonicalOrder: episode.canonicalOrder,
      title: episode.title,
      titleJapanese: episode.titleJapanese,
      synopsis: episode.synopsis,
      airedAt: episode.airedAt ? episode.airedAt.toISOString() : null,
      duration: episode.duration,
      filler: episode.filler,
      recap: episode.recap,
      status: episode.status,
      imageUrl: episode.imageUrl,
      isWatched,
      userRating: userRating?.rating || null,
      anime: {
        id: episode.anime.id,
        slug: episode.anime.slug,
        title: episode.anime.canonicalTitle,
        canonicalTitle: episode.anime.canonicalTitle,
        posterUrl: episode.anime.posterUrl,
        type: episode.anime.type,
        totalEpisodes: episode.anime.episodes,
      },
      season: episode.season,
      previousEpisode: prevEpisode,
      nextEpisode: nextEpisode,
    };
  }
}
