import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { toggleCommentLike, CommentError } from '../../../../../lib/engine/community/commentService';

export const dynamic = 'force-dynamic';

/** POST /api/comments/:id/like — toggles the session user's like. */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const result = await toggleCommentLike(authUser.id, params.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CommentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Failed to toggle comment like', error);
    return NextResponse.json({ error: 'Failed to update like' }, { status: 500 });
  }
}
