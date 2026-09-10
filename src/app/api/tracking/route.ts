import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../lib/auth';
import {
  getUserTrackingList,
  updateAnimeTrackingStatus,
  WatchStatus,
} from '../../../lib/engine/watch/watchEngine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const result = await getUserTrackingList(authUser.id);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error fetching tracking list:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch tracking list' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { animeId, status, episodesWatched, score, notes } = body;

    if (!animeId || !status) {
      return NextResponse.json({ error: 'animeId and status are required' }, { status: 400 });
    }

    const entry = await updateAnimeTrackingStatus({
      userId: authUser.id,
      animeId,
      status: status as WatchStatus,
      episodesWatched,
      score,
      notes,
    });

    return NextResponse.json({ success: true, tracking: entry });
  } catch (error: any) {
    console.error('Error updating tracking status:', error);
    const status = error.message === 'Anime not found' ? 404 : 500;
    return NextResponse.json({ error: error.message || 'Failed to update tracking' }, { status });
  }
}
