import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioAnalyticsService } from '../../../../../../lib/engine/studio/studioAnalyticsService';

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
    const { searchParams } = new URL(req.url);
    const timeWindow = (searchParams.get('timeWindow') as any) || 'ALL_TIME';

    const analytics = await studioAnalyticsService.getStudioAnalytics(id, timeWindow);
    if (!analytics) {
      return NextResponse.json({ error: 'Studio not found.' }, { status: 404 });
    }

    return NextResponse.json(analytics);
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/[id]/analytics:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch studio analytics' }, { status: 500 });
  }
}
