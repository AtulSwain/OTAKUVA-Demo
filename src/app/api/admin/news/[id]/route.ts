import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../../../../lib/auth';
import { newsAdminService } from '../../../../../lib/engine/news/newsAdminService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, 'NEWS_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const article = await newsAdminService.getArticleById(params.id);
    if (!article) {
      return NextResponse.json({ error: 'Article not found' }, { status: 404 });
    }
    return NextResponse.json({ article });
  } catch (error: any) {
    console.error('Error fetching admin article:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch article' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req, 'NEWS_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const updated = await newsAdminService.updateArticle(params.id, body, auth.id);
    return NextResponse.json({ success: true, article: updated });
  } catch (error: any) {
    console.error('Error updating admin article:', error);
    return NextResponse.json({ error: error.message || 'Failed to update article' }, { status: 400 });
  }
}
