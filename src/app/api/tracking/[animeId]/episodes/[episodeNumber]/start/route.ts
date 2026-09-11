import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../../lib/auth';
import { markEpisodeStarted } from '../../../../../../../lib/engine/watch/watchEngine';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { animeId: string; episodeNumber: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { animeId, episodeNumber } = params;
    const epNum = parseFloat(episodeNumber);

    if (isNaN(epNum)) {
      return NextResponse.json({ error: 'Invalid episode number' }, { status: 400 });
    }

    const result = await markEpisodeStarted({
      userId: authUser.id,
      animeId,
      episodeNumber: epNum,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error marking episode started:', error);
    const status = error.message === 'Anime not found' || error.message === 'Episode not found' ? 404 : 500;
    return NextResponse.json({ error: error.message || 'Failed to mark episode started' }, { status });
  }
}
