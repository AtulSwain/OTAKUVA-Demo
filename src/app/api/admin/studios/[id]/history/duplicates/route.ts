import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../../lib/roles';
import { studioHistoryAdminService } from '../../../../../../../lib/engine/studio/studioHistoryAdminService';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { title, year, eventType, excludeEventId } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required for duplicate check.' }, { status: 400 });
    }

    const matches = await studioHistoryAdminService.detectDuplicateHistoryEvents(id, {
      title,
      year: year ? parseInt(year, 10) : undefined,
      eventType,
      excludeEventId,
    });

    return NextResponse.json({ matches });
  } catch (error: any) {
    console.error('Error detecting duplicate history events:', error);
    return NextResponse.json({ error: error.message || 'Failed to detect duplicates' }, { status: 400 });
  }
}
