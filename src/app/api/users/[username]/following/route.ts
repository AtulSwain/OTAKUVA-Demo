import { NextRequest, NextResponse } from 'next/server';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { logger } from '../../../../../lib/logger';
import { listFollows } from '../../../../../lib/social/followService';

export const dynamic = 'force-dynamic';

/** GET /api/users/:username/following?before=<iso>&limit= — newest first. */
export async function GET(request: NextRequest, { params }: { params: { username: string } }) {
  try {
    const viewer = await getAuthUserFromRequest(request);
    const sp = new URL(request.url).searchParams;
    const result = await listFollows(decodeURIComponent(params.username), 'following', {
      viewerId: viewer?.id,
      before: sp.get('before'),
      limit: Number(sp.get('limit')) || undefined,
    });
    if (!result) return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    logger.error('following list failed', { component: 'follow', err });
    return NextResponse.json({ error: 'Failed to load following.' }, { status: 500 });
  }
}
