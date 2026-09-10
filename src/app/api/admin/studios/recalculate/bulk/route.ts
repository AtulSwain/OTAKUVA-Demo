import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioDashboardService } from '../../../../../../lib/engine/studio/studioDashboardService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized. ADMIN role required.' }, { status: 403 });
    }

    const result = await studioDashboardService.queueBulkRecalculation(authUser.id);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/recalculate/bulk:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to trigger bulk recalculation' },
      { status: 500 }
    );
  }
}
