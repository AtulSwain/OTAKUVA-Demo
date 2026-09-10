import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../../../../../lib/auth';
import { newsAdminService } from '../../../../../../lib/engine/news/newsAdminService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, 'NEWS_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { action } = body;
    if (!action || !['PUBLISH', 'UNPUBLISH', 'ARCHIVE', 'DELETE', 'FEATURE', 'UNFEATURE'].includes(action)) {
      return NextResponse.json({ error: 'Invalid status action' }, { status: 400 });
    }

    const article = await newsAdminService.changeStatus(params.id, action, auth.id);
    return NextResponse.json({ success: true, article });
  } catch (error: any) {
    console.error('Error changing article status:', error);
    return NextResponse.json({ error: error.message || 'Failed to change status' }, { status: 400 });
  }
}
