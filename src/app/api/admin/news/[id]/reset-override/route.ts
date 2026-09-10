import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../../../../../lib/auth';
import { newsAdminService } from '../../../../../../lib/engine/news/newsAdminService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, 'NEWS_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json().catch(() => ({}));
    const fields = body.fields || ['title', 'summary', 'category'];
    const article = await newsAdminService.resetOverride(params.id, fields, auth.id);
    return NextResponse.json({ success: true, article });
  } catch (error: any) {
    console.error('Error resetting article override:', error);
    return NextResponse.json({ error: error.message || 'Failed to reset override' }, { status: 400 });
  }
}
