import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../../../../lib/auth';
import { newsAdminService } from '../../../../../lib/engine/news/newsAdminService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, 'NEWS_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { action, articleIds, payload } = body;
    if (!action || !articleIds || !Array.isArray(articleIds)) {
      return NextResponse.json({ error: 'Invalid bulk action parameters' }, { status: 400 });
    }

    const result = await newsAdminService.bulkAction(action, articleIds, payload, auth.id);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error executing bulk action:', error);
    return NextResponse.json({ error: error.message || 'Failed to execute bulk action' }, { status: 400 });
  }
}
