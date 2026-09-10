/**
 * OTAKUVA ANIME TRACKING & WATCH ENGINE
 * Manages manual tracking, episode progression, bookmarks, watchlist, and completion rules.
 * 
 * IMPORTANT PRODUCT RULE:
 * OTAKUVA does NOT stream, play, or host video. All tracking represents manual user-recorded actions.
 */

import { prisma } from '../../prisma';
import { emitEngineEvent } from '../events/eventEngine';

export type WatchStatus = 'PLAN_TO_WATCH' | 'WATCHING' | 'COMPLETED' | 'ON_HOLD' | 'DROPPED';

export interface UpdateTrackingInput {
  userId: string;
  animeId: string;
  status: WatchStatus;
  episodesWatched?: number;
  score?: number;
  notes?: string;
}

export interface EpisodeActionInput {
  userId: string;
  animeId: string;
  episodeNumber: number;
}

/**
 * Updates or adds an anime to a user's manual tracking list
 */
export async function updateAnimeTrackingStatus(input: UpdateTrackingInput) {
  const { userId, animeId, status, episodesWatched, score, notes } = input;

  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeId }, { slug: animeId }] },
    select: { id: true, canonicalTitle: true, episodes: true, status: true },
  });

  if (!anime) {
    throw new Error('Anime not found');
  }

  const resolvedAnimeId = anime.id;
  const isNowCompleted = status === 'COMPLETED';
  const now = new Date();

  const existing = await prisma.userAnime.findUnique({
    where: {
      userId_animeId: {
        userId,
        animeId: resolvedAnimeId,
      },
    },
  });

  const entry = await prisma.userAnime.upsert({
    where: {
      userId_animeId: {
        userId,
        animeId: resolvedAnimeId,
      },
    },
    update: {
      status,
      episodesWatched: episodesWatched !== undefined ? episodesWatched : existing?.episodesWatched,
      score: score !== undefined ? score : existing?.score,
      notes: notes !== undefined ? notes : existing?.notes,
      finishDate: isNowCompleted ? now : existing?.finishDate,
      startDate: status === 'WATCHING' && !existing?.startDate ? now : existing?.startDate,
    },
    create: {
      userId,
      animeId: resolvedAnimeId,
      status,
      episodesWatched: episodesWatched || 0,
      score: score || null,
      notes: notes || null,
      startDate: status === 'WATCHING' ? now : null,
      finishDate: isNowCompleted ? now : null,
    },
  });

  // Determine event type
  const eventType = !existing
    ? 'ANIME_TRACKING_STARTED'
    : isNowCompleted
    ? 'ANIME_MARKED_COMPLETED'
    : 'ANIME_STATUS_CHANGED';

  await emitEngineEvent({
    eventType,
    userId,
    entityType: 'ANIME',
    entityId: resolvedAnimeId,
    metadata: {
      status,
      title: anime.canonicalTitle,
      episodesWatched: entry.episodesWatched,
    },
  });

  return entry;
}

/**
 * Removes an anime from a user's tracking list
 */
export async function removeFromTracking(userId: string, animeId: string) {
  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeId }, { slug: animeId }] },
    select: { id: true, canonicalTitle: true },
  });

  if (!anime) {
    throw new Error('Anime not found');
  }

  const resolvedAnimeId = anime.id;

  await prisma.userAnime.deleteMany({
    where: {
      userId,
      animeId: resolvedAnimeId,
    },
  });

  await emitEngineEvent({
    eventType: 'WATCHLIST_REMOVED',
    userId,
    entityType: 'ANIME',
    entityId: resolvedAnimeId,
    metadata: {
      title: anime.canonicalTitle,
    },
  });

  return { success: true };
}

/**
 * Manually marks an episode as started
 */
