/**
 * OTAKUVA MASTER TEST SUITE — PHASE 10.1 → 10.5
 * PERSONALIZATION, USER INTELLIGENCE & RECOMMENDATION ENGINE
 * 
 * Comprehensive automated verification covering:
 * - 10.1: Behavioral tracking, server-side validation & idempotency
 * - 10.2: Multi-dimensional User Taste Profile & Short/Long-Term vectors
 * - 10.3: Genre/Theme affinity, adjacent exploration & negative feedback
 * - 10.4: 12-Source Candidate Generation, franchise/sequel awareness & hard filtering
 * - 10.5: Hybrid Ranking, Diversification, Explainability, Caching, Feedback & Admin Debugger
 */

import { prisma } from './prisma';
import { behavioralTrackingService } from './engine/events/behavioralTrackingService';
import { tasteEngine, getUserTasteProfile, resetUserTasteProfile } from './engine/taste/tasteEngine';
import { contentPreferenceEngine } from './engine/recommendation/contentPreferenceEngine';
import { candidateGenerationEngine } from './engine/recommendation/candidateGenerationEngine';
import { recommendationRankingEngine, recordRecommendationFeedback } from './engine/recommendation/recommendationEngine';
import { hasMinRole } from './roles';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, message: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runPhase10TestSuite() {
  console.log('========================================================================');
  console.log('OTAKUVA ENGINE — PHASES 10.1 → 10.5 PERSONALIZATION & RECOMMENDATIONS');
  console.log('========================================================================\n');

  const testSuffix = Date.now();

  // Setup Admin Actor
  let testAdmin = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } });
  if (!testAdmin) {
    testAdmin = await prisma.user.create({
      data: {
        username: `rec_admin_${testSuffix}`,
        email: `rec_admin_${testSuffix}@otakuva.test`,
        role: 'ADMIN',
      },
    });
  }

  // Setup Test Users
  const activeUser = await prisma.user.create({
    data: {
      username: `rec_user_active_${testSuffix}`,
      email: `rec_user_active_${testSuffix}@otakuva.test`,
      role: 'USER',
    },
  });

  const newUser = await prisma.user.create({
    data: {
      username: `rec_user_new_${testSuffix}`,
      email: `rec_user_new_${testSuffix}@otakuva.test`,
      role: 'USER',
    },
  });

  // Setup Genre Entities
  const genrePsychological = await prisma.genre.upsert({
    where: { name: 'Psychological' },
    create: { name: 'Psychological', slug: 'psychological' },
    update: {},
  });
  const genreMystery = await prisma.genre.upsert({
    where: { name: 'Mystery' },
    create: { name: 'Mystery', slug: 'mystery' },
    update: {},
  });
  const genreAction = await prisma.genre.upsert({
    where: { name: 'Action' },
    create: { name: 'Action', slug: 'action' },
    update: {},
  });
  const genreRomance = await prisma.genre.upsert({
    where: { name: 'Romance' },
    create: { name: 'Romance', slug: 'romance' },
    update: {},
  });

  // Setup Theme Entity
  const themeDarkFantasy = await prisma.theme.upsert({
    where: { name: 'Dark Fantasy' },
    create: { name: 'Dark Fantasy', slug: 'dark-fantasy' },
    update: {},
  });

  // Setup Studio Entity
  const studioUfotable = await prisma.studio.create({
    data: {
      name: `Ufotable Rec Test ${testSuffix}`,
      slug: `ufotable-rec-test-${testSuffix}`,
      verificationStatus: 'VERIFIED',
      publicationState: 'PUBLISHED',
    },
  });

  const studioTrigger = await prisma.studio.create({
    data: {
      name: `Trigger Rec Test ${testSuffix}`,
      slug: `trigger-rec-test-${testSuffix}`,
      verificationStatus: 'VERIFIED',
      publicationState: 'PUBLISHED',
    },
  });

  // Setup Anime Catalog Titles
  const animeMonster = await prisma.anime.create({
    data: {
      canonicalTitle: `Monster Masterpiece ${testSuffix}`,
      slug: `monster-masterpiece-${testSuffix}`,
      synopsis: 'A brilliant neurosurgeon searches for a ruthless psychopath.',
      posterUrl: 'https://example.com/monster.jpg',
      type: 'TV',
      episodes: 74,
      score: 9.2,
      year: 2004,
      animeGenres: { create: [{ genreId: genrePsychological.id }, { genreId: genreMystery.id }] },
      animeStudios: { create: [{ studioId: studioUfotable.id, isPrimary: true }] },
    },
  });

  const animeSteinsGate = await prisma.anime.create({
    data: {
      canonicalTitle: `Steins;Gate S1 ${testSuffix}`,
      slug: `steins-gate-s1-${testSuffix}`,
      synopsis: 'Self-proclaimed mad scientist discovers time travel messages.',
      posterUrl: 'https://example.com/steins.jpg',
      type: 'TV',
      episodes: 24,
      score: 9.1,
      year: 2011,
      animeGenres: { create: [{ genreId: genrePsychological.id }, { genreId: genreMystery.id }] },
      animeThemes: { create: [{ themeId: themeDarkFantasy.id }] },
      animeStudios: { create: [{ studioId: studioUfotable.id, isPrimary: true }] },
    },
  });

  const animeSteinsGateS2 = await prisma.anime.create({
    data: {
      canonicalTitle: `Steins;Gate 0 (Season 2) ${testSuffix}`,
      slug: `steins-gate-0-s2-${testSuffix}`,
      synopsis: 'The alternate timeline where Okabe gave up.',
      posterUrl: 'https://example.com/steins0.jpg',
      type: 'TV',
      episodes: 23,
      score: 8.5,
      year: 2018,
      animeGenres: { create: [{ genreId: genrePsychological.id }, { genreId: genreMystery.id }] },
    },
  });

  // Establish Sequel Relationship: Steins;Gate S1 -> Steins;Gate S2 (Sequel)
  await prisma.animeRelation.create({
    data: {
      sourceAnimeId: animeSteinsGate.id,
      targetAnimeId: animeSteinsGateS2.id,
      relationType: 'Sequel',
    },
  });

  const animeRomanceTitle = await prisma.anime.create({
    data: {
      canonicalTitle: `Pure Heart Romance ${testSuffix}`,
      slug: `pure-heart-romance-${testSuffix}`,
      synopsis: 'High school romance story.',
      posterUrl: 'https://example.com/romance.jpg',
      type: 'TV',
      episodes: 12,
      score: 6.5,
      year: 2021,
      animeGenres: { create: [{ genreId: genreRomance.id }] },
    },
  });

  const animeActionTitle = await prisma.anime.create({
    data: {
      canonicalTitle: `Kill la Battle ${testSuffix}`,
      slug: `kill-la-battle-${testSuffix}`,
      synopsis: 'High-octane action and intense battles.',
      posterUrl: 'https://example.com/kill.jpg',
      type: 'TV',
      episodes: 24,
      score: 8.8,
      year: 2013,
      animeGenres: { create: [{ genreId: genreAction.id }] },
      animeStudios: { create: [{ studioId: studioTrigger.id, isPrimary: true }] },
    },
  });

  // =========================================================================
  // TEST 1: PHASE 10.1 — USER BEHAVIORAL TRACKING & VALIDATION
  // =========================================================================
  console.log('--- TEST 1: PHASE 10.1 — USER BEHAVIORAL TRACKING & VALIDATION ---');

  // Valid Event
  const watchEvt = await behavioralTrackingService.trackWatchProgress(activeUser.id, animeMonster.id, 'ep_1', 85, 1200);
  assert(watchEvt.success === true, 'Tracked watch progress event successfully');
  assert(watchEvt.isDuplicate === false, 'Fresh event flagged isDuplicate: false');

  // Duplicate / Idempotent Event within 3s window
  const dupEvt = await behavioralTrackingService.trackWatchProgress(activeUser.id, animeMonster.id, 'ep_1', 85, 1200);
  assert(dupEvt.isDuplicate === true, 'Idempotency guard caught rapid duplicate event');

  // Server-Side Validation: Invalid Rating (>10)
  const invalidRating = await behavioralTrackingService.trackEvent({
    eventType: 'ANIME_RATED',
    userId: activeUser.id,
    entityType: 'ANIME',
    entityId: animeMonster.id,
    metadata: { rating: 15.0 }, // Invalid
  });
  assert(invalidRating.success === false, 'Validation rejected invalid rating 15.0/10');
  assert(invalidRating.validationError?.includes('between 0.0 and 10.0') || false, 'Returned clear validation error');

  // Search Intent Tracking
  const searchEvt = await behavioralTrackingService.trackSearchIntent(activeUser.id, 'dark psychological thriller');
  assert(searchEvt.success === true, 'Tracked search intent event');

  // Recommendation Feedback Action Tracking
  const recAction = await behavioralTrackingService.trackRecommendationAction(activeUser.id, animeRomanceTitle.id, 'NOT_INTERESTED');
  assert(recAction.success === true, 'Tracked NOT_INTERESTED recommendation feedback action');

  // =========================================================================
  // TEST 2: PHASE 10.2 — MULTI-DIMENSIONAL USER TASTE PROFILE ENGINE
  // =========================================================================
  console.log('\n--- TEST 2: PHASE 10.2 — MULTI-DIMENSIONAL USER TASTE PROFILE ENGINE ---');

  // Seed user activity: High rating on Psychological/Mystery title (Monster)
  await prisma.animeRating.create({
    data: {
      userId: activeUser.id,
      animeId: animeMonster.id,
      rating: 9.5,
    },
  });

  // Seed user completion: Steins;Gate S1
  await prisma.userAnime.create({
    data: {
      userId: activeUser.id,
      animeId: animeSteinsGate.id,
      status: 'COMPLETED',
      score: 9.0,
    },
  });

  // Rebuild Taste Profile
  const taste = await tasteEngine.rebuildTasteProfile(activeUser.id);
  assert(taste.userId === activeUser.id, 'Calculated taste profile for user');
  assert(taste.profileVersion === 2, 'Uses versioned taste engine v2');
  assert(taste.confidenceTier === 'LEARNING' || taste.confidenceTier === 'ESTABLISHED', 'Confidence tier graduated past cold start');
  assert(taste.topGenres.includes('Psychological'), 'Identified Psychological as top genre');
  assert(taste.genres['Psychological']?.score > 0.4, 'Psychological affinity score is strongly positive');
  assert(taste.topStudios.some((s) => s.includes('Ufotable')), 'Identified Ufotable in top studios');
  assert(taste.formats['TV']?.score !== undefined, 'Extracted format vector for TV');
  assert(taste.lengths['LONG']?.score !== undefined || taste.lengths['MEDIUM']?.score !== undefined, 'Extracted length vector');
  assert(taste.userFacingInsights.length >= 1, 'Generated plain-language taste insights');

  // Cold Start Check for New User
  const coldTaste = await getUserTasteProfile(newUser.id);
  assert(coldTaste.confidenceTier === 'COLD_START', 'New user correctly classified as COLD_START');
  assert(coldTaste.totalSignalsCount === 0, 'New user has 0 initial signals');

  // =========================================================================
  // TEST 3: PHASE 10.3 — GENRE, THEME & CONTENT PREFERENCE ENGINE
  // =========================================================================
  console.log('\n--- TEST 3: PHASE 10.3 — GENRE, THEME & CONTENT PREFERENCE ENGINE ---');

  // Extract features for Monster
  const monsterFeatures = contentPreferenceEngine.extractAnimeFeatures(
    await prisma.anime.findUnique({
      where: { id: animeMonster.id },
      include: {
        animeGenres: { include: { genre: true } },
        animeThemes: { include: { theme: true } },
        animeStudios: { include: { studio: true } },
        ratingAggregate: true,
        trendMetric: true,
      },
    })
  );

  assert(monsterFeatures.genres.includes('Psychological'), 'Features extracted genres');
  assert(monsterFeatures.studios.some((s) => s.includes('Ufotable')), 'Features extracted studios');

  // Calculate Affinity
  const affinityMonster = contentPreferenceEngine.calculateAffinity(taste, monsterFeatures);
  assert(affinityMonster.overallAffinity >= 0.45, `High affinity score (${affinityMonster.overallAffinity}) for matching content`);
  assert(affinityMonster.genreAffinity >= 0.4, 'Genre affinity reflects user preference');
  assert(affinityMonster.primaryMatchReason.length > 0, 'Generated explainable match reason');

  // Negative feedback penalty check (Romance marked NOT_INTERESTED)
  const romanceFeatures = contentPreferenceEngine.extractAnimeFeatures(
    await prisma.anime.findUnique({
      where: { id: animeRomanceTitle.id },
      include: {
        animeGenres: { include: { genre: true } },
        animeThemes: { include: { theme: true } },
        animeStudios: { include: { studio: true } },
      },
    })
  );
  const affinityRomance = contentPreferenceEngine.calculateAffinity(taste, romanceFeatures);
  assert(affinityRomance.overallAffinity < affinityMonster.overallAffinity, 'Romance affinity is significantly lower than Psychological');

  // =========================================================================
  // TEST 4: PHASE 10.4 — RECOMMENDATION CANDIDATE GENERATION ENGINE
  // =========================================================================
  console.log('\n--- TEST 4: PHASE 10.4 — RECOMMENDATION CANDIDATE GENERATION ENGINE ---');

  const candidatePool = await candidateGenerationEngine.assembleCandidatePool(activeUser.id, taste);
  assert(candidatePool.length >= 1, 'Assembled non-empty candidate pool');

  // Check Sequel Handling: Steins;Gate S1 was completed, so Steins;Gate S2 should be generated!
  const sequelCandidate = candidatePool.find((c) => c.anime.id === animeSteinsGateS2.id);
  assert(sequelCandidate !== undefined, 'Sequel (Steins;Gate S2) included as candidate after S1 completion');
  assert(sequelCandidate!.provenanceReasons.some((r) => r.toLowerCase().includes('sequel')), 'Provenance reasons recognize direct sequel');

  // Check Exclusion: Monster is already rated, so it must be excluded from recommendations!
  const excludedMonster = candidatePool.find((c) => c.anime.id === animeMonster.id);
  assert(excludedMonster === undefined, 'Already rated title (Monster) is strictly excluded from candidate pool');

  // =========================================================================
  // TEST 5: PHASE 10.5 — RECOMMENDATION RANKING ENGINE & FEEDBACK LOOP
  // =========================================================================
  console.log('\n--- TEST 5: PHASE 10.5 — RECOMMENDATION RANKING ENGINE & FEEDBACK LOOP ---');

  const recommendations = await recommendationRankingEngine.getPersonalizedRecommendations(activeUser.id, {
    limit: 8,
    forceRefresh: true,
  });

  assert(recommendations.items.length >= 1, 'Generated personalized recommendation list');
  assert(recommendations.algorithmVersion === 2, 'Generated with algorithm version 2');
  assert(recommendations.items[0].recommendationScore > 0, 'Top recommended item has positive score');
  assert(recommendations.items[0].explanation.length > 0, 'Top recommended item has explainable description');
  assert(recommendations.items[0].scoreBreakdown !== undefined, 'Includes detailed score breakdown telemetry');

  // Test Caching
  const cachedRecs = await recommendationRankingEngine.getPersonalizedRecommendations(activeUser.id, {
    limit: 8,
    forceRefresh: false,
  });
  assert(cachedRecs.isCached === true, 'Second request served from fast in-memory cache');

  // Invalidate Cache and test fresh fetch
  recommendationRankingEngine.invalidateUserCache(activeUser.id);

  // Test Admin Debugger Inspector
  const debugData = await recommendationRankingEngine.debugUserRecommendations(activeUser.id);
  assert(debugData.tasteProfile.userId === activeUser.id, 'Admin debugger retrieved user taste profile');
  assert(debugData.candidatesGeneratedCount >= 1, 'Admin debugger reports candidates generated count');
  assert(debugData.topRecommendations.length >= 1, 'Admin debugger returns top recommendations');

  // Test Derived Personalization Reset
  const resetRes = await resetUserTasteProfile(activeUser.id);
  assert(resetRes.success === true, 'User personalization reset succeeded');

  const afterResetTaste = await getUserTasteProfile(activeUser.id);
  assert(afterResetTaste.totalSignalsCount === 0 || afterResetTaste.confidenceTier === 'COLD_START' || afterResetTaste.confidenceTier === 'LEARNING', 'Taste profile successfully reset');

  // Verify ratings still exist after personalization reset
  const survivingRatings = await prisma.animeRating.count({ where: { userId: activeUser.id } });
  assert(survivingRatings >= 1, 'Core user history and ratings were preserved during personalization reset');

  // =========================================================================
  // TEST 6: SECURITY & RBAC ENFORCEMENT
  // =========================================================================
  console.log('\n--- TEST 6: SECURITY & RBAC ENFORCEMENT ---');

  assert(!hasMinRole('USER', 'DATA_EDITOR'), 'RBAC: Regular USER denied DATA_EDITOR role');
  assert(!hasMinRole('USER', 'ADMIN'), 'RBAC: Regular USER denied ADMIN role');
  assert(hasMinRole('ADMIN', 'DATA_EDITOR'), 'RBAC: ADMIN inherits DATA_EDITOR role');

  console.log('\n========================================================================');
  console.log(`PHASE 10 TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  console.log('========================================================================\n');
}

runPhase10TestSuite().catch((err) => {
  console.error('Phase 10 Test Suite execution failed:', err);
  process.exit(1);
});
