import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { canUserViewCommunityContent } from '../../../../../lib/engine/community/communityEngine';
import { getCommunityBadgeDistribution } from '../../../../../lib/badges/queries';
import { isTierKey, tierIndex, type TierKey } from '../../../../../lib/badges/tiers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/communities/:slug/badges?page=&limit=
 * Members by badge (cached aggregate) and the member list, highest badge
 * first. Badges are display only: they grant no extra authority here.
 */
export async function GET(request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)));

    const community = await prisma.community.findFirst({
      where: { OR: [{ slug: params.slug }, { id: params.slug }] },
      select: {
        id: true, ownerId: true, visibility: true, status: true, name: true, memberCount: true,
        owner: { select: { username: true } },
      },
    });
    if (!community) return NextResponse.json({ error: 'Community not found' }, { status: 404 });

    const authUser = await getAuthUserFromRequest(request);
    if (!(await canUserViewCommunityContent(community, authUser?.id))) {
      return NextResponse.json({ error: 'Access denied: Private community membership required' }, { status: 403 });
    }

    const where = { communityId: community.id, status: 'ACTIVE' };
    // Members without stats (no counted reviews) sort last: order in SQL, since Prisma
    // cannot NULLS-LAST a relation ordering.
    const ordered = await prisma.$queryRaw<{ id: string }[]>`
      SELECT m."id"
      FROM "CommunityMember" m
      LEFT JOIN "UserBadgeStats" s ON s."userId" = m."userId"
      WHERE m."communityId" = ${community.id} AND m."status" = 'ACTIVE'
      ORDER BY COALESCE(s."countedReviewCount", 0) DESC, m."joinedAt" ASC
      LIMIT ${limit} OFFSET ${(page - 1) * limit}`;
    const [distribution, found, total] = await Promise.all([
      getCommunityBadgeDistribution(community.id),
      prisma.communityMember.findMany({
        where: { id: { in: ordered.map((o) => o.id) } },
        select: {
          id: true,
          role: true,
          user: { select: { id: true, username: true, avatarUrl: true, badgeStats: { select: { currentTier: true, countedReviewCount: true } } } },
        },
      }),
      prisma.communityMember.count({ where }),
    ]);
    const byId = new Map(found.map((f) => [f.id, f]));
    const rows = ordered.map((o) => byId.get(o.id)).filter((r): r is NonNullable<typeof r> => Boolean(r));

    const members = rows
      .map((m) => {
        const tier: TierKey = m.user.badgeStats && isTierKey(m.user.badgeStats.currentTier) ? m.user.badgeStats.currentTier : 'shoshinsha';
        return {
          userId: m.user.id,
          username: m.user.username,
          avatarUrl: m.user.avatarUrl,
          tier,
          reviewCount: m.user.badgeStats?.countedReviewCount ?? 0,
          role: m.user.id === community.ownerId || m.role === 'OWNER' ? 'FOUNDER' : m.role === 'MEMBER' ? 'MEMBER' : m.role === 'ADMIN' ? 'ADMIN' : 'MODERATOR',
        };
      })
      // Highest badge first; the DB already ordered by counted reviews, which only
      // differs from tier order for spam-capped accounts.
      .sort((a, b) => tierIndex(b.tier) - tierIndex(a.tier) || b.reviewCount - a.reviewCount);

    return NextResponse.json({
      name: community.name,
      createdBy: community.owner.username,
      memberCount: community.memberCount,
      distribution,
      members,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error loading community badges:', error);
    return NextResponse.json({ error: 'Failed to load community badges' }, { status: 500 });
  }
}
