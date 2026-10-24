import { NextRequest, NextResponse } from 'next/server';
import { getPublicCollections } from '../../../../lib/lists/listService';
import { logger } from '../../../../lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/collections/public?limit=12&before=<ISO>[&user=<username>]
 * Members' PUBLIC collections (non-empty), newest activity first — the
 * homepage rail and /collections. Private and link-only collections never
 * appear here.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const limit = Number(sp.get('limit')) || 12;
    const result = await getPublicCollections({ limit, before: sp.get('before'), username: sp.get('user') });
    return NextResponse.json(result);
  } catch (error) {
    logger.error('Public collections failed', { error, route: '/api/collections/public', method: 'GET' });
    return NextResponse.json({ error: 'Could not load collections.' }, { status: 500 });
  }
}
