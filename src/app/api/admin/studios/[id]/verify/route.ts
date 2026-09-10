import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioDataIntelligenceService } from '../../../../../../lib/engine/studio/studioDataIntelligenceService';

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

    const { status, notes } = body;
    if (!status) {
      return NextResponse.json({ error: 'Verification status is required.' }, { status: 400 });
    }

    const updated = await studioDataIntelligenceService.updateVerificationStatus(
      authUser.id,
      id,
      status,
      notes
    );

    return NextResponse.json({ success: true, studio: updated });
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/[id]/verify:', error);
    return NextResponse.json({ error: error.message || 'Failed to update verification status' }, { status: 400 });
  }
}
