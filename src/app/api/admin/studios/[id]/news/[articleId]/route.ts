import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../../lib/roles';
import { studioNewsService } from '../../../../../../../lib/engine/studio/studioNewsService';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; articleId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'NEWS_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id, articleId } = params;
    const body = await req.json();

    const updated = await studioNewsService.updateNewsStudioRelationship(
      authUser.id,
      id,
      articleId,
      body
    );

    return NextResponse.json({ success: true, relation: updated });
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/studios/[id]/news/[articleId]:', error);
    return NextResponse.json({ error: error.message || 'Failed to update news relationship' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; articleId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'NEWS_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id, articleId } = params;
    const body = await req.json().catch(() => ({}));

    const result = await studioNewsService.unlinkArticleFromStudio(
      authUser.id,
      id,
      articleId,
      body.reason
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/studios/[id]/news/[articleId]:', error);
    return NextResponse.json({ error: error.message || 'Failed to unlink news from studio' }, { status: 400 });
  }
}
