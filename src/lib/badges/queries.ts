/**
 * Read-side helpers for badge display. Everything here reads cached rows
 * (UserBadgeStats, *BadgeAggregate); nothing computes a live aggregate.
 */
import { prisma } from '../prisma';
import { BADGE_RULES } from './config';
import { isCriticEligible } from './rules';
import { progressToNext, getTier, isTierKey, type TierKey, type TierProgressInfo } from './tiers';

export interface UserBadgeSnapshot {
  userId: string;
  tier: TierKey;
  countedReviewCount: number;
  pendingReviewCount: number;
  helpfulVotes: number;
  hasConfirmedSpam: boolean;
  progress: TierProgressInfo;
}

export async function getUserBadgeSnapshot(userId: string): Promise<UserBadgeSnapshot> {
  const [stats, pending] = await Promise.all([
    prisma.userBadgeStats.findUnique({ where: { userId } }),
    prisma.review.count({ where: { userId, countState: 'PENDING', deletedAt: null } }),
  ]);
  const count = stats?.countedReviewCount ?? 0;
  const tier: TierKey = stats && isTierKey(stats.currentTier) ? stats.currentTier : 'shoshinsha';
  const progress = progressToNext(count);
  // Progress is measured on the counted total; keep the displayed tier consistent with it
  // unless a quality gate (clean record) is holding the user below their count-based tier.
  return {
    userId,
    tier,
    countedReviewCount: count,
    pendingReviewCount: pending,
    helpfulVotes: stats?.helpfulVotes ?? 0,
    hasConfirmedSpam: stats?.hasConfirmedSpam ?? false,
    progress: { ...progress, current: getTier(tier) },
  };
}

export interface TierBrief {
  tier: TierKey;
  count: number;
}

/** Current tier + counted total for many users at once (feed chips, member lists). */
export async function getTierBriefs(userIds: string[]): Promise<Map<string, TierBrief>> {
  const ids = Array.from(new Set(userIds));
  const out = new Map<string, TierBrief>();
  if (!ids.length) return out;
  const rows = await prisma.userBadgeStats.findMany({
    where: { userId: { in: ids } },
    select: { userId: true, currentTier: true, countedReviewCount: true },
  });
  for (const r of rows) out.set(r.userId, { tier: isTierKey(r.currentTier) ? r.currentTier : 'shoshinsha', count: r.countedReviewCount });
  for (const id of ids) if (!out.has(id)) out.set(id, { tier: 'shoshinsha', count: 0 });
  return out;
}

/** Users who currently qualify for the critic's section, from a candidate set. */
export async function getCriticEligibleUserIds(userIds: string[], now = new Date()): Promise<Set<string>> {
  const ids = Array.from(new Set(userIds));
  if (!ids.length) return new Set();
  const since = new Date(now.getTime() - BADGE_RULES.critics.recentActivityDays * 86_400_000);
  const [stats, recent] = await Promise.all([
    prisma.userBadgeStats.findMany({ where: { userId: { in: ids } }, select: { userId: true, currentTier: true, hasConfirmedSpam: true } }),
    prisma.review.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, countState: 'COUNTED', countedAt: { gte: since }, deletedAt: null },
      _count: { _all: true },
    }),
  ]);
  const recentBy = new Map(recent.map((r) => [r.userId, r._count._all]));
  const eligible = new Set<string>();
  for (const s of stats) {
    if (!isTierKey(s.currentTier)) continue;
    if (isCriticEligible({ tier: s.currentTier, hasConfirmedSpam: s.hasConfirmedSpam, recentCountedReviews: recentBy.get(s.userId) ?? 0 })) {
      eligible.add(s.userId);
    }
  }
  return eligible;
}

export async function getAnimeBadgeDistribution(animeId: string): Promise<Record<string, number>> {
  const rows = await prisma.animeBadgeAggregate.findMany({ where: { animeId } });
  return Object.fromEntries(rows.map((r) => [r.tierKey, r.count]));
}

export async function getCommunityBadgeDistribution(communityId: string): Promise<Record<string, number>> {
  const rows = await prisma.communityBadgeAggregate.findMany({ where: { communityId } });
  return Object.fromEntries(rows.map((r) => [r.tierKey, r.count]));
}
