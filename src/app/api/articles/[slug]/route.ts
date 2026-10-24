import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { hasMinRole } from '../../../../lib/roles';
import { getArticleBySlug } from '../../../../lib/articles/articleService';
import { logger } from '../../../../lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  const article = await getArticleBySlug(params.slug);
  if (!article) return NextResponse.json({ error: 'Article not found.' }, { status: 404 });
  return NextResponse.json({ article });
}

/**
 * DELETE /api/articles/:slug — the author removes their own article, or a
 * moderator hides one. Soft: the row stays (status REMOVED / HIDDEN) for
 * moderation history; it just stops being listed.
 */
export async function DELETE(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    const row = await prisma.userArticle.findUnique({ where: { slug: params.slug }, select: { id: true, authorId: true, status: true } });
    if (!row || row.status !== 'PUBLISHED') return NextResponse.json({ error: 'Article not found.' }, { status: 404 });

    const isAuthor = row.authorId === authUser.id;
    if (!isAuthor && !hasMinRole(authUser.role, 'MODERATOR')) {
      return NextResponse.json({ error: 'You can only remove your own articles.' }, { status: 403 });
    }
    await prisma.userArticle.update({
      where: { id: row.id },
      data: isAuthor ? { status: 'REMOVED', deletedAt: new Date() } : { status: 'HIDDEN' },
    });
    return NextResponse.json({ removed: true });
  } catch (error) {
    logger.error('Removing article failed', { error: error as Error, component: 'api/articles/[slug]' });
    return NextResponse.json({ error: 'Failed to remove article.' }, { status: 500 });
  }
}
