import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioDataIntelligenceService } from '../../../../../../lib/engine/studio/studioDataIntelligenceService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'MODERATOR')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
    }

    const overview = await studioDataIntelligenceService.getGlobalDataHealthOverview();
    return NextResponse.json(overview);
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/data-health/overview:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch data health overview' }, { status: 500 });
  }
}
