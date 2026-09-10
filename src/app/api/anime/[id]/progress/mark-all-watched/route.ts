import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { markAllEpisodesWatched } from '../../../../../../lib/engine/watch/watchEngine';
import { prisma } from '../../../../../../lib/prisma';

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

    const anime = await prisma.anime.findFirst({
      where: { OR: [{ id: params.id }, { slug: params.id }] },
    });

    if (!anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    const result = await markAllEpisodesWatched({
      userId: authUser.id,
      animeId: anime.id,
    });

    return NextResponse.json({
      success: true,
      animeId: anime.id,
      totalWatched: result.totalWatched,
      libraryStatus: 'COMPLETED',
    });
  } catch (error: any) {
    console.error('Error marking all episodes watched:', error);
    return NextResponse.json({ error: error.message || 'Failed to mark all episodes watched' }, { status: 500 });
  }
}
