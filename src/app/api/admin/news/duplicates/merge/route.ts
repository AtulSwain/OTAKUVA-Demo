import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../../../../../lib/auth';
import { newsAdminService } from '../../../../../../lib/engine/news/newsAdminService';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, 'NEWS_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { primaryArticleId, duplicateArticleId } = body;

    if (!primaryArticleId || !duplicateArticleId) {
      return NextResponse.json({ error: 'Both primaryArticleId and duplicateArticleId are required' }, { status: 400 });
    }

    const result = await newsAdminService.mergeDuplicates(primaryArticleId, duplicateArticleId, auth.id);
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Error merging duplicates:', error);
    return NextResponse.json({ error: error.message || 'Failed to merge duplicates' }, { status: 400 });
  }
}
