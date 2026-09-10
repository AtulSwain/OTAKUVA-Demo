import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioHistoryAdminService } from '../../../../../../lib/engine/studio/studioHistoryAdminService';

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

    const q = searchParams.get('q') || searchParams.get('search') || undefined;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!, 10) : undefined;
    const eventType = (searchParams.get('eventType') as any) || undefined;
    const importance = (searchParams.get('importance') as any) || undefined;
    const verificationStatus = (searchParams.get('verificationStatus') as any) || undefined;
    const publicationState = (searchParams.get('publicationState') as any) || undefined;
    const eraId = searchParams.get('eraId') || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'chronological';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const result = await studioHistoryAdminService.getAdminStudioHistory(id, {
      q,
      year,
      eventType,
      importance,
      verificationStatus,
      publicationState,
      eraId,
      sortBy,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/[id]/history:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch studio history' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized. Creating history events requires DATA_EDITOR or higher role.' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();

    const created = await studioHistoryAdminService.createHistoryEvent(authUser.id, id, {
      ...body,
      studioId: id,
    });

    return NextResponse.json({ success: true, event: created });
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/[id]/history:', error);
    return NextResponse.json({ error: error.message || 'Failed to create history event' }, { status: 400 });
  }
}
