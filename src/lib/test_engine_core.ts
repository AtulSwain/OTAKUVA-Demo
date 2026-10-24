/**
 * OTAKUVA ENGINE CORE — Automated End-to-End Verification Test Suite
 * Validates the complete feedback loop:
 * User Action -> Event -> Tracking -> Episode Rating -> Review Intelligence ->
 * Community Opinion -> Taste Vector -> Trend Momentum -> Personalized Recommendation.
 */

import { prisma } from './prisma';
import {
  emitEngineEvent,
  updateWatchlistEntry,
  completeEpisode,
  rateEpisode,
  getEpisodeRatings,
  createAndAnalyzeReview,
  calculateUserTasteProfile,
  calculateAnimeTrends,
  getCategorizedTrends,
  getPersonalizedRecommendations,
  validateRatingVelocity,
  recalculateCommunityOpinion,
  ANIME_HISTORICAL_ERAS,
} from './engine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runEngineCoreTests() {
  console.log('======================================================');
  console.log('🧪 RUNNING OTAKUVA MASTER ENGINE CORE TEST SUITE');
  console.log('======================================================\n');

  // STEP 0: Seed test user and test anime
  const testUser = await prisma.user.upsert({
    where: { email: 'engine_tester@otakuva.com' },
    update: {},
    create: {
      username: 'EngineTester',
      email: 'engine_tester@otakuva.com',
      passwordHash: 'seeded_hash_123',
    },
  });

  // Clean up prior test state for idempotent runs
  await prisma.userEpisodeProgress.deleteMany({ where: { userId: testUser.id } });
  await prisma.userAnime.deleteMany({ where: { userId: testUser.id } });
  await prisma.episodeRating.deleteMany({ where: { userId: testUser.id } });
  await prisma.review.deleteMany({ where: { userId: testUser.id } });

  const testAnime = await prisma.anime.upsert({
    where: { slug: 'monster-engine-test' },
    update: {},
    create: {
      slug: 'monster-engine-test',
      canonicalTitle: 'Monster (Engine Test)',
      synopsis: 'A neurosurgeon uncovers a psychopathic conspiracy.',
      type: 'TV',
      episodes: 3,
      status: 'FINISHED',
      year: 2004,
      score: 9.1,
      posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
    },
  });

  // Ensure Genre and Studio relations exist
  const psychGenre = await prisma.genre.upsert({
    where: { name: 'Psychological' },
    update: {},
    create: { name: 'Psychological', slug: 'psychological' },
  });

  await prisma.animeGenre.upsert({
    where: {
      animeId_genreId: {
        animeId: testAnime.id,
        genreId: psychGenre.id,
      },
    },
    update: {},
    create: {
      animeId: testAnime.id,
      genreId: psychGenre.id,
    },
  });

  const madhouseStudio = await prisma.studio.upsert({
    where: { name: 'Madhouse' },
    update: {},
    create: { name: 'Madhouse', slug: 'madhouse' },
  });

  await prisma.animeStudio.upsert({
    where: {
      animeId_studioId: {
        animeId: testAnime.id,
        studioId: madhouseStudio.id,
      },
    },
    update: {},
    create: {
      animeId: testAnime.id,
      studioId: madhouseStudio.id,
    },
  });

  // --- TEST 1: Event Engine ---
  console.log('\n--- TEST 1: Standardized Event Engine ---');
  const event = await emitEngineEvent({
    eventType: 'ANIME_BOOKMARKED',
    userId: testUser.id,
    entityType: 'ANIME',
    entityId: testAnime.id,
    metadata: { testKey: 'testValue' },
  });

  assert(Boolean(event.id), `Event emitted and recorded in EventLog with ID: ${event.id}`);
  assert(event.eventType === 'ANIME_BOOKMARKED', 'Event type matches ANIME_BOOKMARKED');
  assert(event.userId === testUser.id, 'Event userId matches tester ID');

  // --- TEST 2: Watch Engine ---
  console.log('\n--- TEST 2: Watch Engine Tracking & Episode Progress ---');
  const watchlistEntry = await updateWatchlistEntry({
    userId: testUser.id,
    animeId: testAnime.id,
    status: 'WATCHING',
  });
  assert(watchlistEntry.status === 'WATCHING', 'Watchlist status set to WATCHING');

  const ep1 = await completeEpisode({
    userId: testUser.id,
    animeId: testAnime.id,
    episodeNumber: 1,
  });
  assert(Boolean(ep1.epProgress.id), 'Episode 1 marked completed');
  assert(ep1.totalCompleted === 1, 'Total completed episodes = 1');
  assert(ep1.isFullyCompleted === false, 'Anime is not yet fully completed');

  // Complete remaining episodes (2 and 3 of 3)
  await completeEpisode({ userId: testUser.id, animeId: testAnime.id, episodeNumber: 2 });
  const ep3 = await completeEpisode({ userId: testUser.id, animeId: testAnime.id, episodeNumber: 3 });
  assert(ep3.isFullyCompleted === true, 'Anime automatically marks completed when all 3 episodes completed');
  assert(ep3.userAnime.status === 'COMPLETED', 'UserAnime status transitioned to COMPLETED');

  // --- TEST 3: Episode Rating Engine ---
  console.log('\n--- TEST 3: Per-Episode Rating & Micro-Review Engine ---');
  const ratedEp = await rateEpisode({
    userId: testUser.id,
    animeId: testAnime.id,
    episodeNumber: 1,
    rating: 9.5,
    review: 'Magnificent narrative tension and cinematography!',
  });
  assert(ratedEp.score === 9.5, 'Episode rating recorded as 9.5');
  assert(ratedEp.note === 'Magnificent narrative tension and cinematography!', 'Episode micro-review saved');

  const epRatings = await getEpisodeRatings(testAnime.id, 1);
  assert(epRatings.totalRatings >= 1, 'Retrieved episode ratings list');
  assert(epRatings.averageScore !== null && epRatings.averageScore >= 9.0, 'Episode average score computed');

  // --- TEST 4: Review Intelligence & Community Opinion ---
  console.log('\n--- TEST 4: Review Intelligence & Aspect Extraction ---');
  const reviewResult = await createAndAnalyzeReview({
    userId: testUser.id,
    animeId: testAnime.id,
    title: 'A Psychological Masterpiece',
    body: 'The story was brilliant and gripping with incredible twists. The animation was fluid and detailed. However, the pacing dragged slightly in the middle.',
    rating: 9,
  });
  assert(Boolean(reviewResult.review.id), 'Review created in database');
  assert(reviewResult.extractedAspects.length >= 2, `Extracted ${reviewResult.extractedAspects.length} structured aspects from review`);

  const storyAspect = reviewResult.extractedAspects.find((a) => a.aspect === 'STORY');
  assert(storyAspect?.sentiment === 'POSITIVE', 'Story aspect extracted as POSITIVE sentiment');

  const pacingAspect = reviewResult.extractedAspects.find((a) => a.aspect === 'PACING');
  assert(pacingAspect?.sentiment === 'NEGATIVE', 'Pacing aspect extracted as NEGATIVE sentiment');

  // Recalculate and verify Community Opinion
  const opinion = await recalculateCommunityOpinion(testAnime.id);
  assert(opinion !== null, 'Community Opinion generated and stored');
  assert(opinion!.storyScore !== null && opinion!.storyScore >= 7.0, 'Story score calculated in Community Opinion');
  assert(opinion!.positivePercentage >= 50.0, 'Positive percentage computed');

  // --- TEST 5: User Taste Engine ---
  console.log('\n--- TEST 5: User Taste Profile Engine ---');
  const taste = await calculateUserTasteProfile(testUser.id);
  assert(taste.userId === testUser.id, 'User taste profile generated');
  assert(taste.genres['Psychological'] !== undefined, 'Psychological genre affinity captured in taste profile');
  assert(taste.studios['Madhouse'] !== undefined, 'Madhouse studio affinity captured in taste profile');
  assert(taste.topGenres.length > 0, `Top genre identified: ${taste.topGenres[0]}`);

  // --- TEST 6: Trend & Momentum Engine ---
  console.log('\n--- TEST 6: Trend & Momentum Engine ---');
  const trends = await calculateAnimeTrends();
  assert(trends.length > 0, 'Trend metrics computed across active titles');

  const categorized = await getCategorizedTrends();
  assert(Array.isArray(categorized.popular), 'Popular list available');
  assert(Array.isArray(categorized.trending), 'Trending list available');
  assert(Array.isArray(categorized.rising), 'Rising list available');

  // --- TEST 7: Recommendation Engine ---
  console.log('\n--- TEST 7: Recommendation Engine & Explanations ---');
  // Seed a candidate anime that user hasn't watched
  const candidateAnime = await prisma.anime.upsert({
    where: { slug: 'death-note-rec-test' },
    update: {},
    create: {
      slug: 'death-note-rec-test',
      canonicalTitle: 'Death Note (Rec Test)',
      synopsis: 'A psychological battle of wits.',
      type: 'TV',
      episodes: 37,
      score: 9.0,
      posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=800',
    },
  });

  await prisma.animeGenre.upsert({
    where: {
      animeId_genreId: {
        animeId: candidateAnime.id,
        genreId: psychGenre.id,
      },
    },
    update: {},
    create: {
      animeId: candidateAnime.id,
      genreId: psychGenre.id,
    },
  });

  await prisma.animeStudio.upsert({
    where: {
      animeId_studioId: {
        animeId: candidateAnime.id,
        studioId: madhouseStudio.id,
      },
    },
    update: {},
    create: {
      animeId: candidateAnime.id,
      studioId: madhouseStudio.id,
    },
  });

  const recs = await getPersonalizedRecommendations(testUser.id, 5);
  assert(recs.items.length > 0, `Generated ${recs.items.length} personalized recommendations`);
  assert(recs.items.every((r) => r.id !== testAnime.id), 'Excluded completed anime from recommendations');

  const topRec = recs.items.find((r) => r.id === candidateAnime.id);
  if (topRec) {
    assert(Boolean(topRec.explanation), `Recommendation explanation: "${topRec.explanation}"`);
  }

  // --- TEST 8: Culture & History Eras ---
  console.log('\n--- TEST 8: Culture & Historical Eras ---');
  assert(ANIME_HISTORICAL_ERAS.length === 6, 'All 6 historical eras structured');
  assert(ANIME_HISTORICAL_ERAS[0].name.includes('Early Animation'), 'Early animation era present');

  // --- TEST 9: Trust & Safety Engine ---
  console.log('\n--- TEST 9: Trust & Safety Velocity Check ---');
  const safetyCheck = await validateRatingVelocity(testUser.id);
  assert(safetyCheck.allowed === true, 'Standard rating frequency is permitted');
  assert(safetyCheck.riskScore === 0.0, 'Risk score is 0 for normal activity');

  console.log('\n======================================================');
  console.log('🎉 ALL OTAKUVA ENGINE CORE TESTS PASSED SUCCESSFULLY!');
  console.log('======================================================\n');
}

runEngineCoreTests()
  .catch((err) => {
    console.error('Engine test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
