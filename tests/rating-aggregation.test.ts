import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import {
  submitUserRating,
  deleteUserRating,
  getRatingSummary,
  recalculateAnimeAggregates,
  validateRatingScore,
} from '../src/lib/rating/ratingService';
import { calculateBayesianScore, RATING_ALGORITHM_VERSION } from '../src/lib/rating/ratingEngine';
import { createAnime, createUser } from './helpers/fixtures';

after(async () => {
  await prisma.$disconnect();
});

async function currentGlobalAverage(): Promise<number> {
  const agg = await prisma.animeRating.aggregate({
    where: { deletedAt: null, rating: { gte: 0.5, lte: 10 } },
    _avg: { rating: true },
  });
  return agg._avg.rating !== null ? parseFloat(agg._avg.rating.toFixed(2)) : 7.5;
}

describe('validateRatingScore', () => {
  test('accepts 0.5-10.0 in 0.1 steps, rejects everything else', () => {
    assert.equal(validateRatingScore(7.5).valid, true);
    assert.equal(validateRatingScore(9.1).valid, true, '0.1 steps (2026-10-23)');
    assert.equal(validateRatingScore(1.2).valid, true);
    assert.equal(validateRatingScore(0.5).valid, true);
    assert.equal(validateRatingScore(10.0).valid, true);

    assert.equal(validateRatingScore(0.4).valid, false, 'below minimum');
    assert.equal(validateRatingScore(10.1).valid, false, 'above maximum');
    assert.equal(validateRatingScore(7.35).valid, false, 'not a 0.1 step');
    assert.equal(validateRatingScore(NaN).valid, false);
    assert.equal(validateRatingScore('7' as any).valid, false);
  });
});

