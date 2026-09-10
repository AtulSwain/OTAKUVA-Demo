import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { toggleEpisodeWatchStatus } from '../../../../lib/engine/watch/watchEngine';
import { EpisodeEngine } from '../../../../lib/engine/anime/episodeEngine';
import { withApiHandler } from '../../../../lib/api/apiHandler';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler('EpisodeGet', async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const authUser = await getAuthUserFromRequest(request);
  const identifier = params.id;

  // 1. Check if identifier is an Episode ID
  const singleEpisode = await EpisodeEngine.getEpisodeDetail(identifier, authUser?.id);
  if (singleEpisode) {
    return {
      data: singleEpisode,
      episode: singleEpisode,
    };
  }

  // 2. Otherwise treat as Anime ID / slug for backwards-compatible episode progress roster
  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: identifier }, { slug: identifier }] },
  });

  if (!anime) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Episode or Anime not found for identifier: ${identifier}`,
          timestamp: new Date().toISOString(),
        },
      },
      { status: 404 }
    );
  }

  if (!authUser) {
    return {
      data: {
        animeId: anime.id,
        watchedEpisodes: [] as number[],
        count: 0,
      },
      animeId: anime.id,
      watchedEpisodes: [] as number[],
      count: 0,
    };
  }

  const records = await prisma.userEpisodeProgress.findMany({
    where: { userId: authUser.id, animeId: anime.id, status: 'COMPLETED' },
    include: { episode: true },
    orderBy: { episode: { number: 'asc' } },
  });

  return {
    data: {
      animeId: anime.id,
      watchedEpisodes: records.map((r) => r.episode.number),
      count: records.length,
    },
    animeId: anime.id,
    watchedEpisodes: records.map((r) => r.episode.number),
    count: records.length,
  };
});

export const POST = withApiHandler('EpisodeWatchToggle', async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'UNAUTHENTICATED',
          message: 'Authentication required to track episode progress',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 401 }
    );
  }

  const userId = authUser.id;
  const animeIdOrSlug = params.id;
  const body = await request.json();

  const { episodeId, episodeNumber, watched } = body;

  if (typeof watched !== 'boolean' || (episodeId === undefined && (typeof episodeNumber !== 'number' || episodeNumber < 1))) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'episodeId (or valid episodeNumber) and boolean watched status are required',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 400 }
    );
  }

  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeIdOrSlug }, { slug: animeIdOrSlug }] },
  });

  if (!anime) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Anime not found',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 404 }
    );
  }

  const resolvedAnimeId = anime.id;

  const episode = await prisma.episode.findFirst({
    where: {
      animeId: resolvedAnimeId,
      ...(typeof episodeId === 'string' ? { id: episodeId } : { number: episodeNumber }),
    },
  });

  if (!episode) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Canonical episode not found for this anime',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 404 }
    );
  }

  const result = await toggleEpisodeWatchStatus({
    userId,
    animeId: resolvedAnimeId,
    episodeId: episode.id,
    status: watched ? 'WATCHED' : 'UNWATCHED',
  });

  return {
    data: {
      episodesWatched: result.totalCompleted,
      watchedEpisodes: watched ? [result.episodeNumber] : [],
      userAnime: { ...result.userAnime, status: result.userAnime.status.toLowerCase() },
    },
    episodesWatched: result.totalCompleted,
    watchedEpisodes: watched ? [result.episodeNumber] : [],
    userAnime: { ...result.userAnime, status: result.userAnime.status.toLowerCase() },
  };
});
