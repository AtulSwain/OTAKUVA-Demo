import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { getCriticEligibleUserIds, getUserBadgeSnapshot } from '../../../../../lib/badges/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/users/:username/badges
 * Reviewer-badge summary for a profile header: tier, counts, progress toward
 * the next tier, and the communities list. Communities the user founded are
 * always listed; ones they merely joined are hidden when they turn
 * `showJoinedCommunities` off (the user still sees their own full list).
 * PRIVATE communities are never exposed to other viewers.
 */
export async function GET(request: NextRequest, { params }: { params: { username: string } }) {
  try {
    const user = await prisma.user.findFirst({
      where: { username: decodeURIComponent(params.username) },
      select: { id: true, username: true, showJoinedCommunities: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const authUser = await getAuthUserFromRequest(request);
    const isSelf = authUser?.id === user.id;

    const [snapshot, memberships, critics] = await Promise.all([
      getUserBadgeSnapshot(user.id),
      prisma.communityMember.findMany({
        where: {
          userId: user.id,
          status: 'ACTIVE',
          community: { status: 'ACTIVE', ...(isSelf ? {} : { visibility: { not: 'PRIVATE' } }) },
        },
        select: {
          role: true,
          community: { select: { slug: true, name: true, memberCount: true, iconUrl: true, ownerId: true } },
        },
      }),
      getCriticEligibleUserIds([user.id]),
    ]);

    const communities = memberships
      .map((m) => ({
        slug: m.community.slug,
        name: m.community.name,
        iconUrl: m.community.iconUrl,
        memberCount: m.community.memberCount,
        role: m.community.ownerId === user.id || m.role === 'OWNER' ? 'FOUNDER' : m.role === 'MEMBER' ? 'MEMBER' : 'MODERATOR',
      }))
      .filter((c) => c.role === 'FOUNDER' || user.showJoinedCommunities || isSelf)
      .sort((a, b) => Number(b.role === 'FOUNDER') - Number(a.role === 'FOUNDER') || b.memberCount - a.memberCount);

    const { progress } = snapshot;
    return NextResponse.json({
      username: user.username,
      tier: snapshot.tier,
      countedReviewCount: snapshot.countedReviewCount,
      pendingReviewCount: isSelf ? snapshot.pendingReviewCount : undefined,
      helpfulVotes: snapshot.helpfulVotes,
      isCritic: critics.has(user.id),
      progress: {
        nextTier: progress.next?.key ?? null,
        remaining: progress.remaining,
        fraction: progress.fraction,
      },
      communities,
      foundedCount: communities.filter((c) => c.role === 'FOUNDER').length,
      showJoinedCommunities: isSelf ? user.showJoinedCommunities : undefined,
    });
  } catch (error) {
    console.error('Error loading user badges:', error);
    return NextResponse.json({ error: 'Failed to load badges' }, { status: 500 });
  }
}
