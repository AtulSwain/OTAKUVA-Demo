import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioNewsService } from '../../../../../../lib/engine/studio/studioNewsService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id } = params;
    const { searchParams } = new URL(req.url);

    const category = searchParams.get('category') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await studioNewsService.getStudioNews(id, {
      category,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/[id]/news:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch studio news' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'NEWS_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized. NEWS_EDITOR role required.' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();

    const linked = await studioNewsService.linkArticleToStudio(authUser.id, id, body);
    return NextResponse.json({ success: true, relation: linked });
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/[id]/news:', error);
    return NextResponse.json({ error: error.message || 'Failed to link article to studio' }, { status: 400 });
  }
}
