import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../../../../lib/auth';
import { newsOperationsService } from '../../../../../lib/engine/news/newsOperationsService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, 'NEWS_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const overview = await newsOperationsService.getOperationsOverview();
    return NextResponse.json(overview);
  } catch (error: any) {
    console.error('Error fetching operations overview:', error);
    return NextResponse.json({ error: 'Failed to retrieve operations data' }, { status: 500 });
  }
}
