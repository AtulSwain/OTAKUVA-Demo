import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { getUserAnimeProgress } from '../../../../../lib/engine/watch/watchEngine';
import { prisma } from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const anime = await prisma.anime.findFirst({
      where: { OR: [{ id: params.id }, { slug: params.id }] },
    });

    if (!anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({
        animeId: anime.id,
        slug: anime.slug,
        libraryStatus: 'UNTRACKED',
        watchedEpisodeIds: [],
        watchedCount: 0,
        totalEpisodes: anime.episodes || 0,
        progressPercent: 0,
        nextEpisode: null,
      });
    }

    const progress = await getUserAnimeProgress({
      userId: authUser.id,
      animeId: anime.id,
    });

    return NextResponse.json(progress);
  } catch (error: any) {
    console.error('Error fetching anime progress:', error);
    return NextResponse.json({ error: 'Failed to fetch anime progress' }, { status: 500 });
  }
}
