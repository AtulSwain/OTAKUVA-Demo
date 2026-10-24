import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { logger } from '../../../../lib/logger';
import { getHypeBoard, getMyHypes } from '../../../../lib/hype/hypeService';
import { isHypeLevel } from '../../../../lib/hype/hypeLevels';

export const dynamic = 'force-dynamic';

/**
 * GET /api/hype/board?level=HYPED|SKIP|upcoming&limit=20
 * Upcoming anime by premiere date, or ranked by votes of one Hype level.
 * Signed in: `mine` maps animeId → the viewer's own vote.
 */
export async function GET(request: NextRequest) {
  try {
    const raw = request.nextUrl.searchParams.get('level') || 'upcoming';
    const kind = raw === 'upcoming' ? 'upcoming' : isHypeLevel(raw) ? raw : null;
    if (!kind) return NextResponse.json({ error: 'Unknown level.' }, { status: 400 });
    const limit = Number(request.nextUrl.searchParams.get('limit')) || 20;
    const items = await getHypeBoard(kind, limit);
    const viewer = await getAuthUserFromRequest(request);
    const mine = viewer ? await getMyHypes(viewer.id, items.map((i) => i.id)) : {};
    return NextResponse.json({ items, mine });
  } catch (error) {
    logger.error('Hype board failed', { error, route: '/api/hype/board', method: 'GET' });
    return NextResponse.json({ error: 'Could not load the hype board.' }, { status: 500 });
  }
}
