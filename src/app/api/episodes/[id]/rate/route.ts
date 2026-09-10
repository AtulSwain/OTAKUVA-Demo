import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import {
  rateEpisode,
  deleteEpisodeRating,
  getUserEpisodeRating,
} from '../../../../../lib/engine/rating/episodeRating';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ hasRated: false, yourRating: null }, { status: 200 });
    }

    const animeId = params.id;
    const { searchParams } = new URL(request.url);
    const episodeNumber = parseFloat(searchParams.get('episodeNumber') || '1');

    const result = await getUserEpisodeRating(authUser.id, animeId, episodeNumber);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching episode user rating:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch user episode rating' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required to rate an episode' }, { status: 401 });
    }

    const animeId = params.id;
    const body = await request.json();
    const { episodeNumber, rating, review } = body;

    if (typeof episodeNumber !== 'number' || typeof rating !== 'number') {
      return NextResponse.json({ error: 'episodeNumber and rating are required' }, { status: 400 });
    }

    const result = await rateEpisode({
      userId: authUser.id,
      animeId,
      episodeNumber,
      rating,
      review,
    });

    return NextResponse.json({ success: true, episodeRating: result });
  } catch (error: any) {
    console.error('Error rating episode:', error);
    return NextResponse.json({ error: error.message || 'Failed to rate episode' }, { status: 500 });
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

    const animeId = params.id;
    const { searchParams } = new URL(request.url);
    const episodeNumber = parseFloat(searchParams.get('episodeNumber') || '1');

    const result = await deleteEpisodeRating(authUser.id, animeId, episodeNumber);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting episode rating:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete episode rating' }, { status: 500 });
  }
}
