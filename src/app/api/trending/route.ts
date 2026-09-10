import { NextRequest, NextResponse } from 'next/server';
import { calculateAnimeTrends, getCategorizedTrends } from '../../../lib/engine/trend/trendEngine';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const refresh = searchParams.get('refresh') === 'true';

    if (refresh) {
      await calculateAnimeTrends();
    }

    const trends = await getCategorizedTrends();

    return NextResponse.json(trends, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('Error fetching trending anime:', error);
    return NextResponse.json({ error: 'Failed to fetch trending anime' }, { status: 500 });
  }
}
