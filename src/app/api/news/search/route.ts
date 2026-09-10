import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { newsSearchService } from '../../../../lib/engine/news/newsSearchService';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || searchParams.get('query') || '';
    const category = searchParams.get('category') || undefined;
    const animeId = searchParams.get('animeId') || undefined;
    const studioId = searchParams.get('studioId') || undefined;
    const dateRange = (searchParams.get('dateRange') || undefined) as any;
    const sortBy = (searchParams.get('sortBy') || 'relevance') as any;
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const result = await newsSearchService.search(
      query,
      { category, animeId, studioId, dateRange, sortBy, page, limit },
      authUser?.id
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error searching news:', error);
    return NextResponse.json({ error: 'Failed to search news', results: [], total: 0 }, { status: 500 });
  }
}
