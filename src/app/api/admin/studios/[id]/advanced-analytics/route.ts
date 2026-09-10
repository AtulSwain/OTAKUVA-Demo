import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../../lib/auth';
import { hasMinRole } from '../../../../../../lib/roles';
import { studioAdvancedAnalyticsService, AdvancedAnalyticsPeriod } from '../../../../../../lib/engine/studio/studioAdvancedAnalyticsService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized. DATA_EDITOR role required.' }, { status: 403 });
    }

    const { id } = await params;
    const url = new URL(req.url);
    const period = (url.searchParams.get('period') as AdvancedAnalyticsPeriod) || 'ALL_TIME';

    const analytics = await studioAdvancedAnalyticsService.getStudioAdvancedAnalytics(id, period, {
      bypassCache: true,
      forceLiveCalculation: true,
    });

    if (!analytics) {
      return NextResponse.json({ error: 'Studio not found' }, { status: 404 });
    }

    return NextResponse.json(analytics);
  } catch (error: any) {
    console.error('Error in GET /api/admin/studios/[id]/advanced-analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    if (!authUser || !hasMinRole(authUser.role, 'DATA_EDITOR')) {
      return NextResponse.json({ error: 'Unauthorized. DATA_EDITOR role required.' }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const jobType = body.jobType || 'STUDIO_ANALYTICS_REFRESH';

    const job = await studioAdvancedAnalyticsService.queueAnalyticsJob(authUser.id, id, jobType);
    return NextResponse.json(job);
  } catch (error: any) {
    console.error('Error in POST /api/admin/studios/[id]/advanced-analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
