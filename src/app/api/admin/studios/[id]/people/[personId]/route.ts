import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../../lib/roles';
import { studioPeopleService } from '../../../../../../../lib/engine/studio/studioPeopleService';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; personId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id, personId } = params;
    const body = await req.json();

    const updated = await studioPeopleService.updateStudioPerson(
      authUser.id,
      id,
      personId,
      body
    );

    return NextResponse.json({ success: true, relation: updated });
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/studios/[id]/people/[personId]:', error);
    return NextResponse.json({ error: error.message || 'Failed to update studio person' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; personId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id, personId } = params;
    const body = await req.json().catch(() => ({}));

    const result = await studioPeopleService.unlinkPersonFromStudio(
      authUser.id,
      id,
      personId,
      body.reason
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/studios/[id]/people/[personId]:', error);
    return NextResponse.json({ error: error.message || 'Failed to unlink person from studio' }, { status: 400 });
  }
}
