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
    if (!authUser || !hasMinRole(authUser.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. ADMIN role required for studio merge.' }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();

    const { sourceStudioId, reason = 'Duplicate entity merge' } = body;
    if (!sourceStudioId) {
      return NextResponse.json({ error: 'sourceStudioId is required.' }, { status: 400 });
    }

    const result = await studioDataIntelligenceService.mergeStudios(authUser.id, {
      targetStudioId: id,
      sourceStudioId,
      reason,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/[id]/merge:', error);
    return NextResponse.json({ error: error.message || 'Failed to merge studios' }, { status: 400 });
  }
}
