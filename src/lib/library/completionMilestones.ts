/**
 * Completion milestones (owner, 2026-10-25: "if I complete 10 anime, the new
 * badge should be given at that moment"). Reaching 10 / 25 / 50 / 100 / 250 /
 * 500 / 1000 completed anime earns a milestone stamp on the profile and one
 * notification, sent the moment the anime that reached it is completed.
 *
 * Exactly once per milestone per member: a per-member advisory lock plus a
 * "already has this milestone's notification" check (no schema change).
 * Dropping a completed anime later never takes a milestone back once earned
 * notifications exist — the profile shows milestones from the live count.
 */
import { prisma } from '../prisma';
import { logger } from '../logger';

export const COMPLETION_MILESTONES = [10, 25, 50, 100, 250, 500, 1000] as const;
export const COMPLETION_MILESTONE_NOTIFICATION = 'COMPLETION_MILESTONE';

export function milestoneProgress(completed: number) {
  const earned = COMPLETION_MILESTONES.filter((m) => completed >= m);
  const next = COMPLETION_MILESTONES.find((m) => completed < m) ?? null;
  return { earned: [...earned], next, toNext: next === null ? 0 : next - completed };
}

/** Call after anything that may mark an anime COMPLETED. Best-effort; never throws. */
export async function awardCompletionMilestones(userId: string): Promise<number[]> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`completion-milestone:${userId}`}))`;
      const [completed, user] = await Promise.all([
        tx.userAnime.count({ where: { userId, status: 'COMPLETED' } }),
        tx.user.findUnique({ where: { id: userId }, select: { username: true } }),
      ]);
      if (!user) return [];
      const reached = COMPLETION_MILESTONES.filter((m) => completed >= m);
      if (reached.length === 0) return [];
      const link = (m: number) => `/profile/${encodeURIComponent(user.username)}?tab=library&status=completed&milestone=${m}`;
      const already = new Set(
        (
          await tx.notification.findMany({
            where: { userId, type: COMPLETION_MILESTONE_NOTIFICATION },
            select: { linkUrl: true },
          })
        ).map((n) => n.linkUrl)
      );
      const fresh = reached.filter((m) => !already.has(link(m)));
      if (fresh.length === 0) return [];
      await tx.notification.createMany({
        data: fresh.map((m) => ({
          userId,
          type: COMPLETION_MILESTONE_NOTIFICATION,
          title: `Milestone unlocked: ${m} anime completed`,
          body: `You've finished ${m} anime on OTAKUVA — a new stamp is on your profile.`,
          linkUrl: link(m),
        })),
      });
      return fresh;
    });
  } catch (error) {
    logger.warn('completion milestone check failed', { error, userId });
    return [];
  }
}
