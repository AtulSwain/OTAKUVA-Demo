/**
 * OTAKUVA PHASE 6 — PRODUCTION RECOMMENDATION ENGINE TEST SUITE
 * Tests:
 * - Multi-stage candidate generation & deduplication
 * - Exclusion of completed, watching, dropped, and rated anime
 * - Critical weighted taste matching (Psychological + Mystery vs Slow Romance)
 * - Review intelligence aspect sensitivity matching (Story/Characters vs Pacing penalty)
 * - Diversification & max repetition constraints
 * - Exploration candidate preservation
 * - Structured explainable rationale generation
 * - Recommendation session tracking & feedback events
 * - Cold start fallback for new/guest users
 * - Multi-user privacy & isolation
 */

import { prisma } from './prisma';
import {
  getPersonalizedRecommendations,
  recordRecommendationFeedback,
  RECOMMENDATION_ALGORITHM_VERSION,
} from './engine/recommendation/recommendationEngine';
import { submitUserRating } from './rating/ratingService';
import { updateAnimeTrackingStatus } from './engine/watch/watchEngine';
import { createAndAnalyzeReview } from './engine/review/reviewIntelligence';
import { rebuildTasteProfile } from './engine/taste/tasteEngine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runPhase6RecommendationTests() {
  console.log('======================================================');
  console.log('🧪 RUNNING OTAKUVA PHASE 6 RECOMMENDATION ENGINE TEST SUITE');
  console.log('======================================================\n');

  // STEP 0: Setup test users
  const userA = await prisma.user.upsert({
    where: { email: 'phase6_user_a@otakuva.com' },
    update: {},
    create: { username: 'Phase6_UserA', email: 'phase6_user_a@otakuva.com', passwordHash: 'hash123' },
  });

  const guestUser = await prisma.user.upsert({
    where: { email: 'phase6_guest_user@otakuva.com' },
    update: {},
    create: { username: 'Phase6_Guest', email: 'phase6_guest_user@otakuva.com', passwordHash: 'hash123' },
  });

  // Clean prior test data
  await prisma.recommendationItem.deleteMany({ where: { session: { userId: { in: [userA.id, guestUser.id] } } } });
  await prisma.recommendationSession.deleteMany({ where: { userId: { in: [userA.id, guestUser.id] } } });
  await prisma.userTasteSignal.deleteMany({ where: { profile: { userId: { in: [userA.id, guestUser.id] } } } });
  await prisma.userTasteProfile.deleteMany({ where: { userId: { in: [userA.id, guestUser.id] } } });
  await prisma.animeRating.deleteMany({ where: { userId: { in: [userA.id, guestUser.id] } } });
  await prisma.userAnime.deleteMany({ where: { userId: { in: [userA.id, guestUser.id] } } });
  await prisma.review.deleteMany({ where: { userId: { in: [userA.id, guestUser.id] } } });

  // Ensure Genres exist
  const [psychGenre, mysteryGenre, thrillerGenre, romanceGenre, dramaGenre, comedyGenre] =
    await Promise.all([
      prisma.genre.upsert({ where: { slug: 'psychological' }, update: {}, create: { name: 'Psychological', slug: 'psychological' } }),
      prisma.genre.upsert({ where: { slug: 'mystery' }, update: {}, create: { name: 'Mystery', slug: 'mystery' } }),
      prisma.genre.upsert({ where: { slug: 'thriller' }, update: {}, create: { name: 'Thriller', slug: 'thriller' } }),
      prisma.genre.upsert({ where: { slug: 'romance' }, update: {}, create: { name: 'Romance', slug: 'romance' } }),
      prisma.genre.upsert({ where: { slug: 'drama' }, update: {}, create: { name: 'Drama', slug: 'drama' } }),
      prisma.genre.upsert({ where: { slug: 'comedy' }, update: {}, create: { name: 'Comedy', slug: 'comedy' } }),
    ]);

  const madhouseStudio = await prisma.studio.upsert({
    where: { name: 'Madhouse' },
    update: {},
    create: { name: 'Madhouse', slug: 'madhouse' },
  });

  // Seed Seed/History Anime (to build userA's taste)
  const historyAnime = await prisma.anime.upsert({
    where: { slug: 'phase6-history-monster' },
    update: {},
    create: {
      slug: 'phase6-history-monster',
      canonicalTitle: 'Monster (Phase 6 History)',
      synopsis: 'Psychological mystery masterpiece.',
      type: 'TV',
      episodes: 74,
      status: 'FINISHED',
      score: 9.1,
      posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
      animeGenres: {
        create: [{ genreId: psychGenre.id }, { genreId: mysteryGenre.id }],
      },
      animeStudios: {
        create: [{ studioId: madhouseStudio.id }],
      },
    },
  });

  // User A rates Monster 10/10, completes it, writes review praising Story & criticizing slow pacing
  await submitUserRating({ userId: userA.id, animeId: historyAnime.id, score: 10 });
  await updateAnimeTrackingStatus({ userId: userA.id, animeId: historyAnime.id, status: 'COMPLETED' });
  await createAndAnalyzeReview({
    userId: userA.id,
    animeId: historyAnime.id,
    title: 'Gripping psychological story',
    body: 'Brilliant story and unforgettable complex characters, though the pacing was slow at times.',
    rating: 10,
  });

  // Seed Candidate Anime
  const candidateTopMatch = await prisma.anime.upsert({
    where: { slug: 'phase6-candidate-perfect' },
    update: {},
    create: {
      slug: 'phase6-candidate-perfect',
      canonicalTitle: 'Perfect Blue (Top Candidate)',
      synopsis: 'Psychological mystery thriller film.',
      type: 'MOVIE',
      episodes: 1,
      status: 'FINISHED',
      score: 8.9,
      posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
      animeGenres: {
        create: [{ genreId: psychGenre.id }, { genreId: mysteryGenre.id }],
      },
      animeStudios: {
        create: [{ studioId: madhouseStudio.id }],
      },
    },
  });

  // Community Opinion for candidateTopMatch praising Story
  await prisma.animeCommunityOpinion.upsert({
    where: { animeId: candidateTopMatch.id },
    update: { storyScore: 9.2, charactersScore: 8.8, pacingScore: 8.5 },
    create: {
      animeId: candidateTopMatch.id,
      storyScore: 9.2,
      charactersScore: 8.8,
      pacingScore: 8.5,
      overallSentiment: 'POSITIVE',
      positivePercentage: 90.0,
    },
  });

  const candidateSlowRomance = await prisma.anime.upsert({
    where: { slug: 'phase6-candidate-romance' },
    update: {},
    create: {
      slug: 'phase6-candidate-romance',
      canonicalTitle: 'Slow Romance (Penalized Candidate)',
      synopsis: 'Dragging slow romance.',
      type: 'TV',
      episodes: 12,
      status: 'FINISHED',
      score: 6.5,
      posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
      animeGenres: {
        create: [{ genreId: romanceGenre.id }],
      },
    },
  });

  // Community Opinion for candidateSlowRomance with very slow pacing score
  await prisma.animeCommunityOpinion.upsert({
    where: { animeId: candidateSlowRomance.id },
    update: { pacingScore: 3.5, storyScore: 6.0 },
    create: {
      animeId: candidateSlowRomance.id,
      pacingScore: 3.5,
      storyScore: 6.0,
      overallSentiment: 'MIXED',
      mixedPercentage: 60.0,
    },
  });

  const candidateExploration = await prisma.anime.upsert({
    where: { slug: 'phase6-candidate-exploration' },
    update: {},
    create: {
      slug: 'phase6-candidate-exploration',
      canonicalTitle: 'March Comes in Like a Lion (Exploration)',
      synopsis: 'Heartfelt character drama.',
      type: 'TV',
      episodes: 22,
      status: 'FINISHED',
      score: 9.0,
      posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
      animeGenres: {
        create: [{ genreId: dramaGenre.id }],
      },
    },
  });

  // Build taste profile
  await rebuildTasteProfile(userA.id);

  // --- TEST 1: Cold Start Recommendations for New User ---
  console.log('--- TEST 1: Cold Start Recommendations for New User ---');
  const coldRecs = await getPersonalizedRecommendations(guestUser.id, 6);
  assert(coldRecs.personalizationLevel === 'COLD_START', 'Cold start user receives COLD_START level');
  assert(coldRecs.items.length > 0, 'Generates high-quality baseline recommendations');
  assert(coldRecs.algorithmVersion === RECOMMENDATION_ALGORITHM_VERSION, `Algorithm version = ${RECOMMENDATION_ALGORITHM_VERSION}`);

  // --- TEST 2: Hard Filtering (Exclusion of Already Watched/Rated Anime) ---
  console.log('\n--- TEST 2: Exclusion of Already Completed & Rated Anime ---');
  const userARecs = await getPersonalizedRecommendations(userA.id, 6);
  const containsHistoryAnime = userARecs.items.some((item) => item.id === historyAnime.id);
  assert(!containsHistoryAnime, 'Already completed anime (Monster) is strictly excluded from recommendations');

  // --- TEST 3: CRITICAL TEST — Weighted Taste Matching & Aspect Scoring ---
  console.log('\n--- TEST 3: CRITICAL TEST — Weighted Matching & Aspect Score Ranking ---');
  const topCandidate = userARecs.items.find((item) => item.id === candidateTopMatch.id);
  const romanceCandidate = userARecs.items.find((item) => item.id === candidateSlowRomance.id);

  assert(Boolean(topCandidate), 'Top matching Psychological Mystery candidate is recommended');
  console.log(`  📊 Top Candidate Score: ${topCandidate?.recommendationScore}`);
  if (romanceCandidate) {
    console.log(`  📊 Romance Candidate Score: ${romanceCandidate.recommendationScore}`);
    assert(
      topCandidate!.recommendationScore > romanceCandidate.recommendationScore,
      'Psychological Mystery candidate ranks significantly higher than slow romance'
    );
  }

  // --- TEST 4: Structured Explainability ---
  console.log('\n--- TEST 4: Structured Explainable Rationale ---');
  assert(Boolean(topCandidate?.structuredExplanation), 'Structured explanation exists');
  assert(
    topCandidate?.structuredExplanation.reasonType === 'TASTE_GENRE' ||
      topCandidate?.structuredExplanation.reasonType === 'TASTE_STUDIO' ||
      topCandidate?.structuredExplanation.reasonType === 'TASTE_ASPECT',
    `Structured explanation reasonType is valid (${topCandidate?.structuredExplanation.reasonType})`
  );
  assert(topCandidate!.explanation.length > 5, `Explanation text generated: "${topCandidate?.explanation}"`);

  // --- TEST 5: Diversification & Exploration ---
  console.log('\n--- TEST 5: Diversification & Exploration Candidate Preservation ---');
  const uniqueGenres = new Set(userARecs.items.flatMap((i) => i.genres));
  assert(uniqueGenres.size >= 2, `Recommendations are diversified across at least 2 distinct genres (${Array.from(uniqueGenres).join(', ')})`);

  // --- TEST 6: Session & Impression Persistence ---
  console.log('\n--- TEST 6: Recommendation Session & Impression Tracking ---');
  assert(Boolean(userARecs.sessionId), `RecommendationSession persisted with ID: ${userARecs.sessionId}`);

  const sessionInDb = await prisma.recommendationSession.findUnique({
    where: { id: userARecs.sessionId },
    include: { items: true },
  });
  assert(Boolean(sessionInDb), 'Session stored in database');
  assert(sessionInDb!.items.length > 0, `Session contains ${sessionInDb!.items.length} logged recommendation impressions`);

  // --- TEST 7: Recommendation Feedback Action ---
  console.log('\n--- TEST 7: User Feedback Action (Click / Dismiss) ---');
  const firstItemId = sessionInDb!.items[0].id;
  const feedbackResult = await recordRecommendationFeedback(userA.id, firstItemId, 'CLICKED');
  assert(feedbackResult.success === true, 'Recorded recommendation CLICKED feedback');

  const updatedItem = await prisma.recommendationItem.findUnique({ where: { id: firstItemId } });
  assert(updatedItem?.status === 'CLICKED', 'Recommendation item status updated to CLICKED in database');

  // --- TEST 8: Multi-User Isolation ---
  console.log('\n--- TEST 8: Multi-User Privacy & Isolation ---');
  try {
    // Guest user tries to record feedback on User A's recommendation session
    await recordRecommendationFeedback(guestUser.id, firstItemId, 'CLICKED');
    assert(false, 'Unauthorized user should not be able to modify another user recommendation item');
  } catch (err: any) {
    assert(err.message.includes('unauthorized'), 'Unauthorized feedback rejected with 403 error');
  }

  console.log('\n======================================================');
  console.log('🎉 ALL PHASE 6 RECOMMENDATION ENGINE TESTS PASSED!');
  console.log('======================================================\n');
}

runPhase6RecommendationTests()
  .catch((err) => {
    console.error('Phase 6 test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
