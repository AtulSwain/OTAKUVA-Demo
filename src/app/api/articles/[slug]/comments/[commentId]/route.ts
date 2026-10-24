import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { ArticleSocialError, removeArticleComment } from '../../../../../../lib/articles/articleSocial';
import { logger } from '../../../../../../lib/logger';

export const dynamic = 'force-dynamic';

/** DELETE /api/articles/:slug/comments/:commentId — the comment's author, or a moderator. */
export async function DELETE(request: NextRequest, { params }: { params: { slug: string; commentId: string } }) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    await removeArticleComment(params.commentId, { id: authUser.id, role: authUser.role });
    return NextResponse.json({ removed: true });
  } catch (error) {
    if (error instanceof ArticleSocialError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error('Removing article comment failed', { error, route: '/api/articles/[slug]/comments/[commentId]', method: 'DELETE' });
    return NextResponse.json({ error: 'Failed to remove comment' }, { status: 500 });
  }
}
