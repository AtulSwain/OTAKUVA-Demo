import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../../../lib/auth';
import { newsAdminService } from '../../../../lib/engine/news/newsAdminService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req, 'NEWS_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || undefined;
    const category = searchParams.get('category') || undefined;
    const provider = searchParams.get('provider') || undefined;
    const sourceName = searchParams.get('sourceName') || undefined;
    const search = searchParams.get('search') || undefined;
    const sortBy = (searchParams.get('sortBy') || 'newest') as any;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await newsAdminService.getArticles({
      status,
      category,
      provider,
      sourceName,
      search,
      sortBy,
      page,
      limit,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching admin news list:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch news' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, 'NEWS_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const article = await newsAdminService.createArticle(body, auth.id);
    return NextResponse.json({ success: true, article }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating news article:', error);
    return NextResponse.json({ error: error.message || 'Failed to create news article' }, { status: 400 });
  }
}
