import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioCmsService } from '../../../../../../lib/engine/studio/studioCmsService';

export const dynamic = 'force-dynamic';

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

    const { publicationState = 'PUBLISHED', reason } = body;

    const updated = await studioCmsService.updateStudioPublicationState(
      authUser.id,
      id,
      publicationState,
      reason
    );

    return NextResponse.json({ success: true, studio: updated });
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/[id]/publish:', error);
    return NextResponse.json({ error: error.message || 'Failed to update publication state' }, { status: 400 });
  }
}
