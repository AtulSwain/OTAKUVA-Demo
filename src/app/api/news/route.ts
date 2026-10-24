import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../../lib/auth';
import { newsEngine } from '../../../lib/engine/news/newsEngine';
import { CacheManager } from '../../../lib/performance/cacheManager';
import { ensureFreshNews } from '../../../lib/engine/news/newsFreshness';

export const dynamic = 'force-dynamic';

/** Upper bound on articles fetched per provider in one manual sync. */
const MAX_SYNC_LIMIT = 100;

export async function GET(req: NextRequest) {
  ensureFreshNews();
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

    const filters = { category, search, animeId, studioId, personId, provider, dateRange, sortBy, page, limit, offset };

    // Public, filter-parameterized, never personalized (no authUser read
    // anywhere in this handler) — a straightforward stale-while-revalidate
    // catalog read. Keyed on every filter so different filter combinations
    // never collide.
    const result = await CacheManager.getOrSetCatalog('news', `news:list:${JSON.stringify(filters)}`, () =>
      newsEngine.getNews(filters)
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error fetching news:', error);
    return NextResponse.json({ error: 'Failed to fetch news articles' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Both actions here — publishing a manual news entry and triggering a
  // provider sync — are newsroom operations. They used to need no login
  // (sync) or any login (manual entry); now NEWS_EDITOR or above.
  const auth = await requireRole(req, 'NEWS_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const authUser = auth;
    const body = await req.json().catch(() => ({}));

    // If manual creation requested
    if (body?.isManual) {
      const created = await newsEngine.createManualNewsArticle(authUser.id, body);
      return NextResponse.json({ success: true, article: created });
    }

    // Trigger sync for specified provider or all providers
    const provider = body?.provider || 'all';
    const requested = Number.parseInt(String(body?.limit ?? ''), 10);
    const limit = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), MAX_SYNC_LIMIT) : 30;

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
