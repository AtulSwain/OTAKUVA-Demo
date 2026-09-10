/**
 * OTAKUVA CANONICAL SEASON ENGINE — PHASE 3
 * 
 * Manages canonical direct seasons, arc partitioning, franchise-connected seasons,
 * episode linking, and season-level watch progress tracking.
 */

import { prisma } from '../../prisma';
import { SeasonSummaryDto, EpisodeDto } from '../../contracts/apiContracts';
import { CacheManager } from '../../performance/cacheManager';

export class SeasonEngine {
  private static CACHE_TTL_SEASONS = 600; // 10 minutes

  /**
   * Retrieves all canonical direct seasons and connected franchise productions for an anime
   */
  static async getAnimeSeasons(
    animeIdOrSlug: string,
    authUserId?: string
  ): Promise<{
    animeId: string;
    slug: string;
    directSeasons: SeasonSummaryDto[];
    franchises: any[];
    connectedSeasons: any[];
    cached?: boolean;
  }> {
    const anime = await prisma.anime.findFirst({
      where: { OR: [{ id: animeIdOrSlug }, { slug: animeIdOrSlug }] },
      select: { id: true, canonicalTitle: true, slug: true, episodes: true },
    });

    if (!anime) {
      throw new Error('Anime not found');
    }

    // 1. Fetch direct canonical seasons with linked episodes
    let directSeasons = await prisma.season.findMany({
      where: { animeId: anime.id },
      include: {
        episodes: {
          orderBy: { number: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    // Auto-reconciliation: If anime has episodes in DB but 0 Season records, ensure Season 1 exists
    if (directSeasons.length === 0) {
      await this.ensureCanonicalSeasons(anime.id);
      directSeasons = await prisma.season.findMany({
        where: { animeId: anime.id },
        include: {
          episodes: {
            orderBy: { number: 'asc' },
          },
        },
        orderBy: { sortOrder: 'asc' },
      });
    }

    // 2. Fetch franchise anime links for connected seasons
    const franchiseLinks = await prisma.franchiseAnime.findMany({
      where: {
        franchise: { items: { some: { animeId: anime.id } } },
      },
      include: {
        franchise: { select: { id: true, name: true, slug: true } },
        anime: {
          select: {
            id: true,
            slug: true,
            canonicalTitle: true,
            type: true,
            season: true,
            seasonYear: true,
            year: true,
            episodes: true,
            posterUrl: true,
            score: true,
          },
        },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });

    // 3. User progress per episode if authenticated
    let userWatchedEpisodeIds = new Set<string>();
    if (authUserId) {
      const userProgress = await prisma.userEpisodeProgress.findMany({
        where: { userId: authUserId, animeId: anime.id, status: 'COMPLETED' },
        select: { episodeId: true },
      });
      userWatchedEpisodeIds = new Set(userProgress.map((p) => p.episodeId));
    }

    const formattedDirectSeasons: SeasonSummaryDto[] = directSeasons.map((s) => {
      const episodes: EpisodeDto[] = s.episodes.map((ep) => ({
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
        isWatched: userWatchedEpisodeIds.has(ep.id),
      }));

      return {
        id: s.id,
        seasonNumber: s.seasonNumber,
        title: s.title,
        slug: s.slug,
        description: s.description,
        coverImage: s.coverImage,
        year: s.year,
        seasonType: s.seasonType,
        startDate: s.startDate ? s.startDate.toISOString() : null,
        endDate: s.endDate ? s.endDate.toISOString() : null,
        episodeCount: episodes.length || s.episodeCount || 0,
        sortOrder: s.sortOrder,
        episodes,
        watchedCount: episodes.filter((e) => e.isWatched).length,
      };
    });

    const uniqueFranchise = new Map<string, typeof franchiseLinks[number]>();
    for (const link of franchiseLinks) uniqueFranchise.set(link.anime.id, link);

    return {
      animeId: anime.id,
      slug: anime.slug,
      directSeasons: formattedDirectSeasons,
      franchises: [...new Map(franchiseLinks.map((link) => [link.franchise.id, link.franchise])).values()],
      connectedSeasons: [...uniqueFranchise.values()].map((link) => ({
        id: link.anime.id,
        slug: link.anime.slug,
        title: link.anime.canonicalTitle,
        relationship: link.relationship,
        position: link.position,
        type: link.anime.type,
        season: link.anime.season,
        seasonYear: link.anime.seasonYear,
        year: link.anime.year,
        episodes: link.anime.episodes,
        posterUrl: link.anime.posterUrl,
        score: link.anime.score,
      })),
    };
  }

  /**
   * Retrieves detail for a specific season ID
   */
  static async getSeasonDetail(
    seasonId: string,
    authUserId?: string
  ): Promise<{
    season: SeasonSummaryDto;
    anime: { id: string; slug: string; canonicalTitle: string; posterUrl: string };
  } | null> {
    const season = await prisma.season.findUnique({
      where: { id: seasonId },
      include: {
        anime: {
          select: { id: true, slug: true, canonicalTitle: true, posterUrl: true },
        },
        episodes: {
          orderBy: { number: 'asc' },
        },
      },
    });

    if (!season) return null;

    let userWatchedEpisodeIds = new Set<string>();
    if (authUserId) {
      const userProgress = await prisma.userEpisodeProgress.findMany({
        where: { userId: authUserId, animeId: season.animeId, status: 'COMPLETED' },
        select: { episodeId: true },
      });
      userWatchedEpisodeIds = new Set(userProgress.map((p) => p.episodeId));
    }

    const episodes: EpisodeDto[] = season.episodes.map((ep) => ({
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
      isWatched: userWatchedEpisodeIds.has(ep.id),
    }));

    return {
      season: {
        id: season.id,
        seasonNumber: season.seasonNumber,
        title: season.title,
        slug: season.slug,
        description: season.description,
        coverImage: season.coverImage,
        year: season.year,
        seasonType: season.seasonType,
        startDate: season.startDate ? season.startDate.toISOString() : null,
        endDate: season.endDate ? season.endDate.toISOString() : null,
        episodeCount: episodes.length || season.episodeCount || 0,
        sortOrder: season.sortOrder,
        episodes,
        watchedCount: episodes.filter((e) => e.isWatched).length,
      },
      anime: season.anime,
    };
  }

  /**
   * Ensures that default Season 1 exists and links any unassigned episodes for an anime
   */
  static async ensureCanonicalSeasons(animeId: string): Promise<void> {
    const unlinkedEpisodes = await prisma.episode.findMany({
      where: { animeId, seasonId: null },
      orderBy: { number: 'asc' },
    });

    if (unlinkedEpisodes.length === 0) return;

    // Find or create Season 1
    let season1 = await prisma.season.findUnique({
      where: { animeId_seasonNumber: { animeId, seasonNumber: 1 } },
    });

    if (!season1) {
      season1 = await prisma.season.create({
        data: {
          animeId,
          seasonNumber: 1,
          title: 'Season 1',
          seasonType: 'MAIN',
          episodeCount: unlinkedEpisodes.length,
          sortOrder: 1,
        },
      });
    }

    // Link unlinked episodes to Season 1
    await prisma.episode.updateMany({
      where: { animeId, seasonId: null },
      data: { seasonId: season1.id },
    });
  }
}
