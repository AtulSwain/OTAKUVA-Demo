import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioDashboardService } from '../../../../../../lib/engine/studio/studioDashboardService';
import { studioDataIntelligenceService } from '../../../../../../lib/engine/studio/studioDataIntelligenceService';

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
    const [dashboard, healthReport, anomalies] = await Promise.all([
      studioDashboardService.getStudioDashboard(id),
      studioDataIntelligenceService.getStudioHealthReport(id),
      studioDashboardService.detectStudioAnomalies(id),
    ]);

    if (!dashboard) {
      return NextResponse.json({ error: 'Studio not found.' }, { status: 404 });
    }

    return NextResponse.json({
      dashboard,
      healthReport,
      anomalies,
    });
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/[id]/dashboard:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch admin studio dashboard' },
      { status: 500 }
    );
  }
}
