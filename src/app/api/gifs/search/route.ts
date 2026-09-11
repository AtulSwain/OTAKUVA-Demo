import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { RateLimiter } from '../../../../lib/security/rateLimiter';
import { isGifSearchConfigured, searchGifs } from '../../../../lib/media/gifProvider';
import { CommentError } from '../../../../lib/engine/community/commentError';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gifs/search?q=  — GIF picker results via the server-side provider
 * adapter. Empty q returns trending. { configured: false } when no provider
 * key is set, so the picker can say so instead of failing silently.
 */
export async function GET(request: NextRequest) {
  const authUser = await getAuthUserFromRequest(request);
  if (!authUser) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!isGifSearchConfigured()) {
    return NextResponse.json({ configured: false, results: [] });
  }

  const rate = RateLimiter.checkRateLimit('SEARCH', authUser.id);
  if (!rate.allowed) {
    return NextResponse.json({ error: 'Too many searches. Please slow down.' }, { status: 429 });
  }

  try {
    const q = new URL(request.url).searchParams.get('q') || '';
    const results = await searchGifs(q);
    return NextResponse.json({ configured: true, results });
  } catch (error) {
    if (error instanceof CommentError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('GIF search failed', error);
    return NextResponse.json({ error: 'GIF search failed' }, { status: 500 });
  }
}
