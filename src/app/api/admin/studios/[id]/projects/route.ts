import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioProjectService } from '../../../../../../lib/engine/studio/studioProjectService';

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

    const q = searchParams.get('q') || undefined;
    const format = searchParams.get('format') || undefined;
    const status = searchParams.get('status') || undefined;
    const role = searchParams.get('role') || undefined;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await studioProjectService.getStudioProjects(id, {
      q,
      format,
      status,
      role,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/[id]/projects:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch studio projects' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized. DATA_EDITOR role required.' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();

    if (body.bulk && Array.isArray(body.animeIds)) {
      const result = await studioProjectService.bulkLinkAnimeToStudio(authUser.id, id, body);
      return NextResponse.json(result);
    }

    const linked = await studioProjectService.linkAnimeToStudio(authUser.id, id, body);
    return NextResponse.json({ success: true, relation: linked });
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/[id]/projects:', error);
    return NextResponse.json({ error: error.message || 'Failed to link anime to studio' }, { status: 400 });
  }
}
