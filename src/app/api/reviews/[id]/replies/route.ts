import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest, requireVerifiedUser } from '../../../../../lib/auth';
import { createReply, listReplies, ReplyError } from '../../../../../lib/reviews/reviewSocial';
import { logger } from '../../../../../lib/logger';

export const dynamic = 'force-dynamic';

/** GET /api/reviews/:id/replies — every visible reply, oldest first. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    const replies = await listReplies(params.id, authUser ? { id: authUser.id, role: authUser.role } : null);
    return NextResponse.json({ replies });
  } catch (error) {
    logger.error('Error listing review replies', { error, route: '/api/reviews/[id]/replies', method: 'GET' });
    return NextResponse.json({ error: 'Failed to load replies' }, { status: 500 });
  }
}

/** POST /api/reviews/:id/replies { body } — verified users only. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authUser = await requireVerifiedUser(request);
    if (authUser instanceof NextResponse) return authUser;
    const payload = await request.json().catch(() => ({}));
    const reply = await createReply(params.id, { id: authUser.id, username: authUser.username, role: authUser.role }, payload?.body);
    return NextResponse.json({ reply }, { status: 201 });
  } catch (error) {
    if (error instanceof ReplyError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error('Error creating review reply', { error, route: '/api/reviews/[id]/replies', method: 'POST' });
    return NextResponse.json({ error: 'Failed to post reply' }, { status: 500 });
  }
}
