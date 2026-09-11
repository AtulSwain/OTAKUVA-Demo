import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { discardPendingCommentMedia } from '../../../../../lib/media/commentMediaUpload';
import { CommentError } from '../../../../../lib/engine/community/commentError';

export const dynamic = 'force-dynamic';

/** DELETE /api/uploads/comment-media/:id — remove your own unposted upload. */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    await discardPendingCommentMedia(authUser.id, params.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CommentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Failed to discard comment media', error);
    return NextResponse.json({ error: 'Failed to remove attachment' }, { status: 500 });
  }
}
