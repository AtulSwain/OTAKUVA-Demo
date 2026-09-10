import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioCmsService } from '../../../../../../lib/engine/studio/studioCmsService';

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
    const media = await studioCmsService.getStudioMedia(id);
    return NextResponse.json({ media });
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/[id]/media:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch studio media' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'MEDIA_MANAGER')) {
      return NextResponse.json({ error: 'Unauthorized. MEDIA_MANAGER role required.' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();

    const media = await studioCmsService.addStudioMedia(authUser.id, id, body);
    return NextResponse.json({ success: true, media });
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/[id]/media:', error);
    return NextResponse.json({ error: error.message || 'Failed to upload studio media' }, { status: 400 });
  }
}
