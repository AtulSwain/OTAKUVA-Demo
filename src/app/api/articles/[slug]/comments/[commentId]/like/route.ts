import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser } from '../../../../../../../lib/auth';
import { ArticleSocialError, setArticleCommentLike } from '../../../../../../../lib/articles/articleSocial';
import { logger } from '../../../../../../../lib/logger';

export const dynamic = 'force-dynamic';

async function handle(request: NextRequest, params: { slug: string; commentId: string }, like: boolean) {
  try {
    const authUser = await requireVerifiedUser(request);
    if (authUser instanceof NextResponse) return authUser;
    const result = await setArticleCommentLike(params.slug, params.commentId, authUser.id, like);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ArticleSocialError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error('Article comment like failed', { error, route: '/api/articles/[slug]/comments/[commentId]/like', method: like ? 'POST' : 'DELETE' });
    return NextResponse.json({ error: 'Could not update your like' }, { status: 500 });
  }
}

/** POST /api/articles/:slug/comments/:commentId/like — like a comment (verified users). */
export async function POST(request: NextRequest, { params }: { params: { slug: string; commentId: string } }) {
  return handle(request, params, true);
}

/** DELETE /api/articles/:slug/comments/:commentId/like — remove your like. */
export async function DELETE(request: NextRequest, { params }: { params: { slug: string; commentId: string } }) {
  return handle(request, params, false);
}
