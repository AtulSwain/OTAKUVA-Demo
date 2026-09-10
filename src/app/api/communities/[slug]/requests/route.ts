import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import {
  listJoinRequests,
  reviewJoinRequest,
} from '../../../../../lib/engine/community/communityEngine';

export const dynamic = 'force-dynamic';

/**
 * Join-request management for a single community.
 *
 * reviewJoinRequest() already existed in the community engine but no route
 * reached it, so owners and admins had no way to act on a request. This is
 * that endpoint — it adds no new membership or notification system.
 *
 * Every identity is derived from the session: the route never reads a userId,
 * role, or membership status from the request body.
 */

function errorStatus(message: string): number {
  if (message.includes('Unauthorized')) return 403;
  if (message.includes('not found')) return 404;
  if (message.includes('already been')) return 409;
  return 500;
}

/**
 * GET /api/communities/:slug/requests?status=PENDING
 * Owner/admin only. Lists join requests awaiting review.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const statusParam = (request.nextUrl.searchParams.get('status') || 'PENDING').toUpperCase();
  if (!['PENDING', 'APPROVED', 'REJECTED'].includes(statusParam)) {
    return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
  }

  try {
    const result = await listJoinRequests(
      authUser.id,
      params.slug,
      statusParam as 'PENDING' | 'APPROVED' | 'REJECTED'
    );
    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error: any) {
    const message = error?.message || 'Failed to list join requests';
    if (errorStatus(message) === 500) {
      console.error('[community] listJoinRequests failed', {
        slug: params.slug,
        error: message,
      });
    }
    return NextResponse.json({ error: message }, { status: errorStatus(message) });
  }
}

/**
 * POST /api/communities/:slug/requests
 * Body: { userId: string, action: 'APPROVE' | 'REJECT' }
 *
 * `userId` here is the *subject* of the review, not the actor — the actor is
 * always the authenticated session. Authorization is checked against this
 * community specifically, so an admin of another community gets 403 and a
 * requester cannot approve themselves.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: { userId?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'A JSON body is required' }, { status: 400 });
  }

  const targetUserId = typeof body.userId === 'string' ? body.userId.trim() : '';
  const action = typeof body.action === 'string' ? body.action.toUpperCase() : '';

  if (!targetUserId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  if (action !== 'APPROVE' && action !== 'REJECT') {
    return NextResponse.json(
      { error: "action must be 'APPROVE' or 'REJECT'" },
      { status: 400 }
    );
  }

  // Nobody reviews their own request, whatever role they hold.
  if (targetUserId === authUser.id) {
    return NextResponse.json(
      { error: 'You cannot review your own join request' },
      { status: 403 }
    );
  }

  const community = await prisma.community.findFirst({
    where: { OR: [{ slug: params.slug }, { id: params.slug }] },
    select: { id: true },
  });
  if (!community) {
    return NextResponse.json({ error: 'Community not found' }, { status: 404 });
  }

  try {
    const result = await reviewJoinRequest(
      authUser.id,
      community.id,
      targetUserId,
      action as 'APPROVE' | 'REJECT'
    );

    console.info('[community] join request reviewed', {
      event: action === 'APPROVE'
        ? 'community_join_request_approved'
        : 'community_join_request_rejected',
      communityId: community.id,
      targetUserId,
      moderatorId: authUser.id,
    });

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error: any) {
    const message = error?.message || 'Failed to review join request';
    const status = errorStatus(message);
    console.error('[community] join request review failed', {
      event: 'community_join_request_failed',
      communityId: community.id,
      targetUserId,
      moderatorId: authUser.id,
      status,
      error: message,
    });
    return NextResponse.json({ error: message }, { status });
  }
}