export async function markEpisodeStarted(input: EpisodeActionInput) {
  const { userId, animeId, episodeNumber } = input;

  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeId }, { slug: animeId }] },
    include: {
      episodesList: {
        where: { number: episodeNumber },
      },
    },
  });

  if (!anime) {
    throw new Error('Anime not found');
  }

  const resolvedAnimeId = anime.id;

  // Ensure Episode record exists
  let episode = anime.episodesList[0];
  if (!episode) {
    episode = await prisma.episode.create({
      data: {
        animeId: resolvedAnimeId,
        number: episodeNumber,
        title: `Episode ${episodeNumber}`,
      },
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Upsert episode progress as STARTED if not already completed
    const existing = await tx.userEpisodeProgress.findUnique({
      where: {
        userId_episodeId: {
          userId,
          episodeId: episode.id,
        },
      },
    });

    const epProgress = await tx.userEpisodeProgress.upsert({
      where: {
        userId_episodeId: {
          userId,
          episodeId: episode.id,
        },
      },
      update: {
        startedAt: existing?.startedAt || new Date(),
      },
      create: {
        userId,
        animeId: resolvedAnimeId,
        episodeId: episode.id,
        episodeNumber,
        status: 'STARTED',
        startedAt: new Date(),
      },
    });

    // 2. Ensure UserAnime tracking exists and is in WATCHING state
    const userAnime = await tx.userAnime.upsert({
      where: {
        userId_animeId: {
          userId,
          animeId: resolvedAnimeId,
        },
      },
      update: {
        status: undefined, // keep current status unless unset
      },
      create: {
        userId,
        animeId: resolvedAnimeId,
        status: 'WATCHING',
        episodesWatched: 0,
        startDate: new Date(),
      },
    });

    return { epProgress, userAnime };
  });

  // Emit event
  await emitEngineEvent({
    eventType: 'EPISODE_MARKED_STARTED',
    userId,
    entityType: 'EPISODE',
    entityId: episode.id,
    metadata: {
      animeId: resolvedAnimeId,
      animeTitle: anime.canonicalTitle,
      episodeNumber,
    },
  });

  return result;
}

/**
 * Manually marks an episode as completed
 */
export async function markEpisodeCompleted(input: EpisodeActionInput) {
  const { userId, animeId, episodeNumber } = input;

  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeId }, { slug: animeId }] },
    include: {
      episodesList: {
        where: { number: episodeNumber },
      },
    },
  });

  if (!anime) {
    throw new Error('Anime not found');
  }

  const resolvedAnimeId = anime.id;

  // Ensure Episode record exists
  let episode = anime.episodesList[0];
  if (!episode) {
    episode = await prisma.episode.create({
      data: {
        animeId: resolvedAnimeId,
        number: episodeNumber,
        title: `Episode ${episodeNumber}`,
      },
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Record episode progress as COMPLETED
    const epProgress = await tx.userEpisodeProgress.upsert({
      where: {
        userId_episodeId: {
          userId,
          episodeId: episode.id,
        },
      },
      update: {
        status: 'COMPLETED',
        completedAt: new Date(),
        watchedAt: new Date(),
      },
      create: {
        userId,
        animeId: resolvedAnimeId,
        episodeId: episode.id,
        episodeNumber,
        status: 'COMPLETED',
        completedAt: new Date(),
        watchedAt: new Date(),
      },
    });

    // 2. Count distinct completed episodes
    const totalCompleted = await tx.userEpisodeProgress.count({
      where: {
        userId,
        animeId: resolvedAnimeId,
        status: 'COMPLETED',
      },
    });

    // 3. Airing & Completion check
    const isCurrentlyAiring =
      anime.status === 'CURRENTLY_AIRING' ||
      anime.status === 'RELEASING' ||
      anime.status === 'AIRING' ||
      anime.status === 'NOT_YET_AIRED';
    const isFullyCompleted =
      !isCurrentlyAiring && anime.episodes ? totalCompleted >= anime.episodes : false;

    const newStatus: WatchStatus = isFullyCompleted ? 'COMPLETED' : 'WATCHING';

    const userAnime = await tx.userAnime.upsert({
      where: {
        userId_animeId: {
          userId,
          animeId: resolvedAnimeId,
        },
      },
      update: {
        episodesWatched: totalCompleted,
        status: isFullyCompleted ? 'COMPLETED' : undefined,
        finishDate: isFullyCompleted ? new Date() : undefined,
      },
      create: {
        userId,
        animeId: resolvedAnimeId,
        episodesWatched: totalCompleted,
        status: newStatus,
        startDate: new Date(),
        finishDate: isFullyCompleted ? new Date() : null,
      },
    });

    return { epProgress, userAnime, totalCompleted, isFullyCompleted };
  });

  // Emit event
  await emitEngineEvent({
    eventType: 'EPISODE_MARKED_COMPLETED',
    userId,
    entityType: 'EPISODE',
    entityId: episode.id,
    metadata: {
      animeId: resolvedAnimeId,
      animeTitle: anime.canonicalTitle,
      episodeNumber,
      totalCompleted: result.totalCompleted,
      isFullyCompleted: result.isFullyCompleted,
    },
  });

  if (result.isFullyCompleted) {
    await emitEngineEvent({
      eventType: 'ANIME_MARKED_COMPLETED',
      userId,
      entityType: 'ANIME',
      entityId: resolvedAnimeId,
      metadata: {
        animeTitle: anime.canonicalTitle,
        totalEpisodes: anime.episodes,
      },
    });
  }

  return result;
}

