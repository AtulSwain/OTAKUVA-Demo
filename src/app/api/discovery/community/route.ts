import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '@/lib/auth';
import { communityDiscoveryEngine } from '@/lib/engine/discovery/communityDiscoveryEngine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/discovery/community
 * Returns community-driven anime discovery feed
 */
export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    const result = await communityDiscoveryEngine.getCommunityDiscovery(
      authUser?.id || null,
      limit
    );

    return NextResponse.json(
      {
        success: true,
        isAuthenticated: Boolean(authUser),
        ...result,
      },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Community Discovery API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch community discovery' },
      { status: 500 }
    );
  }
}
