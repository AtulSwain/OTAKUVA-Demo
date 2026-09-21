/**
 * Reviewer-badge counting pipeline (DB-facing). Pure rules live in rules.ts;
 * every tunable number lives in config.ts.
 *
 *   review written -> initializeReviewCounting  (PENDING or INELIGIBLE)
 *   recurring job  -> runMaturationBatch        (PENDING -> COUNTED / REMOVED)
 *   any change     -> recalculateUser           (tier, events, cached aggregates)
 *   moderation     -> removeReviewFromCount     (COUNTED -> REMOVED, tier may drop)
 *
 * NOTE: a review's displayed badge is the reviewer's CURRENT tier, not the
 * tier they held when they wrote it. That is why the per-anime aggregate is
 * rebuilt for a user's reviews whenever their tier changes.
 */
import { prisma } from '../prisma';
import { logger } from '../logger';
import { BADGE_RULES } from './config';
import {
  dailyCapRemaining,
  evaluateSubmission,
  isMature,
  resolveTier,
  spamOrDuplicateReason,
  utcDayStart,
} from './rules';
import { tierIndex, isTierKey, type TierKey } from './tiers';
import { BADGE_STRINGS, glossFor } from './strings';

export type CountState = 'PENDING' | 'COUNTED' | 'REMOVED' | 'INELIGIBLE';

// ---------------------------------------------------------------------------
// Cached aggregates
// ---------------------------------------------------------------------------

