import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioHistoryAdminService } from '../../../../../../lib/engine/studio/studioHistoryAdminService';
import { studioHistoryService } from '../../../../../../lib/engine/studio/studioHistoryService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const eras = await studioHistoryService.getStudioEras(id);
    return NextResponse.json({ eras });
  } catch (error: any) {
    console.error('Error fetching eras:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch eras' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();

    const created = await studioHistoryAdminService.createEra(authUser.id, id, {
      ...body,
      studioId: id,
    });

    return NextResponse.json({ success: true, era: created });
  } catch (error: any) {
    console.error('Error creating era:', error);
    return NextResponse.json({ error: error.message || 'Failed to create era' }, { status: 400 });
  }
}
