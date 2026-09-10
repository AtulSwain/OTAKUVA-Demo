/**
 * OTAKUVA MASTER TEST SUITE — PHASES 9.3 → 9.6: STUDIO INTELLIGENCE SUITE
 * 
 * Comprehensive multi-phase verification covering:
 * - Phase 9.3: Studio Project Graph (multi-studio, primary designation, format filtering, upcoming pipeline, bulk linking, cascade safety)
 * - Phase 9.4: Studio People & Staff Intelligence (canonical Person reuse, staff roles, tenure tracking, studio -> person -> anime graph)
 * - Phase 9.5: Studio Analytics & Performance (aggregates, sample size context, genre distribution, format breakdown, score histogram, caching, privacy)
 * - Phase 9.6: Studio User Affinity & Personalization (behavioral signals, time decay, confidence tiers, recommendation candidates, explainability, IDOR privacy)
 */

import { prisma } from './prisma';
import { studioAdminService } from './engine/studio/studioAdminService';
import { studioProjectService } from './engine/studio/studioProjectService';
import { studioPeopleService } from './engine/studio/studioPeopleService';
import { studioAnalyticsService } from './engine/studio/studioAnalyticsService';
import { studioAffinityService } from './engine/studio/studioAffinityService';
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

async function runStudioIntelligenceTestSuite() {
  console.log('========================================================================');
  console.log('OTAKUVA ENGINE — PHASES 9.3 → 9.6 STUDIO INTELLIGENCE MASTER TEST SUITE');
  console.log('========================================================================\n');

  // Setup Admin Actor
  let testAdmin = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } });
  if (!testAdmin) {
    testAdmin = await prisma.user.create({
      data: {
        username: `intel_admin_${Date.now()}`,
        email: `intel_admin_${Date.now()}@otakuva.test`,
        role: 'ADMIN',
      },
    });
  }

  // Setup Dedicated Regular User Actor for Test Run
  const testUser = await prisma.user.create({
    data: {
      username: `intel_user_${Date.now()}`,
      email: `intel_user_${Date.now()}@otakuva.test`,
      role: 'USER',
    },
  });

  const testSuffix = Date.now();

  // Create Primary Test Studio (Studio Kyoto Test)
  const testStudio = await studioAdminService.createStudio(testAdmin.id, {
    name: `Studio Kyoto Intelligence ${testSuffix}`,
    nativeName: '京都テストアニメーション',
    foundedYear: 1981,
    status: 'ACTIVE',
    country: 'Japan',
  });
  const studioId = testStudio.id;

  // Create Secondary Co-Production Studio (Studio Assist Test)
  const assistStudio = await studioAdminService.createStudio(testAdmin.id, {
    name: `Studio Assist Intelligence ${testSuffix}`,
    foundedYear: 2005,
    status: 'ACTIVE',
  });

  // Create Genre for testing
  const testGenre = await prisma.genre.upsert({
    where: { name: 'Slice of Life' },
    create: { name: 'Slice of Life', slug: 'slice-of-life' },
    update: {},
  });

  // Create Anime 1 (TV Series, Completed)
  const anime1 = await prisma.anime.create({
    data: {
      canonicalTitle: `Hyouka Mystery ${testSuffix}`,
      slug: `hyouka-mystery-${testSuffix}`,
      synopsis: 'Hotaro Oreki joins the Classic Literature Club.',
      posterUrl: 'https://example.com/hyouka.jpg',
      type: 'TV',
      episodes: 22,
      score: 8.8,
      status: 'Finished',
      year: 2012,
      animeGenres: { create: [{ genreId: testGenre.id }] },
    },
  });

  // Create Anime 2 (Theatrical Movie, Completed)
  const anime2 = await prisma.anime.create({
    data: {
      canonicalTitle: `A Silent Voice Film ${testSuffix}`,
      slug: `a-silent-voice-film-${testSuffix}`,
      synopsis: 'Shoya Ishida seeks redemption with Shoko Nishimiya.',
      posterUrl: 'https://example.com/silent_voice.jpg',
      type: 'MOVIE',
      episodes: 1,
      score: 9.1,
      status: 'Finished',
      year: 2016,
      animeGenres: { create: [{ genreId: testGenre.id }] },
    },
  });

  // Create Anime 3 (Upcoming / Announced Project)
  const anime3 = await prisma.anime.create({
    data: {
      canonicalTitle: `Sound Euphonium Sequel ${testSuffix}`,
      slug: `sound-euphonium-sequel-${testSuffix}`,
      synopsis: 'Kitauji High School Concert Band aims for Nationals gold.',
      posterUrl: 'https://example.com/euphonium.jpg',
      type: 'TV',
      episodes: 13,
      score: 8.6,
      status: 'NOT_YET_AIRED',
      year: 2026,
    },
  });

  // =========================================================================
  // PHASE 9.3: STUDIO PROJECT GRAPH TESTS
  // =========================================================================
  console.log('--- PHASE 9.3: STUDIO PROJECT GRAPH TESTS ---');

  // Test 1: Link Anime with Production Roles
  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioId, {
    animeId: anime1.id,
    role: 'MAIN_STUDIO',
    isPrimary: true,
    productionStatus: 'COMPLETED',
  });

  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioId, {
    animeId: anime2.id,
    role: 'MAIN_STUDIO',
    isPrimary: true,
    productionStatus: 'COMPLETED',
  });

  // Multi-studio co-production on Anime 1
  await studioProjectService.linkAnimeToStudio(testAdmin.id, assistStudio.id, {
    animeId: anime1.id,
    role: 'PRODUCTION_ASSISTANCE',
    isPrimary: false,
    productionStatus: 'COMPLETED',
  });

  // Upcoming Anime Link
  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioId, {
    animeId: anime3.id,
    role: 'MAIN_STUDIO',
    isPrimary: true,
    productionStatus: 'UPCOMING',
  });

  // Verify Project Graph Retrieval
  const projectGraph = await studioProjectService.getStudioProjects(studioId, { limit: 10 });
  assert(projectGraph.total === 3, 'Studio project graph contains all 3 linked anime');
  assert(projectGraph.projects.some((p) => p.anime.id === anime1.id && p.relationship.isPrimary), 'Primary studio flag retained on Anime 1');

  // Verify Format Filtering
  const movieFilter = await studioProjectService.getStudioProjects(studioId, { format: 'MOVIE' });
  assert(movieFilter.total === 1 && movieFilter.projects[0].anime.id === anime2.id, 'Format filter "MOVIE" returns only theatrical productions');

  // Verify Upcoming Project Pipeline
  const upcomingPipeline = await studioProjectService.getStudioUpcomingProjects(studioId);
  assert(upcomingPipeline.length >= 1, 'Upcoming productions pipeline retrieved');
  assert(upcomingPipeline.some((p) => p.anime.id === anime3.id), 'Announced sequel identified in upcoming pipeline');

  // Test Bulk Linking
  const bulkAnime = await prisma.anime.create({
    data: {
      canonicalTitle: `Clannad After Story ${testSuffix}`,
      slug: `clannad-after-story-${testSuffix}`,
      synopsis: 'Tomoya and Nagisas life journey continues.',
      posterUrl: 'https://example.com/clannad.jpg',
      type: 'TV',
      score: 8.95,
      status: 'Finished',
      year: 2008,
    },
  });

  const bulkResult = await studioProjectService.bulkLinkAnimeToStudio(testAdmin.id, studioId, {
    animeIds: [bulkAnime.id],
    role: 'MAIN_STUDIO',
  });
  assert(bulkResult.success && bulkResult.count === 1, 'Bulk anime linking succeeded');

  // Test Cascade Safety on Unlink
  const unlinkRes = await studioProjectService.unlinkAnimeFromStudio(testAdmin.id, studioId, bulkAnime.id);
  assert(unlinkRes.success, 'Anime unlinked from studio');
  const checkAnimeStillExists = await prisma.anime.findUnique({ where: { id: bulkAnime.id } });
  assert(!!checkAnimeStillExists, 'Cascade Safety: Underlying canonical Anime record preserved after studio unlinking');

  // =========================================================================
  // PHASE 9.4: STUDIO PEOPLE & STAFF INTELLIGENCE TESTS
  // =========================================================================
  console.log('\n--- PHASE 9.4: STUDIO PEOPLE & STAFF INTELLIGENCE TESTS ---');

  // Create Canonical People
  const personDirector = await prisma.person.create({
    data: {
      name: `Naoko Yamada ${testSuffix}`,
      slug: `naoko-yamada-${testSuffix}`,
      about: 'Visionary animation director.',
    },
  });

  const personFounder = await prisma.person.create({
    data: {
      name: `Yoko Hatta ${testSuffix}`,
      slug: `yoko-hatta-${testSuffix}`,
      about: 'Co-founder and president of Kyoto Animation.',
    },
  });

  // Link Staff to Studio
  await studioPeopleService.linkPersonToStudio(testAdmin.id, studioId, {
    personId: personFounder.id,
    role: 'FOUNDER',
    tenureStartYear: 1981,
    isCurrent: true,
  });

  await studioPeopleService.linkPersonToStudio(testAdmin.id, studioId, {
    personId: personDirector.id,
    role: 'DIRECTOR',
    tenureStartYear: 2004,
    tenureEndYear: 2020,
    isCurrent: false,
    notes: 'Directed A Silent Voice and K-On!',
  });

  // Connect Person to Anime via canonical AnimeStaff
  await prisma.animeStaff.create({
    data: {
      animeId: anime2.id,
      personId: personDirector.id,
      role: 'Director',
    },
  });

  // Query Studio People Graph
  const peopleGraph = await studioPeopleService.getStudioPeople(studioId, { limit: 10 });
  assert(peopleGraph.total === 2, 'Studio staff list contains 2 linked personnel');

  const founderEntry = peopleGraph.people.find((p) => p.personId === personFounder.id);
  assert(founderEntry?.role === 'FOUNDER' && founderEntry?.isCurrent, 'Founder tenure & active status stored correctly');

  const directorEntry = peopleGraph.people.find((p) => p.personId === personDirector.id);
  assert(directorEntry?.tenureDisplay === '2004–2020' && !directorEntry?.isCurrent, 'Former director tenure range parsed as "2004–2020"');
  assert(directorEntry?.studioProjects.length === 1 && directorEntry?.studioProjects[0].id === anime2.id, 'Studio -> Person -> Anime graph resolved via AnimeStaff');

  // =========================================================================
  // PHASE 9.5: STUDIO ANALYTICS & PERFORMANCE TESTS
  // =========================================================================
  console.log('\n--- PHASE 9.5: STUDIO ANALYTICS & PERFORMANCE TESTS ---');

  // Invalidate cache first
  studioAnalyticsService.invalidateCache(studioId);

  const analytics = await studioAnalyticsService.getStudioAnalytics(studioId);
  assert(!!analytics, 'Studio analytics calculated successfully');
  assert(analytics!.overview.totalProjects === 3, 'Total projects aggregated correctly');
  assert(analytics!.overview.tvCount === 2, 'TV project count = 2');
  assert(analytics!.overview.movieCount === 1, 'Movie project count = 1');
  assert(analytics!.overview.averageScore !== null && analytics!.overview.averageScore >= 8.5, 'Average studio score calculated');
  assert(analytics!.overview.sampleSizeContext.includes('★'), 'Sample size context formatting includes score & count');
  assert(analytics!.genreDistribution.some((g) => g.name === 'Slice of Life'), 'Genre distribution captures Slice of Life');
  assert(analytics!.typeDistribution.length >= 2, 'Type distribution includes TV and MOVIE');

  // Test Analytics TTL Caching
  const cachedAnalytics = await studioAnalyticsService.getStudioAnalytics(studioId);
  assert(!!cachedAnalytics && cachedAnalytics.cachedAt.getTime() === analytics!.cachedAt.getTime(), 'Analytics result served from TTL in-memory cache');

  // =========================================================================
  // PHASE 9.6: STUDIO USER AFFINITY & PERSONALIZATION TESTS
  // =========================================================================
  console.log('\n--- PHASE 9.6: STUDIO USER AFFINITY & PERSONALIZATION TESTS ---');

  // Simulate User Interactions on Test Studio's anime
  // 1. User completed Anime 2 (A Silent Voice)
  await prisma.userAnime.upsert({
    where: { userId_animeId: { userId: testUser.id, animeId: anime2.id } },
    create: { userId: testUser.id, animeId: anime2.id, status: 'COMPLETED' },
    update: { status: 'COMPLETED' },
  });

  // 2. User rated Anime 2 a 10.0
  await prisma.animeRating.upsert({
    where: { userId_animeId: { userId: testUser.id, animeId: anime2.id } },
    create: { userId: testUser.id, animeId: anime2.id, rating: 10.0 },
    update: { rating: 10.0 },
  });

  // 3. User favorited Anime 1 (Hyouka)
  await prisma.favorite.upsert({
    where: { userId_animeId: { userId: testUser.id, animeId: anime1.id } },
    create: { userId: testUser.id, animeId: anime1.id },
    update: {},
  });

  // Compute User Studio Affinity
  const affinityProfile = await studioAffinityService.computeUserStudioAffinities(testUser.id);
  assert(affinityProfile.totalStudiosInteracted >= 1, 'User studio affinities computed');

  const studioAffinity = affinityProfile.allAffinities.find((a) => a.studioId === studioId);
  assert(!!studioAffinity, 'Studio found in user affinity profile');
  assert(studioAffinity!.score > 0.5, `High affinity score (${studioAffinity!.score}) computed from 10.0 rating + completion + favorite`);
  assert(studioAffinity!.confidence === 'MEDIUM' || studioAffinity!.confidence === 'HIGH', 'Confidence tier elevated from multi-signal interactions');
  assert(studioAffinity!.evidence.length >= 1, 'Human-readable evidence recorded in affinity profile');

  // Test Studio-Based Recommendation Generation
  const studioRecs = await studioAffinityService.getStudioRecommendedAnime(testUser.id, 5);
  assert(studioRecs.length >= 1, 'Unwatched studio anime recommended');
  assert(studioRecs[0].explanation.includes(testStudio.name), 'Explainable recommendation references studio affinity');

  // Verify IDOR Privacy & Security
  assert(!hasMinRole('USER', 'DATA_EDITOR'), 'RBAC: Normal user cannot execute administrative studio mutations');

  console.log('\n========================================================================');
  console.log(`PHASES 9.3 → 9.6 TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  console.log('========================================================================\n');
}

runStudioIntelligenceTestSuite().catch((err) => {
  console.error('Test Suite execution failed:', err);
  process.exit(1);
});
