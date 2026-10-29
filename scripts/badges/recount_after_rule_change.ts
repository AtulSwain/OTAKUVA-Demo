/**
 * One-off after the 2026-10-27 badge rule change (5-word minimum, 1h wait,
 * ticked/rated episodes count as watched, rated anime add level points).
 * Re-checks reviews that were never evaluated or were INELIGIBLE for
 * TOO_SHORT / NOT_WATCHED, matures the due ones (no daily cap — these were
 * written over weeks), then recounts every member with reviews or ratings.
 * Only badge-counting state changes; review text/ratings are never touched.
 *
 *   npx tsx scripts/badges/recount_after_rule_change.ts           # dry run
 *   npx tsx scripts/badges/recount_after_rule_change.ts --apply
 */
import { prisma } from '../../src/lib/prisma';
import { evaluateSubmission } from '../../src/lib/badges/rules';
import { BADGE_RULES } from '../../src/lib/badges/config';
import { hasWatchedEpisodes, initializeReviewCounting, recalculateUser, runMaturationBatch } from '../../src/lib/badges/countingService';

const apply = process.argv.includes('--apply');

(async () => {
  const reviews = await prisma.review.findMany({
    where: {
      deletedAt: null,
      status: 'PUBLISHED',
      OR: [{ countState: null }, { countState: 'INELIGIBLE', countRemovalReason: { in: ['TOO_SHORT', 'NOT_WATCHED'] } }],
    },
    select: { id: true, userId: true, animeId: true, body: true, reviewType: true, watchStatusAtReview: true, countState: true, user: { select: { username: true } } },
  });
  console.log(`${reviews.length} reviews to re-check${apply ? '' : ' (dry run)'}`);
  for (const r of reviews) {
    const statusOk = Boolean(r.watchStatusAtReview && BADGE_RULES.eligibleWatchStatuses.includes(r.watchStatusAtReview));
    const watched = statusOk || (await hasWatchedEpisodes(r.userId, r.animeId));
    const res = evaluateSubmission({ body: r.body, reviewType: r.reviewType, watchStatus: r.watchStatusAtReview, watchedEpisodes: watched });
    console.log(`  @${r.user.username}: ${r.countState ?? 'unchecked'} -> ${res.eligible ? 'PENDING' : `INELIGIBLE (${res.reason})`}  [${res.wordCount} words]`);
    if (apply) await initializeReviewCounting(r);
  }

  const users = new Set<string>([
    ...(await prisma.review.findMany({ where: { deletedAt: null }, select: { userId: true }, distinct: ['userId'] })).map((x) => x.userId),
    ...(await prisma.episodeRating.findMany({ where: { retention: { not: null } }, select: { userId: true }, distinct: ['userId'] })).map((x) => x.userId),
  ]);
  console.log(`${users.size} members to recount`);
  if (apply) {
    const m = await runMaturationBatch({ enforceDailyCap: false });
    console.log('maturation:', m);
    for (const id of Array.from(users)) {
      const r = await recalculateUser(id);
      const u = await prisma.user.findUnique({ where: { id }, select: { username: true } });
      console.log(`  @${u?.username}: ${r.countedReviewCount} points, tier ${r.tier}${r.changed ? ` (was ${r.previousTier})` : ''}`);
    }
  }
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