export interface ToggleEpisodeWatchInput {
  userId: string;
  animeId: string;
  episodeId?: string;
  episodeNumber?: number;
  status?: 'WATCHED' | 'UNWATCHED';
}

/**
 * Toggles or explicitly sets watch status for a SINGLE episode
 */
export async function toggleEpisodeWatchStatus(input: ToggleEpisodeWatchInput) {
  const { userId, animeId, episodeId, episodeNumber, status } = input;

  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeId }, { slug: animeId }] },
    select: { id: true, canonicalTitle: true, episodes: true, status: true },
  });

  if (!anime) {
    throw new Error('Anime not found');
  }

  const resolvedAnimeId = anime.id;

  // Find target episode
  let episode: any = null;
  if (episodeId) {
    episode = await prisma.episode.findFirst({
      where: { id: episodeId, animeId: resolvedAnimeId },
    });
  } else if (episodeNumber !== undefined) {
    episode = await prisma.episode.findFirst({
      where: { animeId: resolvedAnimeId, number: episodeNumber },
    });
  }

  if (!episode) {
    if (episodeNumber !== undefined) {
      episode = await prisma.episode.create({
        data: {
          animeId: resolvedAnimeId,
          number: episodeNumber,
          title: `Episode ${episodeNumber}`,
        },
      });
    } else {
      throw new Error('Episode not found');
    }
  }

  // Check current progress
  const currentProgress = await prisma.userEpisodeProgress.findUnique({
    where: {
      userId_episodeId: {
        userId,
        episodeId: episode.id,
      },
    },
  });

  const shouldBeWatched = status ? status === 'WATCHED' : !currentProgress || currentProgress.status !== 'COMPLETED';

  const result = await prisma.$transaction(async (tx) => {
    let epProgress: any = null;
    if (shouldBeWatched) {
      epProgress = await tx.userEpisodeProgress.upsert({
        where: {
          userId_episodeId: {
            userId,
            episodeId: episode.id,
          },
        },
        update: {
          status: 'COMPLETED',
          completedAt: new Date(),
          watchedAt: new Date(),
        },
        create: {
          userId,
          animeId: resolvedAnimeId,
          episodeId: episode.id,
          episodeNumber: episode.number,
          status: 'COMPLETED',
          completedAt: new Date(),
          watchedAt: new Date(),
        },
      });
    } else {
      await tx.userEpisodeProgress.deleteMany({
        where: {
          userId,
          episodeId: episode.id,
        },
      });
    }

    const totalCompleted = await tx.userEpisodeProgress.count({
      where: {
        userId,
        animeId: resolvedAnimeId,
        status: 'COMPLETED',
      },
    });

    const isCurrentlyAiring =
      anime.status === 'CURRENTLY_AIRING' ||
      anime.status === 'RELEASING' ||
      anime.status === 'AIRING' ||
      anime.status === 'NOT_YET_AIRED';

    const isFullyCompleted =
      !isCurrentlyAiring && Boolean(anime.episodes) && totalCompleted >= (anime.episodes || 0);

    const userAnime = await tx.userAnime.upsert({
      where: {
        userId_animeId: {
          userId,
          animeId: resolvedAnimeId,
        },
      },
      update: {
        episodesWatched: totalCompleted,
        status: isFullyCompleted ? 'COMPLETED' : totalCompleted > 0 ? 'WATCHING' : undefined,
        finishDate: isFullyCompleted ? new Date() : undefined,
      },
      create: {
        userId,
        animeId: resolvedAnimeId,
        episodesWatched: totalCompleted,
        status: isFullyCompleted ? 'COMPLETED' : 'WATCHING',
        startDate: new Date(),
        finishDate: isFullyCompleted ? new Date() : null,
      },
    });

    return {
      episodeId: episode.id,
      episodeNumber: episode.number,
      isWatched: shouldBeWatched,
      totalCompleted,
      userAnime,
    };
  });

  await emitEngineEvent({
    eventType: shouldBeWatched ? 'EPISODE_MARKED_COMPLETED' : 'EPISODE_MARKED_UNWATCHED',
    userId,
    entityType: 'EPISODE',
    entityId: episode.id,
    metadata: {
      animeId: resolvedAnimeId,
      animeTitle: anime.canonicalTitle,
      episodeNumber: episode.number,
      totalCompleted: result.totalCompleted,
    },
  });

  return result;
}

/**
 * Explicitly marks all available episodes of an anime as watched
 */
