import { NextRequest, NextResponse } from 'next/server';
import { awardCompletionMilestones } from '../../../../../../../lib/library/completionMilestones';
import { getAuthUserFromRequest } from '../../../../../../../lib/auth';
import { toggleEpisodeWatchStatus } from '../../../../../../../lib/engine/watch/watchEngine';
import { prisma } from '../../../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; episodeId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: animeId, episodeId } = params;
    const body = await request.json().catch(() => ({}));
    const status = body.status as 'WATCHED' | 'UNWATCHED' | undefined;
    const episodeNumber = body.episodeNumber ? parseFloat(body.episodeNumber) : undefined;

    // Verify episode belongs to anime
    const anime = await prisma.anime.findFirst({
      where: { OR: [{ id: animeId }, { slug: animeId }] },
    });

    if (!anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    let episode = await prisma.episode.findFirst({
      where: { id: episodeId, animeId: anime.id },
    });

    if (!episode && episodeNumber !== undefined) {
      episode = await prisma.episode.findFirst({
        where: { animeId: anime.id, number: episodeNumber },
      });
    }

    // Episodes are canonical catalog rows that come from ingestion. A user
    // marking progress can only reference one that exists — this used to
    // create an Episode from the client-supplied number, letting any
    // signed-in user add arbitrary episodes to any anime.
    if (!episode) {
      return NextResponse.json({ error: 'Episode does not belong to this anime or not found' }, { status: 404 });
    }

    const result = await toggleEpisodeWatchStatus({
      userId: authUser.id,
      animeId: anime.id,
      episodeId: episode.id,
      episodeNumber: episode.number,
      status,
    });

    await awardCompletionMilestones(authUser.id);

    return NextResponse.json({
      success: true,
      episodeId: result.episodeId,
      episodeNumber: result.episodeNumber,
      isWatched: result.isWatched,
      totalCompleted: result.totalCompleted,
      // null = not in the library (ticks don't add it there).
      userTracking: result.userAnime
        ? { status: result.userAnime.status, episodesWatched: result.userAnime.episodesWatched }
        : null,
    });
  } catch (error: any) {
    console.error('Error updating episode progress:', error);
    return NextResponse.json({ error: error.message || 'Failed to update episode progress' }, { status: 500 });
  }
}
