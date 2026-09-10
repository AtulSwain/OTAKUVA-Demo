import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioAdvancedAnalyticsService } from '../../../../../../lib/engine/studio/studioAdvancedAnalyticsService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized. DATA_EDITOR role required.' }, { status: 403 });
    }

    const dashboard = await studioAdvancedAnalyticsService.getAdminAnalyticsDashboard();
    return NextResponse.json(dashboard);
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/advanced-analytics/dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
