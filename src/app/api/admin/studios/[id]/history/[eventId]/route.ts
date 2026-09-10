import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../../lib/roles';
import { studioHistoryAdminService } from '../../../../../../../lib/engine/studio/studioHistoryAdminService';
import { studioHistoryService } from '../../../../../../../lib/engine/studio/studioHistoryService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; eventId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { eventId } = params;
    const event = await studioHistoryService.getHistoryEventById(eventId);

    if (!event) {
      return NextResponse.json({ error: 'History event not found.' }, { status: 404 });
    }

    return NextResponse.json({ event });
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/[id]/history/[eventId]:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch history event' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; eventId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { eventId } = params;
    const body = await req.json();

    if (body.action === 'ARCHIVE') {
      const archived = await studioHistoryAdminService.archiveHistoryEvent(authUser.id, eventId, body.reason);
      return NextResponse.json({ success: true, event: archived });
    }

    if (body.action === 'RESTORE' || body.action === 'PUBLISH') {
      const published = await studioHistoryAdminService.restoreHistoryEvent(authUser.id, eventId, body.reason);
      return NextResponse.json({ success: true, event: published });
    }

    if (body.action === 'VERIFY') {
      const verified = await studioHistoryAdminService.verifyHistoryEvent(
        authUser.id,
        eventId,
        body.verificationStatus || 'VERIFIED',
        body.reason
      );
      return NextResponse.json({ success: true, event: verified });
    }

    const updated = await studioHistoryAdminService.updateHistoryEvent(authUser.id, eventId, body);
    return NextResponse.json({ success: true, event: updated });
  } catch (error: any) {
    console.error('Error in PATCH /api/admin/studios/[id]/history/[eventId]:', error);
    return NextResponse.json({ error: error.message || 'Failed to update history event' }, { status: 400 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; eventId: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. Archiving history events requires ADMIN role.' }, { status: 403 });
    }

    const { eventId } = params;
    const body = await req.json().catch(() => ({}));

    const archived = await studioHistoryAdminService.archiveHistoryEvent(
      authUser.id,
      eventId,
      body.reason || 'Admin archived history milestone'
    );

    return NextResponse.json({ success: true, event: archived });
  } catch (error: any) {
    console.error('Error in DELETE /api/admin/studios/[id]/history/[eventId]:', error);
    return NextResponse.json({ error: error.message || 'Failed to archive history event' }, { status: 400 });
  }
}
