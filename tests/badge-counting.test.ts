import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { createAnime, createUser } from './helpers/fixtures';
import { BADGE_RULES } from '../src/lib/badges/config';
import {
  countWords,
  dailyCapRemaining,
  evaluateSubmission,
  isCriticEligible,
  isMature,
  resolveTier,
  spamOrDuplicateReason,
} from '../src/lib/badges/rules';
import {
  initializeReviewCounting,
  recalculateUser,
  removeReviewFromCount,
  runMaturationBatch,
  withdrawIfUnpublished,
} from '../src/lib/badges/countingService';

after(async () => {
  await prisma.$disconnect();
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Body of `n` distinct words, so two calls with different seeds never look like duplicates. */
const words = (n: number, seed = 'a') => Array.from({ length: n }, (_, i) => `${seed}word${i}`).join(' ');

describe('submission rules', () => {
  test('minimum length: 39 words fails, 40 passes', () => {
    const base = { reviewType: 'ANIME_REVIEW', watchStatus: 'COMPLETED' };
    assert.equal(evaluateSubmission({ ...base, body: words(39) }).reason, 'TOO_SHORT');
    assert.equal(evaluateSubmission({ ...base, body: words(40) }).eligible, true);
    assert.equal(BADGE_RULES.minWords, 40);
  });

  test('needs a watched or in-progress entry; plan-to-watch and none do not count', () => {
    const body = words(45);
    const base = { body, reviewType: 'ANIME_REVIEW' };
    assert.equal(evaluateSubmission({ ...base, watchStatus: 'WATCHING' }).eligible, true);
    assert.equal(evaluateSubmission({ ...base, watchStatus: 'COMPLETED' }).eligible, true);
    assert.equal(evaluateSubmission({ ...base, watchStatus: 'PLAN_TO_WATCH' }).reason, 'NOT_WATCHED');
    assert.equal(evaluateSubmission({ ...base, watchStatus: null }).reason, 'NOT_WATCHED');
  });

  test('episode reviews never count', () => {
    assert.equal(evaluateSubmission({ body: words(50), reviewType: 'EPISODE_REVIEW', watchStatus: 'COMPLETED' }).reason, 'WRONG_REVIEW_TYPE');
  });

  test('CJK text is counted by word segmentation, not whitespace', () => {
    assert.ok(countWords('この作品は本当に素晴らしい物語でした。') > 3);
  });

  test('the rating is never consulted (no positivity gate)', () => {
    const src = evaluateSubmission.toString();
    assert.ok(!/rating/i.test(src));
  });
});

describe('maturity, daily cap, spam', () => {
  test('mature only after the window', () => {
    const created = new Date('2026-01-01T00:00:00Z');
    assert.equal(isMature(created, new Date(created.getTime() + 47 * HOUR)), false);
    assert.equal(isMature(created, new Date(created.getTime() + 48 * HOUR)), true);
  });

  test('daily cap arithmetic', () => {
    assert.equal(dailyCapRemaining(0), 5);
    assert.equal(dailyCapRemaining(4), 1);
    assert.equal(dailyCapRemaining(5), 0);
    assert.equal(dailyCapRemaining(9), 0);
  });

  test('duplicate and obvious-spam detection', () => {
    const a = words(60, 'x');
    assert.equal(spamOrDuplicateReason(a, [a]), 'DUPLICATE_TEXT');
    assert.equal(spamOrDuplicateReason(a + ' extra tail', [a]), 'DUPLICATE_TEXT');
    assert.equal(spamOrDuplicateReason(words(60, 'y'), [a]), null);
    assert.equal(spamOrDuplicateReason(`${words(45)} http://a.co http://b.co http://c.co`, []), 'TOO_MANY_LINKS');
    assert.equal(spamOrDuplicateReason('great '.repeat(60), []), 'LOW_VARIETY');
    assert.equal(spamOrDuplicateReason(`${words(45)} ${'a'.repeat(20)}`, []), 'REPEATED_CHARACTERS');
  });
});

describe('tier resolution and quality gates', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  const recent = new Date(now.getTime() - 5 * DAY);
  const stale = new Date(now.getTime() - 200 * DAY);
  const base = { hasConfirmedSpam: false, helpfulVotes: 0, lastCountedReviewAt: recent, previousTier: 'shoshinsha' as const, now };

  test('plain thresholds', () => {
    assert.equal(resolveTier({ ...base, countedReviewCount: 9 }).key, 'shoshinsha');
    assert.equal(resolveTier({ ...base, countedReviewCount: 10 }).key, 'kohai');
    assert.equal(resolveTier({ ...base, countedReviewCount: 100 }).key, 'senpai');
    assert.equal(resolveTier({ ...base, countedReviewCount: 1500 }).key, 'densetsu');
  });

  test('a confirmed-spam record is capped below Senpai', () => {
    assert.equal(resolveTier({ ...base, countedReviewCount: 600, hasConfirmedSpam: true }).key, 'kohai');
  });

  test('confirmed spam drops a tier that was already held', () => {
    assert.equal(resolveTier({ ...base, countedReviewCount: 600, hasConfirmedSpam: true, previousTier: 'sensei' }).key, 'kohai');
  });

  test('Meijin needs recent activity to be EARNED', () => {
    assert.equal(resolveTier({ ...base, countedReviewCount: 1000, lastCountedReviewAt: stale, previousTier: 'tatsujin' }).key, 'tatsujin');
    assert.equal(resolveTier({ ...base, countedReviewCount: 1000, lastCountedReviewAt: recent, previousTier: 'tatsujin' }).key, 'meijin');
  });

  test('an earned Meijin is permanent when they go quiet', () => {
    assert.equal(resolveTier({ ...base, countedReviewCount: 1200, lastCountedReviewAt: stale, previousTier: 'meijin' }).key, 'meijin');
  });

  test('a held tier still drops when removals push the count below its threshold', () => {
    assert.equal(resolveTier({ ...base, countedReviewCount: 499, previousTier: 'sensei' }).key, 'mekiki');
  });

  test('helpful-vote floor ships disabled: Sensei needs no votes at launch', () => {
    assert.equal(resolveTier({ ...base, countedReviewCount: 500, helpfulVotes: 0 }).key, 'sensei');
  });

  test('critic eligibility: Senpai+, clean record, recent activity', () => {
    const ok = { tier: 'senpai' as const, hasConfirmedSpam: false, recentCountedReviews: 1 };
    assert.equal(isCriticEligible(ok), true);
    assert.equal(isCriticEligible({ ...ok, tier: 'kohai' }), false);
    assert.equal(isCriticEligible({ ...ok, hasConfirmedSpam: true }), false);
    assert.equal(isCriticEligible({ ...ok, recentCountedReviews: 0 }), false);
  });
});

// ---------------------------------------------------------------------------
// Pipeline against the throwaway database
// ---------------------------------------------------------------------------

let animeSeq = 0;
async function makeAnime(n: number) {
  const tag = `${Date.now().toString(36)}${animeSeq++}`;
  await prisma.anime.createMany({
    data: Array.from({ length: n }, (_, i) => ({
      slug: `badge-${tag}-${i}`,
      canonicalTitle: `Badge ${tag} ${i}`,
      synopsis: '',
      posterUrl: '',
      externalSource: 'mal',
      externalId: `badge-${tag}-${i}`,
    })),
  });
  return prisma.anime.findMany({ where: { slug: { startsWith: `badge-${tag}-` } }, orderBy: { slug: 'asc' }, select: { id: true } });
}

async function makeReview(userId: string, animeId: string, o: Record<string, unknown> = {}) {
  return prisma.review.create({
    data: {
      userId,
      animeId,
      title: 't',
      body: words(45, `${userId.slice(-4)}${animeId.slice(-4)}`),
      watchStatusAtReview: 'COMPLETED',
      wordCount: 45,
      countState: 'PENDING',
      createdAt: new Date(Date.now() - 72 * HOUR),
      ...o,
    },
  });
}

describe('counting pipeline', () => {
  test('one review per user per title is enforced by the database', async () => {
    const u = await createUser();
    const a = await createAnime();
    await makeReview(u.id, a.id);
    await assert.rejects(makeReview(u.id, a.id));
  });

  test('initializeReviewCounting: eligible -> PENDING, short -> INELIGIBLE with reason', async () => {
    const u = await createUser();
    const [a1, a2] = await makeAnime(2);
    const good = await prisma.review.create({
      data: { userId: u.id, animeId: a1.id, title: 't', body: words(45), watchStatusAtReview: 'WATCHING' },
    });
    assert.equal(await initializeReviewCounting({ ...good, countState: good.countState }), 'PENDING');
    const short = await prisma.review.create({
      data: { userId: u.id, animeId: a2.id, title: 't', body: words(10), watchStatusAtReview: 'WATCHING' },
    });
    assert.equal(await initializeReviewCounting({ ...short, countState: short.countState }), 'INELIGIBLE');
    const row = await prisma.review.findUniqueOrThrow({ where: { id: short.id } });
    assert.equal(row.countRemovalReason, 'TOO_SHORT');
    assert.equal(row.wordCount, 10);
  });

  test('pending stays pending inside the 48h window, then becomes counted', async () => {
    const u = await createUser();
    const a = await createAnime();
    const r = await makeReview(u.id, a.id, { createdAt: new Date(Date.now() - 40 * HOUR) });
    await runMaturationBatch();
    assert.equal((await prisma.review.findUniqueOrThrow({ where: { id: r.id } })).countState, 'PENDING');
    await runMaturationBatch({ now: new Date(Date.now() + 10 * HOUR) });
    const done = await prisma.review.findUniqueOrThrow({ where: { id: r.id } });
    assert.equal(done.countState, 'COUNTED');
    assert.ok(done.countedAt);
  });

  test('daily cap: 7 due reviews -> 5 counted today, the rest wait for tomorrow', async () => {
    const u = await createUser();
    const animes = await makeAnime(7);
    for (let i = 0; i < 7; i++) await makeReview(u.id, animes[i].id, { createdAt: new Date(Date.now() - (100 - i) * HOUR) });
    const first = await runMaturationBatch();
    assert.equal(first.counted >= 5, true);
    const states = () => prisma.review.groupBy({ by: ['countState'], where: { userId: u.id }, _count: true });
    const g1 = Object.fromEntries((await states()).map((s) => [s.countState, s._count]));
    assert.equal(g1.COUNTED, 5);
    assert.equal(g1.PENDING, 2);
    await runMaturationBatch({ now: new Date(Date.now() + 25 * HOUR) });
    const g2 = Object.fromEntries((await states()).map((s) => [s.countState, s._count]));
    assert.equal(g2.COUNTED, 7);
  });

  test('near-duplicate text is removed, original is kept', async () => {
    const u = await createUser();
    const [a1, a2] = await makeAnime(2);
    const text = words(60, 'dup');
    const original = await makeReview(u.id, a1.id, { body: text, createdAt: new Date(Date.now() - 100 * HOUR) });
    const copy = await makeReview(u.id, a2.id, { body: `${text} bonus`, createdAt: new Date(Date.now() - 90 * HOUR) });
    await runMaturationBatch();
    assert.equal((await prisma.review.findUniqueOrThrow({ where: { id: original.id } })).countState, 'COUNTED');
    const removed = await prisma.review.findUniqueOrThrow({ where: { id: copy.id } });
    assert.equal(removed.countState, 'REMOVED');
    assert.equal(removed.countRemovalReason, 'DUPLICATE_TEXT');
  });

  test('crossing a threshold fires exactly one tier event, and repeat runs add none', async () => {
    const u = await createUser();
    const animes = await makeAnime(10);
    for (const a of animes) await makeReview(u.id, a.id, { countState: 'COUNTED', countedAt: new Date() });
    const first = await recalculateUser(u.id);
    assert.equal(first.tier, 'kohai');
    assert.equal(first.changed, true);
    const again = await recalculateUser(u.id);
    assert.equal(again.changed, false);
    const events = await prisma.badgeEvent.findMany({ where: { userId: u.id, type: 'TIER_EARNED' } });
    assert.equal(events.length, 1);
    assert.equal(events[0].tierKey, 'kohai');
    const notes = await prisma.notification.findMany({ where: { userId: u.id, type: 'BADGE_TIER_EARNED' } });
    assert.equal(notes.length, 1);
  });

  test('concurrent recalculations still emit exactly one event', async () => {
    const u = await createUser();
    const animes = await makeAnime(10);
    for (const a of animes) await makeReview(u.id, a.id, { countState: 'COUNTED', countedAt: new Date() });
    await Promise.all([recalculateUser(u.id), recalculateUser(u.id), recalculateUser(u.id)]);
    assert.equal(await prisma.badgeEvent.count({ where: { userId: u.id, type: 'TIER_EARNED' } }), 1);
  });

  test('removal lowers a tier, and the anime aggregate follows the reviewer', async () => {
    const u = await createUser();
    const animes = await makeAnime(10);
    const reviews = [];
    for (const a of animes) reviews.push(await makeReview(u.id, a.id, { countState: 'COUNTED', countedAt: new Date() }));
    await recalculateUser(u.id);
    const agg = await prisma.animeBadgeAggregate.findMany({ where: { animeId: animes[0].id } });
    assert.deepEqual(agg.map((x) => [x.tierKey, x.count]), [['kohai', 1]]);

    const dropped = await removeReviewFromCount(reviews[0].id, 'SPAM_CONFIRMED', { confirmedSpam: true });
    assert.equal(dropped?.tier, 'shoshinsha');
    const stats = await prisma.userBadgeStats.findUniqueOrThrow({ where: { userId: u.id } });
    assert.equal(stats.countedReviewCount, 9);
    assert.equal(stats.hasConfirmedSpam, true);
    assert.equal(await prisma.badgeEvent.count({ where: { userId: u.id, type: 'TIER_LOST' } }), 1);
    const after = await prisma.animeBadgeAggregate.findMany({ where: { animeId: animes[1].id } });
    assert.deepEqual(after.map((x) => [x.tierKey, x.count]), [['shoshinsha', 1]]);
    assert.equal(await prisma.animeBadgeAggregate.count({ where: { animeId: animes[0].id } }), 0);
  });

  test('a confirmed-spam record blocks Senpai even with 100 counted reviews', async () => {
    const u = await createUser();
    const animes = await makeAnime(100);
    await prisma.review.createMany({
      data: animes.map((a) => ({
        userId: u.id, animeId: a.id, title: 't', body: words(45, a.id.slice(-6)), watchStatusAtReview: 'COMPLETED',
        wordCount: 45, countState: 'COUNTED', countedAt: new Date(),
      })),
    });
    await prisma.userBadgeStats.create({ data: { userId: u.id, hasConfirmedSpam: true } });
    assert.equal((await recalculateUser(u.id)).tier, 'kohai');
    await prisma.userBadgeStats.update({ where: { userId: u.id }, data: { hasConfirmedSpam: false } });
    assert.equal((await recalculateUser(u.id)).tier, 'senpai');
  });

  test('milestones fire once each, upward only', async () => {
    const u = await createUser();
    const animes = await makeAnime(26);
    await prisma.review.createMany({
      data: animes.map((a) => ({
        userId: u.id, animeId: a.id, title: 't', body: words(45, a.id.slice(-6)), watchStatusAtReview: 'COMPLETED',
        wordCount: 45, countState: 'COUNTED', countedAt: new Date(),
      })),
    });
    await recalculateUser(u.id);
    await recalculateUser(u.id);
    const ev = await prisma.badgeEvent.findMany({ where: { userId: u.id, type: 'MILESTONE' } });
    assert.deepEqual(ev.map((e) => e.count), [25]);
  });

  test('unpublishing a counted review withdraws its count', async () => {
    const u = await createUser();
    const a = await createAnime();
    const r = await makeReview(u.id, a.id, { countState: 'COUNTED', countedAt: new Date() });
    await prisma.review.update({ where: { id: r.id }, data: { status: 'HIDDEN' } });
    await withdrawIfUnpublished(r.id);
    const row = await prisma.review.findUniqueOrThrow({ where: { id: r.id } });
    assert.equal(row.countState, 'REMOVED');
    assert.equal(row.countRemovalReason, 'UNPUBLISHED');
  });

  test('the star rating never affects counting', async () => {
    const u = await createUser();
    const [a1, a2] = await makeAnime(2);
    await makeReview(u.id, a1.id, { rating: 1 });
    await makeReview(u.id, a2.id, { rating: 10 });
    await runMaturationBatch();
    const rows = await prisma.review.findMany({ where: { userId: u.id } });
    assert.ok(rows.every((r) => r.countState === 'COUNTED'));
  });
});
