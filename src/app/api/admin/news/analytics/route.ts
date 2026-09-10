import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../../../../lib/auth';
import { newsOperationsService } from '../../../../../lib/engine/news/newsOperationsService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, 'NEWS_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const timeframe = (searchParams.get('timeframe') || '7d') as any;
    const analytics = await newsOperationsService.getNewsAnalytics(timeframe);
    return NextResponse.json(analytics);
  } catch (error: any) {
    console.error('Error fetching news analytics:', error);
    return NextResponse.json({ error: 'Failed to retrieve analytics' }, { status: 500 });
  }
}
