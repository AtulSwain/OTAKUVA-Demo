import { NextRequest, NextResponse } from 'next/server';
import { getEpisodeRatings } from '../../../../../lib/engine/rating/episodeRating';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const animeId = params.id;
    const { searchParams } = new URL(request.url);
    const episodeNumber = parseInt(searchParams.get('episodeNumber') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await getEpisodeRatings(animeId, episodeNumber, limit);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching episode ratings:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch episode ratings' }, { status: 500 });
  }
}