export async function markAllEpisodesWatched(input: { userId: string; animeId: string }) {
  const { userId, animeId } = input;

  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeId }, { slug: animeId }] },
    include: { episodesList: true },
  });

  if (!anime) {
    throw new Error('Anime not found');
  }

  const resolvedAnimeId = anime.id;
  let allEpisodes = anime.episodesList;

  if (allEpisodes.length === 0) {
    const total = anime.episodes || 12;
    for (let i = 1; i <= total; i++) {
      await prisma.episode.create({
        data: {
          animeId: resolvedAnimeId,
          number: i,
          title: `Episode ${i}`,
        },
      });
    }
    allEpisodes = await prisma.episode.findMany({
      where: { animeId: resolvedAnimeId },
    });
  }

  await prisma.$transaction(async (tx) => {
    for (const ep of allEpisodes) {
      await tx.userEpisodeProgress.upsert({
        where: {
          userId_episodeId: {
            userId,
            episodeId: ep.id,
          },
        },
        update: {
          status: 'COMPLETED',
          completedAt: new Date(),
          watchedAt: new Date(),
        },
        create: {
          userId,
          animeId: resolvedAnimeId,
          episodeId: ep.id,
          episodeNumber: ep.number,
          status: 'COMPLETED',
          completedAt: new Date(),
          watchedAt: new Date(),
        },
      });
    }

    await tx.userAnime.upsert({
      where: {
        userId_animeId: {
          userId,
          animeId: resolvedAnimeId,
        },
      },
      update: {
        episodesWatched: allEpisodes.length,
        status: 'COMPLETED',
        finishDate: new Date(),
      },
      create: {
        userId,
        animeId: resolvedAnimeId,
        episodesWatched: allEpisodes.length,
        status: 'COMPLETED',
        startDate: new Date(),
        finishDate: new Date(),
      },
    });
  });

  return { success: true, totalWatched: allEpisodes.length };
}

/**
 * Explicitly marks all episodes of an anime as UNWATCHED
 */
export async function markAllEpisodesUnwatched(input: { userId: string; animeId: string }) {
  const { userId, animeId } = input;

  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeId }, { slug: animeId }] },
    select: { id: true, canonicalTitle: true },
  });

  if (!anime) {
    throw new Error('Anime not found');
  }

  const resolvedAnimeId = anime.id;

  await prisma.$transaction(async (tx) => {
    await tx.userEpisodeProgress.deleteMany({
      where: {
        userId,
        animeId: resolvedAnimeId,
      },
    });

    await tx.userAnime.updateMany({
      where: {
        userId,
        animeId: resolvedAnimeId,
      },
      data: {
        episodesWatched: 0,
        status: 'WATCHING',
        finishDate: null,
      },
    });
  });

  await emitEngineEvent({
    eventType: 'ANIME_STATUS_CHANGED',
    userId,
    entityType: 'ANIME',
    entityId: resolvedAnimeId,
    metadata: {
      action: 'MARK_ALL_UNWATCHED',
      animeTitle: anime.canonicalTitle,
      totalCompleted: 0,
    },
  });

  return { success: true, totalWatched: 0 };
}

/**
 * Mark a single episode watched
 */
export async function markEpisodeWatched(input: { userId: string; animeId: string; episodeId?: string; episodeNumber?: number }) {
  return toggleEpisodeWatchStatus({ ...input, status: 'WATCHED' });
}

/**
 * Mark a single episode unwatched
 */
export async function markEpisodeUnwatched(input: { userId: string; animeId: string; episodeId?: string; episodeNumber?: number }) {
  return toggleEpisodeWatchStatus({ ...input, status: 'UNWATCHED' });
}

/**
 * Calculates the lowest-numbered eligible unwatched episode
 */
export async function getNextUnwatchedEpisode(input: { userId: string; animeId: string }) {
  const { userId, animeId } = input;

  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeId }, { slug: animeId }] },
    include: {
      episodesList: {
        orderBy: { number: 'asc' },
      },
    },
  });

  if (!anime || !anime.episodesList.length) {
    return null;
  }

  const watched = await prisma.userEpisodeProgress.findMany({
    where: {
      userId,
      animeId: anime.id,
      status: 'COMPLETED',
    },
    select: { episodeId: true },
  });

  const watchedSet = new Set(watched.map((w) => w.episodeId));
  const nextEp = anime.episodesList.find((ep) => !watchedSet.has(ep.id));

  return nextEp || null;
}

/**
 * Returns comprehensive canonical progress snapshot for an authenticated user on an anime
 */
