import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../../lib/roles';
import { studioProjectService } from '../../../../../../../lib/engine/studio/studioProjectService';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; animeId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id, animeId } = params;
    const body = await req.json();

    const updated = await studioProjectService.updateAnimeStudioRelationship(
      authUser.id,
      id,
      animeId,
      body
    );

    return NextResponse.json({ success: true, relation: updated });
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/studios/[id]/projects/[animeId]:', error);
    return NextResponse.json({ error: error.message || 'Failed to update anime studio relationship' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; animeId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id, animeId } = params;
    const body = await req.json().catch(() => ({}));

    const result = await studioProjectService.unlinkAnimeFromStudio(
      authUser.id,
      id,
      animeId,
      body.reason
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/studios/[id]/projects/[animeId]:', error);
    return NextResponse.json({ error: error.message || 'Failed to unlink anime from studio' }, { status: 400 });
  }
}