/** Rebuild the per-tier reviewer counts for these anime from source rows. */
export async function refreshAnimeAggregates(animeIds: string[]): Promise<void> {
  const ids = Array.from(new Set(animeIds));
  if (!ids.length) return;
  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM "AnimeBadgeAggregate" WHERE "animeId" = ANY(${ids})`,
    prisma.$executeRaw`
      INSERT INTO "AnimeBadgeAggregate" ("animeId", "tierKey", "count")
      SELECT r."animeId", COALESCE(s."currentTier", 'shoshinsha'), COUNT(*)::int
      FROM "Review" r
      LEFT JOIN "UserBadgeStats" s ON s."userId" = r."userId"
      WHERE r."animeId" = ANY(${ids}) AND r."countState" = 'COUNTED' AND r."deletedAt" IS NULL
      GROUP BY r."animeId", COALESCE(s."currentTier", 'shoshinsha')`,
  ]);
}

/** Rebuild the per-tier member counts for these communities from source rows. */
export async function refreshCommunityAggregates(communityIds: string[]): Promise<void> {
  const ids = Array.from(new Set(communityIds));
  if (!ids.length) return;
  await prisma.$transaction([
    prisma.$executeRaw`DELETE FROM "CommunityBadgeAggregate" WHERE "communityId" = ANY(${ids})`,
    prisma.$executeRaw`
      INSERT INTO "CommunityBadgeAggregate" ("communityId", "tierKey", "count")
      SELECT m."communityId", COALESCE(s."currentTier", 'shoshinsha'), COUNT(*)::int
      FROM "CommunityMember" m
      LEFT JOIN "UserBadgeStats" s ON s."userId" = m."userId"
      WHERE m."communityId" = ANY(${ids}) AND m."status" = 'ACTIVE'
      GROUP BY m."communityId", COALESCE(s."currentTier", 'shoshinsha')`,
  ]);
}

/** For membership hooks: a stale cache must never fail the join/leave/ban itself. */
export async function refreshCommunityAggregatesSafe(communityId: string): Promise<void> {
  try {
    await refreshCommunityAggregates([communityId]);
  } catch (err) {
    logger.error('community badge aggregate refresh failed', { component: 'badges/counting', communityId, err });
  }
}

/** Everything cached that depends on this user's tier. */
export async function refreshAggregatesForUser(userId: string): Promise<void> {
  const [reviews, memberships] = await Promise.all([
    prisma.review.findMany({ where: { userId, countState: 'COUNTED' }, select: { animeId: true } }),
    prisma.communityMember.findMany({ where: { userId, status: 'ACTIVE' }, select: { communityId: true } }),
  ]);
  await refreshAnimeAggregates(reviews.map((r) => r.animeId));
  await refreshCommunityAggregates(memberships.map((m) => m.communityId));
}

// ---------------------------------------------------------------------------
// Tier recalculation
// ---------------------------------------------------------------------------

export interface RecalcResult {
  userId: string;
  previousTier: TierKey;
  tier: TierKey;
  changed: boolean;
  countedReviewCount: number;
}

/**
 * Recompute a user's stats and tier from source rows. A tier change fires
 * exactly one event: the update is guarded on the previous tier, so a
 * concurrent run that loses the race writes nothing and emits nothing.
 */
export async function recalculateUser(userId: string, now: Date = new Date()): Promise<RecalcResult> {
  // createMany+skipDuplicates (not upsert) so two concurrent runs can't collide on the primary key.
  await prisma.userBadgeStats.createMany({ data: [{ userId }], skipDuplicates: true });
  const stats = await prisma.userBadgeStats.findUniqueOrThrow({ where: { userId } });
  const previousTier: TierKey = isTierKey(stats.currentTier) ? stats.currentTier : 'shoshinsha';

  const [counted, helpfulVotes] = await Promise.all([
    prisma.review.aggregate({
      where: { userId, countState: 'COUNTED', deletedAt: null },
      _count: { _all: true },
      _max: { countedAt: true },
    }),
    prisma.reviewLike.count({ where: { reactionType: 'HELPFUL', review: { userId, deletedAt: null } } }),
  ]);
  const countedReviewCount = counted._count._all;
  const lastCountedReviewAt = counted._max.countedAt ?? null;

  const resolved = resolveTier({
    countedReviewCount,
    hasConfirmedSpam: stats.hasConfirmedSpam,
    helpfulVotes,
    lastCountedReviewAt,
    previousTier,
    now,
  });
  const changed = resolved.key !== previousTier;

  const user = changed ? await prisma.user.findUnique({ where: { id: userId }, select: { username: true } }) : null;
  const rose = tierIndex(resolved) > tierIndex(previousTier);

  const won = await prisma.$transaction(async (tx) => {
    const claimed = await tx.userBadgeStats.updateMany({
      where: { userId, currentTier: stats.currentTier },
      data: { countedReviewCount, helpfulVotes, lastCountedReviewAt, currentTier: resolved.key },
    });
    if (claimed.count === 0) return false; // another run already moved this user

    if (changed) {
      await tx.badgeEvent.create({
        data: { userId, type: rose ? 'TIER_EARNED' : 'TIER_LOST', tierKey: resolved.key, count: countedReviewCount },
      });
      await tx.notification.create({
        data: {
          userId,
          type: rose ? 'BADGE_TIER_EARNED' : 'BADGE_TIER_CHANGED',
          title: rose ? BADGE_STRINGS.unlockTitle(resolved.name) : `Your reviewer badge is now ${resolved.name}`,
          body: rose ? BADGE_STRINGS.unlockBody(resolved.name, glossFor(resolved.glossKey)) : null,
          linkUrl: user ? `/profile/${user.username}` : null,
        },
      });
    }

    // Crossing into the critic's-section tier band: tell them (eligibility still needs a clean
    // record and recent activity, checked when the section is built).
    if (
      rose &&
      tierIndex(previousTier) < tierIndex(BADGE_RULES.critics.minTier) &&
      tierIndex(resolved) >= tierIndex(BADGE_RULES.critics.minTier)
    ) {
      await tx.notification.create({
        data: {
          userId,
          type: 'CRITIC_PICK',
          title: "You can now appear in the critic's section",
          body: 'Keep reviewing to stay eligible.',
          linkUrl: user ? `/profile/${user.username}` : null,
        },
      });
    }

    // Progress moments (not badges): fire once ever per milestone, upward only.
    const crossed = BADGE_RULES.milestones.filter((m) => stats.countedReviewCount < m && countedReviewCount >= m);
    if (crossed.length) {
      await tx.badgeEvent.createMany({
        data: crossed.map((m) => ({ userId, type: 'MILESTONE', count: m, dedupeKey: `milestone:${m}` })),
        skipDuplicates: true,
      });
    }
    return true;
  });

  if (won && changed) await refreshAggregatesForUser(userId);
  return { userId, previousTier, tier: resolved.key, changed: won && changed, countedReviewCount };
}

// ---------------------------------------------------------------------------
// Review lifecycle
// ---------------------------------------------------------------------------

interface ReviewForCounting {
  id: string;
  userId: string;
  animeId: string;
  body: string;
  reviewType: string;
  watchStatusAtReview: string | null;
  countState: string | null;
}

/**
 * Called whenever a review is created or edited. Sets word count and the
 * counting state. Star-only quick ratings never reach here (no review row).
 */
export async function initializeReviewCounting(review: ReviewForCounting): Promise<CountState> {
  const result = evaluateSubmission({
    body: review.body,
    reviewType: review.reviewType,
    watchStatus: review.watchStatusAtReview,
  });
  const prev = review.countState as CountState | null;

  // A counted review edited below the bar loses its count.
  if (prev === 'COUNTED' && !result.eligible) {
    await prisma.review.update({ where: { id: review.id }, data: { wordCount: result.wordCount } });
    await removeReviewFromCount(review.id, `EDITED_${result.reason}`);
    return 'REMOVED';
  }
  // Removed for spam/fraud is final; editing does not resurrect it.
  if (prev === 'REMOVED') {
    await prisma.review.update({ where: { id: review.id }, data: { wordCount: result.wordCount } });
    return 'REMOVED';
  }

  const next: CountState = prev === 'COUNTED' ? 'COUNTED' : result.eligible ? 'PENDING' : 'INELIGIBLE';
  await prisma.review.update({
    where: { id: review.id },
    data: {
      wordCount: result.wordCount,
      countState: next,
      countRemovalReason: next === 'INELIGIBLE' ? (result.reason ?? null) : null,
    },
  });
  return next;
}

/**
 * COUNTED/PENDING -> REMOVED (spam, fraud, moderation, deletion). The tier is
 * recalculated, so it can drop below a threshold it previously earned.
 * `confirmedSpam` also marks the user's record dirty (blocks Senpai and above
 * and the critic's section until cleared by an admin).
 */
export async function removeReviewFromCount(
  reviewId: string,
  reason: string,
  opts: { confirmedSpam?: boolean; now?: Date } = {}
): Promise<RecalcResult | null> {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { id: true, userId: true, animeId: true, countState: true },
  });
  if (!review) return null;

  if (review.countState !== 'REMOVED') {
    await prisma.review.update({ where: { id: reviewId }, data: { countState: 'REMOVED', countRemovalReason: reason } });
  }
  if (opts.confirmedSpam) {
    await prisma.userBadgeStats.upsert({
      where: { userId: review.userId },
      create: { userId: review.userId, hasConfirmedSpam: true },
      update: { hasConfirmedSpam: true },
    });
  }
  const result = await recalculateUser(review.userId, opts.now);
  await refreshAnimeAggregates([review.animeId]);
  return result;
}

/**
 * Moderation hook: call after a review is hidden/removed/deleted through the
 * normal review paths so its count is withdrawn too.
 */
export async function withdrawIfUnpublished(reviewId: string): Promise<void> {
  const r = await prisma.review.findUnique({
    where: { id: reviewId },
    select: { status: true, deletedAt: true, countState: true },
  });
  if (!r || (r.countState !== 'COUNTED' && r.countState !== 'PENDING')) return;
  if (r.deletedAt || r.status === 'DELETED' || r.status === 'REMOVED' || r.status === 'HIDDEN') {
    await removeReviewFromCount(reviewId, 'UNPUBLISHED');
  }
}

/** Admin action: clear a user's confirmed-spam flag and recompute. */
export async function clearConfirmedSpam(userId: string): Promise<RecalcResult> {
  await prisma.userBadgeStats.upsert({
    where: { userId },
    create: { userId },
    update: { hasConfirmedSpam: false },
  });
  return recalculateUser(userId);
}

// ---------------------------------------------------------------------------
// Maturation job
// ---------------------------------------------------------------------------

export interface MaturationSummary {
  examined: number;
  counted: number;
  removed: number;
  ineligible: number;
  deferredByCap: number;
  tiersChanged: number;
}

interface MaturationOptions {
  now?: Date;
  batchSize?: number;
  /** Off only for the one-off legacy backfill (reviews that pre-date badges). */
  enforceDailyCap?: boolean;
}

/**
 * One tick: mature PENDING reviews older than the maturity window. Each user's
 * due reviews are processed oldest-first under the daily cap; reviews over the
 * cap stay PENDING and are picked up on a later day (they are not removed).
 */
export async function runMaturationBatch(opts: MaturationOptions = {}): Promise<MaturationSummary> {
  const now = opts.now ?? new Date();
  const enforceCap = opts.enforceDailyCap ?? true;
  const cutoff = new Date(now.getTime() - BADGE_RULES.maturityHours * 3_600_000);
  const summary: MaturationSummary = { examined: 0, counted: 0, removed: 0, ineligible: 0, deferredByCap: 0, tiersChanged: 0 };

  const due = await prisma.review.findMany({
    where: { countState: 'PENDING', createdAt: { lte: cutoff } },
    orderBy: { createdAt: 'asc' },
    take: opts.batchSize ?? BADGE_RULES.job.batchSize,
    select: { id: true, userId: true, animeId: true, body: true, createdAt: true, status: true, deletedAt: true, reviewType: true, watchStatusAtReview: true },
  });
  summary.examined = due.length;

  const byUser = new Map<string, typeof due>();
  for (const r of due) byUser.set(r.userId, [...(byUser.get(r.userId) ?? []), r]);

  for (const [userId, reviews] of Array.from(byUser.entries())) {
    try {
      const touchedAnime: string[] = [];
      const countedToday = enforceCap
        ? await prisma.review.count({ where: { userId, countState: 'COUNTED', countedAt: { gte: utcDayStart(now) } } })
        : 0;
      let remaining = enforceCap ? dailyCapRemaining(countedToday) : Number.POSITIVE_INFINITY;

      for (const r of reviews) {
        if (!isMature(r.createdAt, now)) continue;
        if (r.deletedAt || r.status === 'DELETED' || r.status === 'REMOVED') {
          await prisma.review.update({ where: { id: r.id }, data: { countState: 'REMOVED', countRemovalReason: 'UNPUBLISHED' } });
          summary.removed++;
          continue;
        }
        if (r.status !== 'PUBLISHED') continue; // hidden/under review: wait, don't decide

        const submission = evaluateSubmission({ body: r.body, reviewType: r.reviewType, watchStatus: r.watchStatusAtReview });
        if (!submission.eligible) {
          await prisma.review.update({
            where: { id: r.id },
            data: { countState: 'INELIGIBLE', countRemovalReason: submission.reason ?? null, wordCount: submission.wordCount },
          });
          summary.ineligible++;
          continue;
        }

        const [own, sameAnime] = await Promise.all([
          prisma.review.findMany({
            where: { userId, id: { not: r.id }, createdAt: { lt: r.createdAt }, countState: { in: ['PENDING', 'COUNTED'] }, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: BADGE_RULES.spam.ownLookback,
            select: { body: true },
          }),
          prisma.review.findMany({
            where: { animeId: r.animeId, userId: { not: userId }, createdAt: { lt: r.createdAt }, countState: { in: ['PENDING', 'COUNTED'] }, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: BADGE_RULES.spam.sameAnimeLookback,
            select: { body: true },
          }),
        ]);
        const spam = spamOrDuplicateReason(r.body, [...own, ...sameAnime].map((x) => x.body));
        if (spam) {
          await prisma.review.update({ where: { id: r.id }, data: { countState: 'REMOVED', countRemovalReason: spam } });
          summary.removed++;
          continue;
        }

        if (remaining <= 0) {
          summary.deferredByCap++;
          continue;
        }
        await prisma.review.update({
          where: { id: r.id },
          data: { countState: 'COUNTED', countedAt: now, wordCount: submission.wordCount, countRemovalReason: null },
        });
        remaining--;
        summary.counted++;
        touchedAnime.push(r.animeId);
      }

      const recalc = await recalculateUser(userId, now);
      if (recalc.changed) summary.tiersChanged++;
      // Tier changes already refreshed every anime this user reviewed.
      if (!recalc.changed) await refreshAnimeAggregates(touchedAnime);
    } catch (err) {
      logger.error('badge maturation failed for user', { component: 'badges/counting', userId, err });
    }
  }

  logger.info('badge maturation tick', { component: 'badges/counting', ...summary });
  return summary;
}

/**
 * One-off: evaluate reviews that pre-date the badge system (countState null).
 * Marks each PENDING or INELIGIBLE; the maturation job then decides.
 */
export async function backfillReviewCounting(limit = 5000): Promise<{ pending: number; ineligible: number }> {
  const rows = await prisma.review.findMany({
    where: { countState: null },
    take: limit,
    select: { id: true, userId: true, animeId: true, body: true, reviewType: true, watchStatusAtReview: true, countState: true },
  });
  let pending = 0;
  let ineligible = 0;
  for (const r of rows) {
    const state = await initializeReviewCounting(r);
    if (state === 'PENDING') pending++;
    else ineligible++;
  }
  return { pending, ineligible };
}