describe('submitUserRating', () => {
  test('creates the rating, category scores, and a CREATED audit event, then recalculates aggregates', async () => {
    const user = await createUser();
    const anime = await createAnime();

    // Seed a platform-wide average well below this anime's rating, so the
    // Bayesian blend below is actually exercised (R != C) rather than
    // trivially passing because both sides of the formula are equal.
    const otherAnime = await createAnime();
    const otherUser = await createUser();
    await submitUserRating({ userId: otherUser.id, animeId: otherAnime.id, score: 3 });

    const result = await submitUserRating({
      userId: user.id,
      animeId: anime.id,
      score: 8,
      // DIRECTION is the retired aspect: ignored, not stored.
      categoryScores: { CHARACTERS: 9, WORLD_BUILDING: 7, DIRECTION: 4 },
    });
    assert.equal(result.rating, 8);
    // The global average recalculateAnimeAggregates() reads is queried
    // *after* this rating's own transaction has committed, so it already
    // includes this rating — mirror that ordering here rather than
    // snapshotting the average beforehand.
    const globalAvgAfter = await currentGlobalAverage();
    assert.notEqual(globalAvgAfter, 8, 'sanity check: R != C so the blend below is meaningful');

    const categoryRows = await prisma.ratingCategoryScore.findMany({ where: { ratingId: result.id } });
    assert.equal(categoryRows.length, 2);
    assert.deepEqual(
      categoryRows.map((c) => [c.category, c.score]).sort(),
      [['CHARACTERS', 9], ['WORLD_BUILDING', 7]].sort()
    );

    const events = await prisma.ratingEvent.findMany({ where: { animeId: anime.id, userId: user.id } });
    assert.equal(events.length, 1);
    assert.equal(events[0].eventType, 'CREATED');
    assert.equal(events[0].previousScore, null);
    assert.equal(events[0].newScore, 8);

    // The Bayesian score wired through recalculateAnimeAggregates must
    // match the documented formula: (v/(v+m))*R + (m/(v+m))*C, using the
    // platform-wide global average as queried above.
    const aggregate = await prisma.ratingAggregate.findUnique({ where: { animeId: anime.id } });
    const expectedBayesian = calculateBayesianScore(8, 1, globalAvgAfter, 25);
    assert.equal(aggregate?.bayesianScore, expectedBayesian);
    assert.equal(aggregate?.ratingCount, 1);
    assert.equal(aggregate?.rawAverage, 8);
    assert.equal(aggregate?.confidence, 'EARLY');
  });

  test('rating the same anime twice updates the one row and records an UPDATED event with the real previousScore', async () => {
    const user = await createUser();
    const anime = await createAnime();

    await submitUserRating({ userId: user.id, animeId: anime.id, score: 6 });
    await submitUserRating({ userId: user.id, animeId: anime.id, score: 9 });

    assert.equal(await prisma.animeRating.count({ where: { userId: user.id, animeId: anime.id } }), 1);

    const events = await prisma.ratingEvent.findMany({
      where: { animeId: anime.id, userId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    assert.equal(events.length, 2);
    assert.equal(events[0].eventType, 'CREATED');
    assert.equal(events[1].eventType, 'UPDATED');
    assert.equal(events[1].previousScore, 6);
    assert.equal(events[1].newScore, 9);

    const aggregate = await prisma.ratingAggregate.findUnique({ where: { animeId: anime.id } });
    assert.equal(aggregate?.ratingCount, 1, 'the update replaced the rating, not added a second one');
    assert.equal(aggregate?.rawAverage, 9);
  });

  test('a rating tracked in the user’s library updates UserAnime.score in the same transaction', async () => {
    const user = await createUser();
    const anime = await createAnime();
    await prisma.userAnime.create({ data: { userId: user.id, animeId: anime.id, status: 'COMPLETED' } });

    await submitUserRating({ userId: user.id, animeId: anime.id, score: 7.5 });

    const userAnime = await prisma.userAnime.findUnique({ where: { userId_animeId: { userId: user.id, animeId: anime.id } } });
    assert.equal(userAnime?.score, 7.5);
  });

  test('rejects an out-of-range or off-increment score without writing anything', async () => {
    const user = await createUser();
    const anime = await createAnime();

    await assert.rejects(submitUserRating({ userId: user.id, animeId: anime.id, score: 11 }));
    await assert.rejects(submitUserRating({ userId: user.id, animeId: anime.id, score: 7.35 }));
    assert.equal(await prisma.animeRating.count({ where: { userId: user.id, animeId: anime.id } }), 0);
  });
});

describe('deleteUserRating', () => {
  test('soft-deletes the rating, excludes it from the recalculated aggregate, and clears UserAnime.score', async () => {
    const user = await createUser();
    const anime = await createAnime();
    await prisma.userAnime.create({ data: { userId: user.id, animeId: anime.id, status: 'COMPLETED' } });
    await submitUserRating({ userId: user.id, animeId: anime.id, score: 8 });

    const result = await deleteUserRating(user.id, anime.id);
    assert.equal(result.success, true);

    const rating = await prisma.animeRating.findUnique({ where: { userId_animeId: { userId: user.id, animeId: anime.id } } });
    assert.ok(rating?.deletedAt instanceof Date, 'soft-deleted, not removed');

    const aggregate = await prisma.ratingAggregate.findUnique({ where: { animeId: anime.id } });
    assert.equal(aggregate?.ratingCount, 0);
    assert.equal(aggregate?.rawAverage, null);
    assert.equal(aggregate?.confidence, 'NO_DATA');

    const userAnime = await prisma.userAnime.findUnique({ where: { userId_animeId: { userId: user.id, animeId: anime.id } } });
    assert.equal(userAnime?.score, null);

    const deleteEvent = await prisma.ratingEvent.findFirst({ where: { animeId: anime.id, userId: user.id, eventType: 'DELETED' } });
    assert.equal(deleteEvent?.previousScore, 8);
  });

  test('deleting a rating that does not exist (or was already deleted) is a no-op, not an error', async () => {
    const user = await createUser();
    const anime = await createAnime();

    const first = await deleteUserRating(user.id, anime.id);
    assert.equal(first.success, false);

    await submitUserRating({ userId: user.id, animeId: anime.id, score: 5 });
    assert.equal((await deleteUserRating(user.id, anime.id)).success, true);
    assert.equal((await deleteUserRating(user.id, anime.id)).success, false, 'already deleted');
  });
});

describe('recalculateAnimeAggregates: category aggregation', () => {
  test('category averages and Hare-Niemeyer percentages sum to exactly 100', async () => {
    const anime = await createAnime();
    const [a, b, c] = await Promise.all([createUser(), createUser(), createUser()]);

    await submitUserRating({ userId: a.id, animeId: anime.id, score: 8, categoryScores: { CHARACTERS: 9, WORLD_BUILDING: 6, MUSIC: 7, DIRECTION: 3 } });
    await submitUserRating({ userId: b.id, animeId: anime.id, score: 7, categoryScores: { CHARACTERS: 8, WORLD_BUILDING: 5 } });
    await submitUserRating({ userId: c.id, animeId: anime.id, score: 6, categoryScores: { CHARACTERS: 7 } });

    const summary = await recalculateAnimeAggregates(anime.id);
    assert.equal(summary.categoryPercentageTotal, 100);

    assert.deepEqual(
      summary.categories.map((cat) => cat.category).sort(),
      ['CHARACTERS', 'MUSIC', 'WORLD_BUILDING'],
      'only the active aspects are reported (DIRECTION is retired)'
    );

    const story = summary.categories.find((cat) => cat.category === 'CHARACTERS');
    assert.equal(story?.responseCount, 3);
    assert.equal(story?.averageScore, 8); // (9 + 8 + 7) / 3

    const animation = summary.categories.find((cat) => cat.category === 'WORLD_BUILDING');
    assert.equal(animation?.responseCount, 2);
    assert.equal(animation?.averageScore, 5.5);

    const storedCategoryRows = await prisma.ratingCategoryAggregate.findMany({ where: { animeId: anime.id } });
    const storedStory = storedCategoryRows.find((r) => r.category === 'CHARACTERS');
    assert.equal(storedStory?.responseCount, 3);
    assert.equal(storedStory?.averageScore, 8);
  });
});

describe('getRatingSummary', () => {
  test('reuses the stored aggregate when it is current, and recomputes when missing or stale', async () => {
    const user = await createUser();
    const anime = await createAnime();
    await submitUserRating({ userId: user.id, animeId: anime.id, score: 8 });

    const fresh = await getRatingSummary(anime.id);
    assert.equal(fresh.ratingCount, 1);
    assert.equal(fresh.algorithmVersion, RATING_ALGORITHM_VERSION);

    // Stale algorithm version forces a recompute.
    await prisma.ratingAggregate.update({ where: { animeId: anime.id }, data: { algorithmVersion: 0 } });
    const afterStaleVersion = await getRatingSummary(anime.id);
    assert.equal(afterStaleVersion.algorithmVersion, RATING_ALGORITHM_VERSION);
    assert.equal(afterStaleVersion.ratingCount, 1);

    // A missing aggregate row also forces a recompute rather than 500ing.
    await prisma.ratingAggregate.delete({ where: { animeId: anime.id } });
    const afterMissing = await getRatingSummary(anime.id);
    assert.equal(afterMissing.ratingCount, 1);
    assert.ok(await prisma.ratingAggregate.findUnique({ where: { animeId: anime.id } }), 'recompute persists the aggregate again');
  });
});

describe('anti-abuse: rating velocity', () => {
  test('more than 15 rating submissions by one user within 5 minutes raises a VELOCITY_SPIKE signal', async () => {
    const user = await createUser();
    const anime = await createAnime();

    for (let i = 0; i < 16; i++) {
      await submitUserRating({ userId: user.id, animeId: anime.id, score: i % 2 === 0 ? 7 : 7.5 });
    }

    const signal = await prisma.ratingRiskSignal.findFirst({ where: { userId: user.id, signalType: 'VELOCITY_SPIKE' } });
    assert.ok(signal, 'a velocity spike signal is recorded once the 5-minute threshold is crossed');
    assert.equal(signal?.status, 'PENDING');
  });
});
