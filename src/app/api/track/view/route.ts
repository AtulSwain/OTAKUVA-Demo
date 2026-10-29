import { NextRequest, NextResponse } from 'next/server';
import { isViewKind, looksLikeBot, recordView } from '../../../../lib/analytics/pageViews';
import { RateLimiter } from '../../../../lib/security/rateLimiter';
import { getClientIp } from '../../../../lib/security/authRateLimiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/track/view { kind, id } — counts one page view for the control
 * center's analytics (the page sends it once per visit). Counts only; nothing
 * about the visitor is stored. Bots and floods are ignored. Always 204.
 */
export async function POST(request: NextRequest) {
  const done = new NextResponse(null, { status: 204 });
  try {
    if (looksLikeBot(request.headers.get('user-agent'))) return done;
    if (!RateLimiter.checkRateLimit('PUBLIC_READ', `view:${getClientIp(request)}`).allowed) return done;
    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === 'string' ? body.id : '';
    if (!isViewKind(body?.kind) || !/^[\w-]{1,64}$/.test(id)) return done;
    await recordView(body.kind, id);
  } catch {
    /* analytics must never break a page */
  }
  return done;
}
