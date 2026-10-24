import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { deleteReply, ReplyError } from '../../../../../../lib/reviews/reviewSocial';
import { logger } from '../../../../../../lib/logger';

export const dynamic = 'force-dynamic';

/** DELETE /api/reviews/:id/replies/:replyId — author or moderator. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string; replyId: string } }) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    await deleteReply(params.replyId, { id: authUser.id, role: authUser.role });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ReplyError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error('Error deleting review reply', { error, route: '/api/reviews/[id]/replies/[replyId]', method: 'DELETE' });
    return NextResponse.json({ error: 'Failed to delete reply' }, { status: 500 });
  }
}
