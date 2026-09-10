import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { hasMinRole } from '../../../../../lib/roles';
import { studioAdminService } from '../../../../../lib/engine/studio/studioAdminService';

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
    const studio = await studioAdminService.getAdminStudioById(id);

    if (!studio) {
      return NextResponse.json({ error: 'Studio not found.' }, { status: 404 });
    }

    return NextResponse.json({ studio });
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/[id]:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch studio' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized. Modifying studios requires DATA_EDITOR or higher role.' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();

    // Check if this is an override operation
    if (body.isOverrideAction) {
      if (body.action === 'RESET') {
        const reset = await studioAdminService.resetAdminOverride(authUser.id, id);
        return NextResponse.json({ success: true, studio: reset });
      } else {
        const applied = await studioAdminService.applyAdminOverride(authUser.id, id, body.overrides);
        return NextResponse.json({ success: true, studio: applied });
      }
    }

    // Check if lifecycle state update
    if (body.action === 'ARCHIVE') {
      const archived = await studioAdminService.archiveStudio(authUser.id, id, body.reason);
      return NextResponse.json({ success: true, studio: archived });
    }

    if (body.action === 'RESTORE') {
      const restored = await studioAdminService.restoreStudio(authUser.id, id, body.reason);
      return NextResponse.json({ success: true, studio: restored });
    }

    // Standard metadata update
    const updated = await studioAdminService.updateStudio(authUser.id, id, body);
    return NextResponse.json({ success: true, studio: updated });
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/studios/[id]:', error);
    return NextResponse.json({ error: error.message || 'Failed to update studio' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. Archiving studios requires ADMIN role.' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const archived = await studioAdminService.archiveStudio(authUser.id, id, body.reason || 'Admin archived studio');

    return NextResponse.json({ success: true, studio: archived });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/studios/[id]:', error);
    return NextResponse.json({ error: error.message || 'Failed to archive studio' }, { status: 400 });
  }
}
