import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../lib/logger';
import { getRetentionRankings } from '../../../../lib/rating/animeRetention';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rankings/retention?limit=100 — anime ranked by their community
 * retention (mean of rated episodes' scores). `rated` = enough data for a
 * badge; `provisional` = not yet, listed separately so they never mix.
 */
export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(200, Math.max(1, Number(request.nextUrl.searchParams.get('limit')) || 100));
    const { rated, provisional } = await getRetentionRankings(limit);
    const shape = (i: (typeof rated)[number]) => ({
      id: i.id,
      slug: i.slug,
      title: i.title,
      posterUrl: i.posterUrl,
      type: i.type,
      year: i.year,
      retention: {
        value: i.retention.value,
        status: i.retention.status,
        badge: i.retention.badge,
        ratedEpisodes: i.retention.ratedEpisodes,
        totalRatings: i.retention.totalRatings,
        raters: i.retention.raters,
      },
    });
    return NextResponse.json({ rated: rated.map(shape), provisional: provisional.map(shape) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('Retention rankings failed', { error, route: '/api/rankings/retention', method: 'GET' });
    return NextResponse.json({ error: 'Could not load retention rankings.' }, { status: 500 });
  }
}
