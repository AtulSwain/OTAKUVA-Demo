import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../../../../../lib/auth';
import { newsOperationsService } from '../../../../../../lib/engine/news/newsOperationsService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, 'NEWS_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await newsOperationsService.checkArticleQuality(params.id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error checking article quality:', error);
    return NextResponse.json({ error: error.message || 'Failed to check quality' }, { status: 400 });
  }
}
