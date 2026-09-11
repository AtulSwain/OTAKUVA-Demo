import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { deleteComment, CommentError } from '../../../../lib/engine/community/commentService';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/comments/:id  { reason? }
 * The author can delete their own comment; community or platform moderators
 * can remove anyone's (logged as a moderation action).
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  try {
    const result = await deleteComment(
      { id: authUser.id, role: authUser.role },
      params.id,
      typeof body?.reason === 'string' ? body.reason : undefined
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CommentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Failed to delete comment', error);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
