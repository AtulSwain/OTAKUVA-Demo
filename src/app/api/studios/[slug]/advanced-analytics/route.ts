import { NextRequest, NextResponse } from 'next/server';
import { studioAdvancedAnalyticsService, AdvancedAnalyticsPeriod } from '../../../../../lib/engine/studio/studioAdvancedAnalyticsService';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const url = new URL(req.url);
    const period = (url.searchParams.get('period') as AdvancedAnalyticsPeriod) || 'ALL_TIME';
    const bypassCache = url.searchParams.get('bypassCache') === 'true';

    const analytics = await studioAdvancedAnalyticsService.getStudioAdvancedAnalytics(slug, period, { bypassCache });

    if (!analytics) {
      return NextResponse.json({ error: 'Studio not found or analytics unavailable' }, { status: 404 });
    }

    return NextResponse.json(analytics);
  } catch (error: any) {
    console.error('Error in GET /api/studios/[slug]/advanced-analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
