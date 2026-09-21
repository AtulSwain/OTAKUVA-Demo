import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { BADGE_RULES } from '../../../../lib/badges/config';
import { getUserBadgeSnapshot } from '../../../../lib/badges/queries';
import { getTier, isTierKey } from '../../../../lib/badges/tiers';
import { BADGE_STRINGS, glossFor } from '../../../../lib/badges/strings';

export const dynamic = 'force-dynamic';

/**
 * GET  /api/me/badge-events   unseen tier-earned / milestone events (oldest first)
 * POST /api/me/badge-events   { ids: string[] } mark them seen, so each toast shows once
 */
export async function GET(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return NextResponse.json({ events: [] });

  const rows = await prisma.badgeEvent.findMany({
    where: { userId: user.id, seenAt: null, type: { in: ['TIER_EARNED', 'MILESTONE'] } },
    orderBy: { createdAt: 'asc' },
    take: 5,
  });
  if (!rows.length) return NextResponse.json({ events: [] });

  const snapshot = await getUserBadgeSnapshot(user.id);
  const events = rows.map((e) => {
    if (e.type === 'TIER_EARNED' && isTierKey(e.tierKey)) {
      const t = getTier(e.tierKey);
      return { id: e.id, type: e.type, tierKey: t.key, title: BADGE_STRINGS.unlockTitle(t.name), body: BADGE_STRINGS.unlockBody(t.name, glossFor(t.glossKey)) };
    }
    const next = snapshot.progress.next;
    return {
      id: e.id,
      type: 'MILESTONE',
      count: e.count,
      title: BADGE_STRINGS.milestone(e.count),
      body: next ? BADGE_STRINGS.milestoneBody(next.name, Math.max(0, next.min - e.count)) : '',
    };
  });
  return NextResponse.json({ events, milestones: BADGE_RULES.milestones });
}

export async function POST(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids.filter((x: unknown): x is string => typeof x === 'string').slice(0, 20) : [];
  const res = await prisma.badgeEvent.updateMany({ where: { id: { in: ids }, userId: user.id, seenAt: null }, data: { seenAt: new Date() } });
  return NextResponse.json({ marked: res.count });
}
