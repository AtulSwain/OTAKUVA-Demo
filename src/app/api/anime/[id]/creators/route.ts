import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { logger } from '../../../../../lib/logger';
import { getAnimeCreators } from '../../../../../lib/creator/animeCreators';

export const dynamic = 'force-dynamic';

/** GET /api/anime/:id/creators — creators who rated, reviewed or are hyped for this anime. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const viewer = await getAuthUserFromRequest(request);
    const creators = await getAnimeCreators(params.id, viewer?.id);
    if (!creators) return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    // Includes whether the viewer follows each creator, so never shared-cached.
    return NextResponse.json({ creators }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    logger.error('anime creators failed', { component: 'creator', err });
    return NextResponse.json({ error: 'Could not load creators.' }, { status: 500 });
  }
}
