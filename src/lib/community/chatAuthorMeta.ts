import { prisma } from '../prisma';
import { isTierKey, type TierKey } from '../badges/tiers';

/** Community-scoped role as shown next to a chat author. Display only. */
export type ChatAuthorRole = 'FOUNDER' | 'ADMIN' | 'MODERATOR' | 'MEMBER';

export interface ChatAuthorMeta {
  role: ChatAuthorRole;
  /** Reviewer badge tier, derived from UserBadgeStats; Shoshinsha when none. */
  tier: TierKey;
  reviewCount: number;
}

/**
 * Per-author role + reviewer badge for a set of chat authors in one
 * community. Role comes from CommunityMember.role (or community ownership);
 * the badge never grants authority, it is only shown so readers can tell
 * who is talking. Two queries regardless of message count.
 */
export async function getChatAuthorMeta(
  communityId: string,
  ownerId: string,
  userIds: string[]
): Promise<Map<string, ChatAuthorMeta>> {
  const ids = Array.from(new Set(userIds));
  const result = new Map<string, ChatAuthorMeta>();
  if (ids.length === 0) return result;

  const [members, stats] = await Promise.all([
    prisma.communityMember.findMany({
      where: { communityId, userId: { in: ids } },
      select: { userId: true, role: true },
    }),
    prisma.userBadgeStats.findMany({
      where: { userId: { in: ids } },
      select: { userId: true, currentTier: true, countedReviewCount: true },
    }),
  ]);

  const roleByUser = new Map(members.map((m) => [m.userId, m.role]));
  const statsByUser = new Map(stats.map((s) => [s.userId, s]));

  for (const id of ids) {
    const memberRole = roleByUser.get(id);
    const role: ChatAuthorRole =
      id === ownerId || memberRole === 'OWNER'
        ? 'FOUNDER'
        : memberRole === 'ADMIN'
          ? 'ADMIN'
          : memberRole === 'MODERATOR'
            ? 'MODERATOR'
            : 'MEMBER';
    const s = statsByUser.get(id);
    result.set(id, {
      role,
      tier: s && isTierKey(s.currentTier) ? s.currentTier : 'shoshinsha',
      reviewCount: s?.countedReviewCount ?? 0,
    });
  }
  return result;
}
