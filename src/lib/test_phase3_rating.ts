/**
 * OTAKUVA PHASE 3 — PRODUCTION RATING ENGINE TEST SUITE
 * Rigorous automated testing covering:
 * - Mathematical functions (Mean, Median, Variance, StdDev, Bayesian Score, 10-bucket distribution, Hare-Niemeyer category normalization)
 * - Episode rating creation, editing, and deletion
 * - Anime rating creation, editing, deletion, and aspect score tracking
 * - Multi-user statistical aggregation updates (Create, Update, Delete)
 * - Anti-manipulation velocity checks and audit logging
 * - Multi-account privacy and input validation
 */

import { prisma } from './prisma';
import {
  calculateRawAverage,
  calculateMedian,
  calculateVariance,
  calculateStandardDeviation,
  calculateConfidence,
  calculateBayesianScore,
  calculateDistribution,
  calculateCategoryPercentages,
  RATING_ALGORITHM_VERSION,
} from './rating/ratingEngine';
import {
  submitUserRating,
  deleteUserRating,
  getUserRating,
  getAnimeRatingSummary,
  recalculateAnimeAggregates,
  validateRatingScore,
} from './rating/ratingService';
import {
  rateEpisode,
  deleteEpisodeRating,
  getEpisodeRatings,
  getUserEpisodeRating,
} from './engine/rating/episodeRating';
import { validateRatingVelocity } from './engine/safety/trustSafetyEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runPhase3RatingTests() {
  console.log('======================================================');
  console.log('🧪 RUNNING OTAKUVA PHASE 3 PRODUCTION RATING TEST SUITE');
  console.log('======================================================\n');

  // --- TEST 1: Pure Mathematical Functions ---
  console.log('--- TEST 1: Pure Mathematical & Statistical Functions ---');
  const scores = [8.0, 9.0, 9.0, 10.0];
  const mean = calculateRawAverage(scores);
  assert(mean === 9.0, `Raw average of [8, 9, 9, 10] is 9.0 (got ${mean})`);

  const medianEven = calculateMedian([7.0, 8.0, 9.0, 10.0]);
  assert(medianEven === 8.5, `Median of [7, 8, 9, 10] is 8.5 (got ${medianEven})`);

  const medianOdd = calculateMedian([6.0, 8.0, 9.0]);
  assert(medianOdd === 8.0, `Median of [6, 8, 9] is 8.0 (got ${medianOdd})`);

  const variance = calculateVariance([8.0, 9.0, 10.0], 9.0);
  assert(variance === 1.0, `Sample variance is 1.0 (got ${variance})`);

  const stdDev = calculateStandardDeviation(1.0);
  assert(stdDev === 1.0, `Standard deviation of variance 1.0 is 1.0 (got ${stdDev})`);

  // Confidence tiers
  assert(calculateConfidence(0) === 'NO_DATA', '0 ratings -> NO_DATA');
  assert(calculateConfidence(5) === 'EARLY', '5 ratings -> EARLY');
  assert(calculateConfidence(25) === 'LOW', '25 ratings -> LOW');
  assert(calculateConfidence(100) === 'MEDIUM', '100 ratings -> MEDIUM');
  assert(calculateConfidence(500) === 'HIGH', '500 ratings -> HIGH');

  // Bayesian Adjusted Score (v=25, R=9.0, C=7.0, m=25 -> 8.0)
  const bayes = calculateBayesianScore(9.0, 25, 7.0, 25);
  assert(bayes === 8.0, `Bayesian score is 8.0 (got ${bayes})`);

  // Hare-Niemeyer Category Normalization (Strictly 100%)
  const catAverages = [
    { category: 'STORY' as any, average: 9.2 },
    { category: 'CHARACTERS' as any, average: 8.8 },
    { category: 'ANIMATION' as any, average: 9.0 },
    { category: 'DIRECTION' as any, average: 9.5 },
    { category: 'MUSIC' as any, average: 8.0 },
    { category: 'ENJOYMENT' as any, average: 9.1 },
  ];
  const catSummary = calculateCategoryPercentages(catAverages);
  const totalPercent = catSummary.reduce((sum, c) => sum + c.percentage, 0);
  assert(totalPercent === 100, `Category percentage shares sum to exactly 100% (got ${totalPercent}%)`);

  // Distribution buckets (1-10)
  const dist = calculateDistribution([10.0, 10.0, 9.0, 8.0, 7.0, 1.0]);
  assert(dist[10].count === 2, 'Bucket 10 count is 2');
  assert(dist[9].count === 1, 'Bucket 9 count is 1');
  assert(dist[1].count === 1, 'Bucket 1 count is 1');

  // Input score validation
  assert(validateRatingScore(8.7).valid === true, 'Score 8.7 is valid');
  assert(validateRatingScore(8.74).normalized === 8.7, 'Score 8.74 rounds to 8.7');
  assert(validateRatingScore(-1).valid === false, 'Score -1 is rejected');
  assert(validateRatingScore(11).valid === false, 'Score 11 is rejected');
  assert(validateRatingScore(NaN).valid === false, 'Score NaN is rejected');

  // --- SETUP USERS & ANIME FOR DATABASE TESTS ---
  console.log('\n--- SETUP: Seeding Test Users & Anime ---');
  const user1 = await prisma.user.upsert({
    where: { email: 'phase3_user1@otakuva.com' },
    update: {},
    create: { username: 'Phase3_U1', email: 'phase3_user1@otakuva.com', passwordHash: 'hash123' },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'phase3_user2@otakuva.com' },
    update: {},
    create: { username: 'Phase3_U2', email: 'phase3_user2@otakuva.com', passwordHash: 'hash123' },
  });

  const user3 = await prisma.user.upsert({
    where: { email: 'phase3_user3@otakuva.com' },
    update: {},
    create: { username: 'Phase3_U3', email: 'phase3_user3@otakuva.com', passwordHash: 'hash123' },
  });

  const testAnime = await prisma.anime.upsert({
    where: { slug: 'phase3-rating-test-anime' },
    update: {},
    create: {
      slug: 'phase3-rating-test-anime',
      canonicalTitle: 'Fullmetal Alchemist: Brotherhood Test',
      synopsis: 'Two brothers search for the Philosophers Stone.',
      type: 'TV',
      episodes: 64,
      status: 'FINISHED',
      score: 9.3,
      posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
    },
  });

  // Clean prior test state
  await prisma.episodeRating.deleteMany({ where: { userId: { in: [user1.id, user2.id, user3.id] } } });
  await prisma.animeRating.deleteMany({ where: { userId: { in: [user1.id, user2.id, user3.id] } } });

  // --- TEST 2: Per-Episode Rating Lifecycle (Create, Edit, Delete) ---
  console.log('\n--- TEST 2: Per-Episode Rating Lifecycle (Create, Edit, Delete) ---');
  // 1. User 1 rates Episode 1
  const epRating1 = await rateEpisode({
    userId: user1.id,
    animeId: testAnime.id,
    episodeNumber: 1,
    rating: 9.5,
    review: 'Incredible pilot episode setting the stage!',
  });
  assert(epRating1.score === 9.5, 'Episode rating recorded as 9.5');
  assert(epRating1.note === 'Incredible pilot episode setting the stage!', 'Micro-review saved');

  // 2. User 1 edits Episode 1 rating to 9.0
  const epRatingEdited = await rateEpisode({
    userId: user1.id,
    animeId: testAnime.id,
    episodeNumber: 1,
    rating: 9.0,
    review: 'Revised review: Still amazing upon re-watch.',
  });
  assert(epRatingEdited.score === 9.0, 'Episode rating edited to 9.0');

  // Verify only 1 active rating row exists for User 1 + Episode 1
  const allUser1Ep1 = await prisma.episodeRating.findMany({
    // Keyed by anime + episode number since 2026-10-19 (episodeId is optional).
    where: { userId: user1.id, animeId: testAnime.id, episodeNumber: epRatingEdited.episodeNumber },
  });
  assert(allUser1Ep1.length === 1, 'Only 1 active episode rating record exists per user');

  // 3. User 2 rates Episode 1
  await rateEpisode({
    userId: user2.id,
    animeId: testAnime.id,
    episodeNumber: 1,
    rating: 8.0,
  });

  // 4. Retrieve episode ratings summary
  const epSummary = await getEpisodeRatings(testAnime.id, 1);
  assert(epSummary.totalRatings === 2, 'Episode 1 has 2 total ratings');
  assert(epSummary.averageScore === 8.5, 'Episode 1 average score is 8.5 ((9.0 + 8.0) / 2)');

  // 5. Delete episode rating
  const epDelete = await deleteEpisodeRating(user2.id, testAnime.id, 1);
  assert(epDelete.success === true, 'User 2 deleted episode rating');
  const epSummaryAfterDelete = await getEpisodeRatings(testAnime.id, 1);
  assert(epSummaryAfterDelete.totalRatings === 1, 'Episode 1 total ratings reduced to 1');
  assert(epSummaryAfterDelete.averageScore === 9.0, 'Episode 1 average updated to 9.0');

  // --- TEST 3: Anime Rating & Aspect Scores (Create, Update, Delete) ---
  console.log('\n--- TEST 3: Anime Rating & Aspect Scores (Create, Update, Delete) ---');
  // 1. User 1 submits anime rating with aspect scores
  await submitUserRating({
    userId: user1.id,
    animeId: testAnime.id,
    score: 9.6,
    categoryScores: {
      STORY: 9.8,
      CHARACTERS: 9.5,
      ANIMATION: 9.2,
      DIRECTION: 9.4,
      MUSIC: 9.7,
      ENJOYMENT: 9.9,
    },
  });

  const u1Rating = await getUserRating(user1.id, testAnime.id);
  assert(u1Rating.hasRated === true, 'User 1 hasRated = true');
  assert(u1Rating.yourRating === 9.6, 'User 1 overall rating is 9.6');
  assert((u1Rating.yourCategoryRatings as any).STORY === 9.8, 'Story aspect rating is 9.8');
  assert((u1Rating.yourCategoryRatings as any).MUSIC === 9.7, 'Music aspect rating is 9.7');

  // 2. User 1 edits rating to 9.2
  await submitUserRating({
    userId: user1.id,
    animeId: testAnime.id,
    score: 9.2,
  });
  const u1Edited = await getUserRating(user1.id, testAnime.id);
  assert(u1Edited.yourRating === 9.2, 'User 1 rating successfully updated to 9.2');

  // 3. User 2 and User 3 submit ratings
  await submitUserRating({
    userId: user2.id,
    animeId: testAnime.id,
    score: 8.8,
  });
  await submitUserRating({
    userId: user3.id,
    animeId: testAnime.id,
    score: 9.0,
  });

  // 4. Check global anime rating summary & Bayesian score
  const animeSummary = await getAnimeRatingSummary(testAnime.id);
  assert(animeSummary.ratingCount >= 3, `Rating count is ${animeSummary.ratingCount}`);
  assert(animeSummary.rawAverage !== null, `Raw average calculated: ${animeSummary.rawAverage}`);
  assert(animeSummary.score !== null, `OTAKUVA Bayesian Score calculated: ${animeSummary.score}`);
  assert(animeSummary.algorithmVersion === RATING_ALGORITHM_VERSION, `Algorithm version is ${RATING_ALGORITHM_VERSION}`);
  assert(animeSummary.categories.length === 6, 'All 6 category aspects represented');
  assert(animeSummary.categoryPercentageTotal === 100, 'Aspect percentage shares sum to 100%');

  // 5. User 3 deletes rating
  await deleteUserRating(user3.id, testAnime.id);
  const u3AfterDelete = await getUserRating(user3.id, testAnime.id);
  assert(u3AfterDelete.hasRated === false, 'User 3 rating removed (hasRated = false)');

  const summaryAfterDelete = await getAnimeRatingSummary(testAnime.id);
  assert(
    summaryAfterDelete.ratingCount === animeSummary.ratingCount - 1,
    'Global rating count decremented after rating deletion'
  );

  // --- TEST 4: Anti-Manipulation Velocity Validation ---
  console.log('\n--- TEST 4: Anti-Manipulation Velocity Validation ---');
  const velocityCheck = await validateRatingVelocity(user1.id);
  assert(velocityCheck.allowed === true, 'Normal rating velocity is allowed');
  assert(velocityCheck.riskScore === 0, 'Risk score is 0 for normal user activity');

  // --- TEST 5: Event Log Verification ---
  console.log('\n--- TEST 5: Standardized Rating Event Log Verification ---');
  const events = await prisma.eventLog.findMany({
    where: { userId: user1.id },
    orderBy: { createdAt: 'desc' },
  });
  const eventTypes = events.map((e) => e.eventType);
  assert(eventTypes.includes('EPISODE_RATED'), 'EventLog contains EPISODE_RATED');
  assert(eventTypes.includes('RATING_CREATED'), 'EventLog contains RATING_CREATED');
  assert(eventTypes.includes('RATING_UPDATED'), 'EventLog contains RATING_UPDATED');

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 3 PRODUCTION RATING TESTS PASSED!');
  console.log('======================================================\n');
}

runPhase3RatingTests()
  .catch((err) => {
    console.error('Phase 3 test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
