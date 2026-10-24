import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { getAnimeCommunityHub } from '../../../../../lib/community/animeCommunityHub';
import { logger } from '../../../../../lib/logger';

export const dynamic = 'force-dynamic';

/** GET /api/anime/:id/community — discussions, communities and member articles for one anime. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    const hub = await getAnimeCommunityHub(params.id, authUser?.id);
    if (!hub) return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    return NextResponse.json(hub);
  } catch (error) {
    logger.error('Anime community hub failed', { error, route: '/api/anime/[id]/community' });
    return NextResponse.json({ error: 'Failed to load community' }, { status: 500 });
  }
}
