import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import {
  updateAnimeTrackingStatus,
  removeFromTracking,
  WatchStatus,
} from '../../../../lib/engine/watch/watchEngine';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { animeId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { animeId } = params;
    const body = await request.json();
    const { status, episodesWatched, score, notes } = body;

    const entry = await updateAnimeTrackingStatus({
      userId: authUser.id,
      animeId,
      status: (status || 'WATCHING') as WatchStatus,
      episodesWatched,
      score,
      notes,
    });

    return NextResponse.json({ success: true, tracking: entry });
  } catch (error: any) {
    console.error('Error modifying tracking:', error);
    const status = error.message === 'Anime not found' ? 404 : 500;
    return NextResponse.json({ error: error.message || 'Failed to update tracking' }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { animeId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { animeId } = params;
    const result = await removeFromTracking(authUser.id, animeId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error removing tracking:', error);
    return NextResponse.json({ error: error.message || 'Failed to remove from tracking' }, { status: 500 });
  }
}
