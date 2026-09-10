import { NextRequest, NextResponse } from 'next/server';
import { studioAnalyticsService } from '../../../../../lib/engine/studio/studioAnalyticsService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const { searchParams } = new URL(request.url);
    const timeWindow = (searchParams.get('timeWindow') as any) || 'ALL_TIME';

    const analytics = await studioAnalyticsService.getStudioAnalytics(slug, timeWindow);

    if (!analytics) {
      return NextResponse.json({ error: 'Studio not found.' }, { status: 404 });
    }

    return NextResponse.json(analytics);
  } catch (error: any) {
    console.error('Error in GET /api/studios/[slug]/analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch studio analytics' }, { status: 500 });
  }
}
