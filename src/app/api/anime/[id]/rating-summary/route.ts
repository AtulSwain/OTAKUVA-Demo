import { NextRequest, NextResponse } from 'next/server';
import { getAnimeBySlugOrId } from '../../../../../lib/animeData';
import { getRatingSummary } from '../../../../../lib/rating/ratingService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

/**
 * GET /api/anime/:id/rating-summary
 * Returns canonical public rating summary, Bayesian score, distribution, and category graph breakdown
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const anime = await getAnimeBySlugOrId(params.id);
    if (!anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    const summary = await getRatingSummary(anime.id);

    return NextResponse.json(
      {
        animeId: anime.id,
        slug: anime.slug,
        title: anime.title,
        ...summary,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching rating summary:', error);
    return NextResponse.json(
      { error: 'Unable to load rating summary. Please try again.' },
      { status: 500 }
    );
  }
}
