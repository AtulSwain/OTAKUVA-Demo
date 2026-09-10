import { NextRequest, NextResponse } from 'next/server';
import { getAnimeStatisticsData, getAnimeBySlugOrId } from '../../../../../lib/animeData';
import { getRatingSummary } from '../../../../../lib/rating/ratingService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const anime = await getAnimeBySlugOrId(params.id);
    if (!anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    const [statistics, ratingSummary] = await Promise.all([
      getAnimeStatisticsData(anime.id),
      getRatingSummary(anime.id),
    ]);

    return NextResponse.json({
      animeId: anime.id,
      slug: anime.slug,
      title: anime.title,
      ...statistics,
      ratingSummary,
    });
  } catch (error: any) {
    console.error('Statistics API error:', error);
    return NextResponse.json({ error: 'Failed to fetch anime statistics' }, { status: 500 });
  }
}
