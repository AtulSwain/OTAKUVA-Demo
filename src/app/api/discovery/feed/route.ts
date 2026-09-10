import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { homeFeedEngine } from '@/lib/engine/discovery/homeFeedEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/discovery/feed
 * Returns dynamic personalized home feed with module ranking and watch state
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const url = new URL(req.url);
    const forceRefresh = url.searchParams.get('refresh') === 'true';

    const feedSnapshot = await homeFeedEngine.generateHomeFeed(authUser?.id || null, {
      forceRefresh,
    });

    return NextResponse.json(
      {
        success: true,
        isAuthenticated: Boolean(authUser),
        ...feedSnapshot,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Home Feed Discovery API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate personalized home feed' },
      { status: 500 }
    );
  }
}
