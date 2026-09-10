import { NextRequest, NextResponse } from 'next/server';
import { studioAdvancedAnalyticsService, AdvancedAnalyticsPeriod } from '../../../../lib/engine/studio/studioAdvancedAnalyticsService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const studioA = url.searchParams.get('studioA');
    const studioB = url.searchParams.get('studioB');
    const period = (url.searchParams.get('period') as AdvancedAnalyticsPeriod) || 'ALL_TIME';

    if (!studioA || !studioB) {
      return NextResponse.json({ error: 'Both studioA and studioB parameters are required' }, { status: 400 });
    }

    const comparison = await studioAdvancedAnalyticsService.compareStudiosMultiPeriod(studioA, studioB, period);
    if (!comparison) {
      return NextResponse.json({ error: 'One or both studios could not be resolved' }, { status: 404 });
    }

    return NextResponse.json(comparison);
  } catch (error: any) {
    console.error('Error in GET /api/studios/compare-period:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