export async function getUserAnimeProgress(input: { userId: string; animeId: string }) {
  const { userId, animeId } = input;

  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeId }, { slug: animeId }] },
    include: {
      episodesList: {
        orderBy: { number: 'asc' },
      },
    },
  });

  if (!anime) {
    throw new Error('Anime not found');
  }

  const [userAnime, progress] = await Promise.all([
    prisma.userAnime.findUnique({
      where: { userId_animeId: { userId, animeId: anime.id } },
    }),
    prisma.userEpisodeProgress.findMany({
      where: { userId, animeId: anime.id, status: 'COMPLETED' },
      orderBy: { watchedAt: 'desc' },
      include: { episode: true },
    }),
  ]);

  const watchedEpisodeIds = progress.map((p) => p.episodeId);
  const watchedSet = new Set(watchedEpisodeIds);
  const totalEpisodes = anime.episodes || anime.episodesList.length || 0;
  const watchedCount = watchedEpisodeIds.length;
  const nextEp = anime.episodesList.find((ep) => !watchedSet.has(ep.id)) || null;
  const lastWatchedEp = progress.length > 0 ? progress[0].episode : null;

  return {
    animeId: anime.id,
    slug: anime.slug,
    libraryStatus: userAnime?.status || 'PLAN_TO_WATCH',
    watchedEpisodeIds,
    watchedCount,
    totalEpisodes,
    progressPercent: totalEpisodes > 0 ? Math.min(100, Math.round((watchedCount / totalEpisodes) * 100)) : null,
    nextEpisode: nextEp
      ? {
          id: nextEp.id,
          number: nextEp.number,
          title: nextEp.title,
          airedAt: nextEp.airedAt,
        }
      : null,
    lastWatchedEpisode: lastWatchedEp
      ? {
          id: lastWatchedEp.id,
          number: lastWatchedEp.number,
          title: lastWatchedEp.title,
        }
      : null,
  };
}

/**
 * Toggles or sets bookmark (Favorite) for an anime
 */
export async function toggleBookmark(userId: string, animeId: string) {
  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeId }, { slug: animeId }] },
    select: { id: true, canonicalTitle: true },
  });

  if (!anime) {
    throw new Error('Anime not found');
  }

  const resolvedAnimeId = anime.id;

  const existing = await prisma.favorite.findUnique({
    where: {
      userId_animeId: {
        userId,
        animeId: resolvedAnimeId,
      },
    },
  });

  if (existing) {
    await prisma.favorite.delete({
      where: { id: existing.id },
    });

    await emitEngineEvent({
      eventType: 'ANIME_UNBOOKMARKED',
      userId,
      entityType: 'ANIME',
      entityId: resolvedAnimeId,
      metadata: { title: anime.canonicalTitle },
    });

    return { bookmarked: false };
  } else {
    await prisma.favorite.create({
      data: {
        userId,
        animeId: resolvedAnimeId,
      },
    });

    await emitEngineEvent({
      eventType: 'ANIME_BOOKMARKED',
      userId,
      entityType: 'ANIME',
      entityId: resolvedAnimeId,
      metadata: { title: anime.canonicalTitle },
    });

    return { bookmarked: true };
  }
}

/**
 * Gets a user's categorized tracking list
 */
export async function getUserTrackingList(userId: string) {
  const [library, bookmarks, episodeProgress] = await Promise.all([
    prisma.userAnime.findMany({
      where: { userId },
      include: {
        anime: {
          select: {
            id: true,
            canonicalTitle: true,
            slug: true,
            posterUrl: true,
            bannerUrl: true,
            score: true,
            episodes: true,
            status: true,
            type: true,
            year: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.favorite.findMany({
      where: { userId },
      include: {
        anime: {
          select: {
            id: true,
            canonicalTitle: true,
            slug: true,
            posterUrl: true,
            score: true,
            episodes: true,
            status: true,
            type: true,
            year: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.userEpisodeProgress.findMany({
      where: { userId },
      orderBy: { watchedAt: 'desc' },
      take: 20,
    }),
  ]);

  const watching = library.filter((i) => i.status === 'WATCHING');
  const completed = library.filter((i) => i.status === 'COMPLETED');
  const planToWatch = library.filter((i) => i.status === 'PLAN_TO_WATCH');
  const onHold = library.filter((i) => i.status === 'ON_HOLD');
  const dropped = library.filter((i) => i.status === 'DROPPED');

  return {
    continueTracking: watching,
    watching,
    completed,
    planToWatch,
    onHold,
    dropped,
    bookmarked: bookmarks.map((b) => b.anime),
    recentEpisodeProgress: episodeProgress,
    totalTracked: library.length,
  };
}

// Backward compatibility aliases
export const updateWatchlistEntry = updateAnimeTrackingStatus;
export const completeEpisode = markEpisodeCompleted;
