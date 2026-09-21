import { NextRequest, NextResponse } from 'next/server';
import { getAnimeBySlugOrId } from '../../../../../lib/animeData';
import { getAnimeReviewHighlights, type HighlightView } from '../../../../../lib/badges/reviewHighlights';

export const dynamic = 'force-dynamic';

/**
 * GET /api/anime/:id/review-highlights?view=top|critics
 * Badge-aware review summary: cached distribution by reviewer badge, ranked
 * top reviews (or critics only), and a "rising" slot. Reads cached aggregates
 * plus one bounded, indexed review query; never a live per-tier aggregate.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const anime = await getAnimeBySlugOrId(params.id);
    if (!anime) return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    const raw = new URL(request.url).searchParams.get('view');
    const view: HighlightView = raw === 'critics' ? 'critics' : 'top';
    return NextResponse.json(await getAnimeReviewHighlights(anime.id, view));
  } catch (error) {
    console.error('Error loading review highlights:', error);
    return NextResponse.json({ error: 'Failed to load review highlights' }, { status: 500 });
  }
}
