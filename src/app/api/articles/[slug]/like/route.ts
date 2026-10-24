import { NextRequest, NextResponse } from 'next/server';
import { requireVerifiedUser } from '../../../../../lib/auth';
import { ArticleSocialError, setArticleLike } from '../../../../../lib/articles/articleSocial';
import { logger } from '../../../../../lib/logger';

export const dynamic = 'force-dynamic';

async function handle(request: NextRequest, slug: string, like: boolean) {
  try {
    const authUser = await requireVerifiedUser(request);
    if (authUser instanceof NextResponse) return authUser;
    return NextResponse.json(await setArticleLike(slug, authUser.id, like));
  } catch (error) {
    if (error instanceof ArticleSocialError) return NextResponse.json({ error: error.message }, { status: error.status });
    logger.error('Article like failed', { error, route: '/api/articles/[slug]/like' });
    return NextResponse.json({ error: 'Failed to update like' }, { status: 500 });
  }
}

/** POST /api/articles/:slug/like — like (verified users). */
export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  return handle(request, params.slug, true);
}

/** DELETE /api/articles/:slug/like — remove your like. */
export async function DELETE(request: NextRequest, { params }: { params: { slug: string } }) {
  return handle(request, params.slug, false);
}
