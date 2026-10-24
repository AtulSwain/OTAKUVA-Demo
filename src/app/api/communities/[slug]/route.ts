import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import {
  getCommunityByIdOrSlug,
  updateCommunity,
  deleteCommunity,
} from '../../../../lib/engine/community/communityEngine';

export const dynamic = 'force-dynamic';

/**
 * GET /api/communities/:idOrSlug
 * Returns community details with visibility authorization checks.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const authUser = await getAuthUserFromRequest(request);

    const community = await getCommunityByIdOrSlug(slug, authUser?.id || null);

    if (!community) {
      return NextResponse.json({ error: 'Community not found' }, { status: 404 });
    }

    return NextResponse.json(
      { community },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error: any) {
    console.error('Error fetching community details:', error);
    return NextResponse.json({ error: 'Failed to fetch community' }, { status: 500 });
  }
}

/**
 * PATCH /api/communities/:idOrSlug
 * Updates community settings (Owner / Admin authorization required).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const authUser = await getAuthUserFromRequest(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const updatedCommunity = await updateCommunity(authUser.id, slug, body);

    return NextResponse.json({ success: true, community: updatedCommunity });
  } catch (error: any) {
    console.error('Error updating community:', error);
    const status = error.message.includes('Unauthorized')
      ? 403
      : error.message.startsWith('Validation')
      ? 400
      : error.message.includes('not found')
      ? 404
      : 500;
    return NextResponse.json({ error: (error.message || 'Failed to update community').replace(/^Validation: /, '') }, { status });
  }
}

/**
 * DELETE /api/communities/:idOrSlug
 * Soft-deletes community (Owner authorization required).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const authUser = await getAuthUserFromRequest(request);

    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const result = await deleteCommunity(authUser.id, slug);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting community:', error);
    const status = error.message.includes('Unauthorized')
      ? 403
      : error.message.includes('not found')
      ? 404
      : 500;
    return NextResponse.json({ error: error.message || 'Failed to delete community' }, { status });
  }
}
