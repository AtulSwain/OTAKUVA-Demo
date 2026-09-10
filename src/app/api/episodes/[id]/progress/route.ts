import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { toggleEpisodeWatchStatus } from '../../../../../lib/engine/watch/watchEngine';
import { prisma } from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const episodeId = params.id;
    const body = await request.json().catch(() => ({}));
    const status = body.status as 'WATCHED' | 'UNWATCHED' | undefined;

    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
    });

    if (!episode) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    const result = await toggleEpisodeWatchStatus({
      userId: authUser.id,
      animeId: episode.animeId,
      episodeId: episode.id,
      status: status || 'WATCHED',
    });

    return NextResponse.json({
      success: true,
      episodeId: result.episodeId,
      episodeNumber: result.episodeNumber,
      isWatched: result.isWatched,
      totalCompleted: result.totalCompleted,
      userTracking: {
        status: result.userAnime.status,
        episodesWatched: result.userAnime.episodesWatched,
      },
    });
  } catch (error: any) {
    console.error('Error updating episode progress:', error);
    return NextResponse.json({ error: error.message || 'Failed to update episode progress' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const episodeId = params.id;
    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
    });

    if (!episode) {
      return NextResponse.json({ error: 'Episode not found' }, { status: 404 });
    }

    const result = await toggleEpisodeWatchStatus({
      userId: authUser.id,
      animeId: episode.animeId,
      episodeId: episode.id,
      status: 'UNWATCHED',
    });

    return NextResponse.json({
      success: true,
      episodeId: result.episodeId,
      isWatched: false,
      totalCompleted: result.totalCompleted,
    });
  } catch (error: any) {
    console.error('Error unmarking episode progress:', error);
    return NextResponse.json({ error: error.message || 'Failed to unmark episode progress' }, { status: 500 });
  }
}
