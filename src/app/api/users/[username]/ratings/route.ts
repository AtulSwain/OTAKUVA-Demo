import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../../lib/logger';
import { getPublicRatings } from '../../../../../lib/profile/publicRatings';

export const dynamic = 'force-dynamic';

/** GET /api/users/:username/ratings?before=<iso>&limit= — the anime they rated, newest first. */
export async function GET(request: NextRequest, { params }: { params: { username: string } }) {
  try {
    const sp = new URL(request.url).searchParams;
    const result = await getPublicRatings(decodeURIComponent(params.username), {
      before: sp.get('before'),
      limit: Number(sp.get('limit')) || undefined,
    });
    if (!result) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    logger.error('public ratings failed', { component: 'profile', err });
    return NextResponse.json({ error: 'Failed to load ratings.' }, { status: 500 });
  }
}
