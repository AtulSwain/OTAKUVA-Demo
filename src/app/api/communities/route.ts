import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../lib/auth';
import {
  listDiscoverableCommunities,
  createCommunity,
} from '../../../lib/engine/community/communityEngine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/communities
 * Discovery endpoint for public and authorized communities.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all';
    const category = searchParams.get('category') || undefined;
    const communityType = searchParams.get('type') || undefined;
    const animeId = searchParams.get('animeId') || undefined;
    const query = searchParams.get('q') || undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '30', 10)));

    const authUser = await getAuthUserFromRequest(request);

    const result = await listDiscoverableCommunities({
      filter,
      category,
      communityType,
      animeId,
      query,
      page,
      limit,
      userId: authUser?.id || null,
    });

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error fetching communities:', error);
    return NextResponse.json({ error: 'Failed to fetch communities' }, { status: 500 });
  }
}

/**
 * POST /api/communities
 * Creates a new community (Authentication required, owner derived from session).
 */
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required to create a community' }, { status: 401 });
    }

    const body = await request.json();
    const community = await createCommunity(authUser.id, body);

    return NextResponse.json({ success: true, community }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating community:', error);
    const status = error.message?.includes('Validation') || error.message?.includes('must be') ? 400 : 500;
    return NextResponse.json({ error: error.message || 'Failed to create community' }, { status });
  }
}
