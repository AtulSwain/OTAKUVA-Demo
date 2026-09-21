/**
 * Reviewer-badge counting, run by hand.
 *
 *   npx tsx scripts/badges/run_counting.ts backfill      # evaluate reviews that pre-date badges
 *   npx tsx scripts/badges/run_counting.ts mature        # one maturation tick (what the worker runs every 15 min)
 *   npx tsx scripts/badges/run_counting.ts mature --no-cap   # same, ignoring the daily cap (legacy backfill only)
 *   npx tsx scripts/badges/run_counting.ts rebuild       # rebuild every cached aggregate from source rows
 *
 * The recurring job (`badges:maturation`) is registered by scripts/worker.ts;
 * this script is for first-time backfill, debugging, and repairs.
 */
import { prisma } from '../../src/lib/prisma';
import { backfillReviewCounting, runMaturationBatch, recalculateUser, refreshAnimeAggregates, refreshCommunityAggregates } from '../../src/lib/badges/countingService';

async function main() {
  const [cmd, ...flags] = process.argv.slice(2);
  if (cmd === 'backfill') {
    console.log(await backfillReviewCounting());
  } else if (cmd === 'mature') {
    console.log(await runMaturationBatch({ enforceDailyCap: !flags.includes('--no-cap') }));
  } else if (cmd === 'rebuild') {
    const users = await prisma.review.findMany({ where: { countState: 'COUNTED' }, distinct: ['userId'], select: { userId: true } });
    for (const u of users) await recalculateUser(u.userId);
    const anime = await prisma.review.findMany({ where: { countState: 'COUNTED' }, distinct: ['animeId'], select: { animeId: true } });
    for (let i = 0; i < anime.length; i += 500) await refreshAnimeAggregates(anime.slice(i, i + 500).map((a) => a.animeId));
    const communities = await prisma.community.findMany({ select: { id: true } });
    for (let i = 0; i < communities.length; i += 500) await refreshCommunityAggregates(communities.slice(i, i + 500).map((c) => c.id));
    console.log({ users: users.length, anime: anime.length, communities: communities.length });
  } else {
    console.log('usage: run_counting.ts backfill | mature [--no-cap] | rebuild');
    process.exitCode = 1;
  }
  await prisma.$disconnect();
}
main();
