import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { similarAnimeEngine } from '@/lib/engine/discovery/similarAnimeEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/discovery/similar/[animeId]
 * Returns multi-layer similar anime with franchise separation
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { animeId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    const result = await similarAnimeEngine.getSimilarAnime(params.animeId, {
      userId: authUser?.id || null,
      limit,
      forceRefresh,
    });

    if (!result) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Similar Anime API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to compute similar anime' },
      { status: 500 }
    );
  }
}
