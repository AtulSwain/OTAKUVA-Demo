import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../lib/auth';
import { newsEngine } from '../../../lib/engine/news/newsEngine';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('q') || searchParams.get('search') || undefined;
    const animeId = searchParams.get('animeId') || undefined;
    const studioId = searchParams.get('studioId') || undefined;
    const personId = searchParams.get('personId') || undefined;
    const provider = searchParams.get('provider') || undefined;
    const dateRange = (searchParams.get('dateRange') as any) || undefined;
    const sortBy = (searchParams.get('sortBy') as any) || 'latest';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined;

    const result = await newsEngine.getNews({
      category,
      search,
      animeId,
      studioId,
      personId,
      provider,
      dateRange,
      sortBy,
      page,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching news:', error);
    return NextResponse.json({ error: 'Failed to fetch news articles' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // If manual creation requested
    if (body?.isManual) {
      if (!authUser) {
        return NextResponse.json({ error: 'Authentication required for manual news entry' }, { status: 401 });
      }
      const created = await newsEngine.createManualNewsArticle(authUser.id, body);
      return NextResponse.json({ success: true, article: created });
    }

    // Trigger sync for specified provider or all providers
    const provider = body?.provider || 'all';
    const limit = body?.limit ? parseInt(body.limit, 10) : 30;

    let result;
    if (provider === 'all') {
      result = await newsEngine.syncAllProviders(limit);
    } else {
      result = await newsEngine.syncProvider(provider, limit);
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Error in news endpoint:', error);
    return NextResponse.json({ error: error.message || 'Failed to process news request' }, { status: 500 });
  }
}
