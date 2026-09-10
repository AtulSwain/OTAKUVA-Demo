/**
 * Comprehensive Test Suite for OTAKUVA Proprietary Rating Engine
 * 
 * Verifies:
 * 1. Pure mathematical statistical functions (Mean, Median, Variance, Standard Deviation, Confidence)
 * 2. Bayesian Score weighting formula across sample sizes
 * 3. Hare-Niemeyer largest-remainder category percentage normalizer (Strictly 100% sum)
 * 4. 10-Bucket rating distribution calculation
 * 5. Input score validation and precision rounding
 * 6. End-to-end database lifecycle: submit rating -> category scores -> audit event -> aggregates recalculation -> update -> soft delete
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
  CATEGORY_EXPLANATION_TEXT,
  RATING_CATEGORIES,
} from './rating/ratingEngine';
import {
  validateRatingScore,
  submitUserRating,
  getUserRating,
  getRatingSummary,
  deleteUserRating,
  recalculateAnimeAggregates,
} from './rating/ratingService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

async function runTestSuite() {
  console.log('\n======================================================');
  console.log('🧪 RUNNING OTAKUVA RATING ENGINE COMPREHENSIVE TEST SUITE');
  console.log('======================================================\n');

  // TEST 1: Pure Mathematical Functions
  console.log('--- TEST 1: Pure Mathematical Statistical Functions ---');
  const sampleScores = [8.0, 9.0, 9.0, 10.0];
  const mean = calculateRawAverage(sampleScores);
  assert(mean === 9.0, `Raw average of [8,9,9,10] is 9.0 (got ${mean})`);

  const medianEven = calculateMedian([7.0, 8.0, 9.0, 10.0]);
  assert(medianEven === 8.5, `Median of even set [7,8,9,10] is 8.5 (got ${medianEven})`);

  const medianOdd = calculateMedian([6.0, 8.0, 9.0]);
  assert(medianOdd === 8.0, `Median of odd set [6,8,9] is 8.0 (got ${medianOdd})`);

  const variance = calculateVariance([8.0, 9.0, 10.0]);
  assert(variance === 1.0, `Sample variance of [8,9,10] is 1.0 (got ${variance})`);

  const stdDev = calculateStandardDeviation(variance);
  assert(stdDev === 1.0, `Standard deviation of variance 1.0 is 1.0 (got ${stdDev})`);

  // TEST 2: Confidence Classification
  console.log('\n--- TEST 2: Confidence Level Classification ---');
  assert(calculateConfidence(0) === 'NO_DATA', '0 ratings classified as NO_DATA');
  assert(calculateConfidence(5) === 'EARLY', '5 ratings classified as EARLY');
  assert(calculateConfidence(25) === 'LOW', '25 ratings classified as LOW');
  assert(calculateConfidence(100) === 'MEDIUM', '100 ratings classified as MEDIUM');
  assert(calculateConfidence(500) === 'HIGH', '500 ratings classified as HIGH');

  // TEST 3: Bayesian Score Calculation
  console.log('\n--- TEST 3: Bayesian Score Calculation ---');
  // Formula: S = (v / (v + m)) * R + (m / (v + m)) * C
  // v = 25, m = 25, R = 9.0, C = 7.0 -> 0.5 * 9.0 + 0.5 * 7.0 = 8.0
  const bayes1 = calculateBayesianScore(9.0, 25, 7.0, 25);
  assert(bayes1 === 8.0, `Bayesian score for v=25, R=9.0, C=7.0, m=25 is 8.0 (got ${bayes1})`);

  // v = 100, m = 25, R = 9.0, C = 7.0 -> (100/125)*9.0 + (25/125)*7.0 = 7.2 + 1.4 = 8.6
  const bayes2 = calculateBayesianScore(9.0, 100, 7.0, 25);
  assert(bayes2 === 8.6, `Bayesian score for v=100, R=9.0, C=7.0, m=25 is 8.6 (got ${bayes2})`);

  // TEST 4: Largest-Remainder Hare-Niemeyer Normalizer (Strictly 100% total)
  console.log('\n--- TEST 4: Largest-Remainder Category Percentage Normalization (100% Total) ---');
  const catAverages = [
    { category: 'STORY' as const, average: 9.1 },
    { category: 'CHARACTERS' as const, average: 8.4 },
    { category: 'ANIMATION' as const, average: 8.9 },
    { category: 'DIRECTION' as const, average: 9.3 },
    { category: 'MUSIC' as const, average: 7.8 },
    { category: 'ENJOYMENT' as const, average: 8.7 },
  ];
  const percentages = calculateCategoryPercentages(catAverages);
  const totalPercentage = percentages.reduce((sum, item) => sum + item.percentage, 0);
  assert(totalPercentage === 100, `Category percentages sum to exactly 100% (got ${totalPercentage}%)`);
  assert(percentages.length === 6, 'All 6 categories normalized');
  percentages.forEach((p) => {
    console.log(`    - ${p.category}: ${p.percentage}%`);
  });

  // Edge case: prime fractions that easily produce rounding drift (99% or 101%) without largest-remainder
  const awkwardAverages = [
    { category: 'STORY' as const, average: 3.33 },
    { category: 'CHARACTERS' as const, average: 3.33 },
    { category: 'ANIMATION' as const, average: 3.34 },
  ];
  const awkwardPercentages = calculateCategoryPercentages(awkwardAverages as any);
  const awkwardTotal = awkwardPercentages.reduce((sum, item) => sum + item.percentage, 0);
  assert(awkwardTotal === 100, `Awkward fractions normalized to exactly 100% (got ${awkwardTotal}%)`);

  // TEST 5: 10-Bucket Rating Distribution
  console.log('\n--- TEST 5: 10-Bucket Distribution ---');
  const distScores = [10, 10, 9, 9, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const distribution = calculateDistribution(distScores);
  assert(distribution[10].count === 2, 'Score 10 count is 2');
  assert(distribution[9].count === 3, 'Score 9 count is 3');
  assert(distribution[1].count === 1, 'Score 1 count is 1');
  const distCountTotal = Object.values(distribution).reduce((sum, d) => sum + d.count, 0);
  assert(distCountTotal === distScores.length, `Distribution count total matches input length (${distCountTotal})`);

  // TEST 6: Validation & Precision
  console.log('\n--- TEST 6: Input Score Validation & Normalization ---');
  assert(validateRatingScore(8.7).valid === true, 'Score 8.7 is valid');
  assert(validateRatingScore(8.74).normalized === 8.7, 'Score 8.74 is normalized to 8.7');
  assert(validateRatingScore(0.5).valid === false, 'Score 0.5 is invalid (<1.0)');
  assert(validateRatingScore(10.5).valid === false, 'Score 10.5 is invalid (>10.0)');
  assert(validateRatingScore(NaN).valid === false, 'Score NaN is invalid');

  // TEST 7: End-to-End Database Lifecycle
  console.log('\n--- TEST 7: End-to-End Database Rating Lifecycle ---');
  
  // 1. Create or ensure test user & test anime
  let testUser = await prisma.user.findFirst({ where: { email: 'rating_test_user@otakuva.internal' } });
  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        username: 'RatingTester',
        email: 'rating_test_user@otakuva.internal',
        passwordHash: 'dummy_hash',
      },
    });
  }

  let testAnime = await prisma.anime.findFirst({ where: { slug: 'test-rating-engine-anime' } });
  if (!testAnime) {
    testAnime = await prisma.anime.create({
      data: {
        slug: 'test-rating-engine-anime',
        canonicalTitle: 'Test Rating Engine Anime',
        synopsis: 'A test anime for verifying the OTAKUVA proprietary rating engine.',
        posterUrl: 'https://example.com/poster.jpg',
      },
    });
  }

  // 2. Submit a full rating with all 6 categories
  console.log('Submitting initial rating...');
  const ratingRes = await submitUserRating({
    userId: testUser.id,
    animeId: testAnime.id,
    score: 9.3,
    categoryScores: {
      STORY: 9.5,
      CHARACTERS: 9.0,
      ANIMATION: 9.5,
      DIRECTION: 9.0,
      MUSIC: 8.5,
      ENJOYMENT: 9.5,
    },
  });
  assert(ratingRes.rating === 9.3, `Submitted rating is 9.3 (got ${ratingRes.rating})`);

  // 3. Verify user rating retrieval
  const retrievedUserRating = await getUserRating(testUser.id, testAnime.id);
  assert(retrievedUserRating.hasRated === true, 'User rating hasRated is true');
  assert(retrievedUserRating.yourRating === 9.3, 'User overall rating matches 9.3');
  assert((retrievedUserRating.yourCategoryRatings as any)?.STORY === 9.5, 'User Story category rating is 9.5');

  // 4. Verify canonical summary calculation
  const summary = await getRatingSummary(testAnime.id);
  assert(summary.ratingCount >= 1, `Rating count is >= 1 (got ${summary.ratingCount})`);
  assert(typeof summary.score === 'number', `Bayesian score computed (got ${summary.score})`);
  assert(summary.categories.length === 6, `Summary has 6 categories (got ${summary.categories.length})`);
  assert(summary.categoryPercentageTotal === 100, `Category percentage total is strictly 100%`);
  assert(summary.explanatoryNote === CATEGORY_EXPLANATION_TEXT, 'Explanatory note included in summary');

  // 5. Verify audit event was created
  const latestEvent = await prisma.ratingEvent.findFirst({
    where: { userId: testUser.id, animeId: testAnime.id },
    orderBy: { createdAt: 'desc' },
  });
  assert(latestEvent !== null, 'Rating audit event recorded');
  assert(latestEvent?.newScore === 9.3, `Audit event newScore is 9.3 (got ${latestEvent?.newScore})`);

  // 6. Update rating score
  console.log('Updating user rating...');
  await submitUserRating({
    userId: testUser.id,
    animeId: testAnime.id,
    score: 8.7,
  });
  const updatedUserRating = await getUserRating(testUser.id, testAnime.id);
  assert(updatedUserRating.yourRating === 8.7, `Updated rating is 8.7 (got ${updatedUserRating.yourRating})`);

  // 7. Delete user rating
  console.log('Deleting user rating (soft delete)...');
  const deleteRes = await deleteUserRating(testUser.id, testAnime.id);
  assert(deleteRes.success === true, 'Rating deleted successfully');

  const afterDeleteUserRating = await getUserRating(testUser.id, testAnime.id);
  assert(afterDeleteUserRating.hasRated === false, 'After delete, hasRated is false');

  console.log('\n======================================================');
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runTestSuite()
  .catch((err) => {
    console.error('Test suite error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
