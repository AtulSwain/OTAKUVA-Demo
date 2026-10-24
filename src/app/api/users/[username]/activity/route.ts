import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { logger } from '../../../../../lib/logger';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import {
  PROFILE_ACTIVITY_KINDS,
  getProfileActivity,
  getProfileActivityStats,
  type ProfileActivityKind,
} from '../../../../../lib/profile/profileActivity';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/:username/activity[?before=ISO&kinds=RATED,REVIEWED&limit=30&stats=0]
 * Everything the member has done, newest first (ratings, reviews, replies,
 * episode retention, hype, library, favourites, articles, comments,
 * discussions, lists, communities, follows), read from the real tables.
 * The owner sees all of it; visitors see public actions only.
 * Also returns per-day counts for the activity calendar and per-kind totals
 * (skip with stats=0 when paging).
 */
export async function GET(request: NextRequest, { params }: { params: { username: string } }) {
  try {
    const user = await prisma.user.findUnique({ where: { username: decodeURIComponent(params.username) }, select: { id: true } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const viewer = await getAuthUserFromRequest(request);
    const isOwner = viewer?.id === user.id;
    const sp = request.nextUrl.searchParams;
    const beforeRaw = sp.get('before');
    const before = beforeRaw ? new Date(beforeRaw) : null;
    if (before && Number.isNaN(before.getTime())) return NextResponse.json({ error: 'Invalid cursor.' }, { status: 400 });
    const kinds = (sp.get('kinds') || '')
      .split(',')
      .map((k) => k.trim().toUpperCase())
      .filter((k): k is ProfileActivityKind => (PROFILE_ACTIVITY_KINDS as readonly string[]).includes(k));
    const limit = Number(sp.get('limit')) || 30;
    const withStats = sp.get('stats') !== '0';

    const [page, stats] = await Promise.all([
      getProfileActivity(user.id, { isOwner, viewerId: viewer?.id ?? null, before, limit, kinds }),
      withStats ? getProfileActivityStats(user.id, { isOwner, viewerId: viewer?.id ?? null }) : Promise.resolve(null),
    ]);

    return NextResponse.json(
      {
        isOwner,
        items: page.items,
        nextCursor: page.nextCursor,
        ...(stats ? { days: stats.days, totals: stats.totals } : {}),
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    logger.error('Loading user activity failed', { error: error as Error, component: 'api/users/activity' });
    return NextResponse.json({ error: 'Failed to load activity' }, { status: 500 });
  }
}
