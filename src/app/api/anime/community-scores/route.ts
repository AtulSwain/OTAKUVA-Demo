import { NextRequest, NextResponse } from 'next/server';
import { getCommunityScores, MAX_COMMUNITY_SCORE_IDS } from '../../../../lib/rating/communityScores';
import { logger } from '../../../../lib/logger';

/**
 * GET /api/anime/community-scores?ids=a,b,c — members' OTAKUVA score and
 * retention for up to 200 anime ids, for cards and posters. Anime nobody has
 * rated are left out of `scores` (no placeholder values).
 */
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('ids') || '';
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length > MAX_COMMUNITY_SCORE_IDS) {
    return NextResponse.json({ error: `At most ${MAX_COMMUNITY_SCORE_IDS} ids.` }, { status: 400 });
  }
  try {
    const scores = await getCommunityScores(ids);
    // Ratings change the moment a member rates — no shared caching.
    return NextResponse.json({ scores }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    logger.error('Community scores failed', { error, route: '/api/anime/community-scores', method: 'GET' });
    return NextResponse.json({ error: 'Could not load scores.' }, { status: 500 });
  }
}
