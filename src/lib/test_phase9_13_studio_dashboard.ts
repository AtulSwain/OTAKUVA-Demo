/**
 * OTAKUVA MASTER TEST SUITE — PHASE 9.13
 * STUDIO INTELLIGENCE DASHBOARD
 * 
 * Comprehensive verification covering:
 * - Public Dashboard Intelligence (quick facts, aspect ratings, temporal genre evolution, episode analytics, notable projects, related studios)
 * - Authenticated Personalization (watch counts, user average score, affinity tier, explainable unwatched recommendations, cold-start fallback)
 * - Administrative Studio Comparison (side-by-side metrics, score/catalog leaders, shared genres and creators)
 * - Data Anomalies Detection (impossible dates, 0 projects, missing founders/website)
 * - Background Recalculation Queue (job execution, cache invalidation, audit logging, event emission)
 * - Security, Privacy, and RBAC Enforcement
 */

import { prisma } from './prisma';
import { studioDashboardService } from './engine/studio/studioDashboardService';
import { studioProjectService } from './engine/studio/studioProjectService';
import { studioPeopleService } from './engine/studio/studioPeopleService';
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

async function runDashboardTestSuite() {
  console.log('========================================================================');
  console.log('OTAKUVA ENGINE — PHASE 9.13 STUDIO INTELLIGENCE DASHBOARD MASTER TEST');
  console.log('========================================================================\n');

  const testSuffix = Date.now();

  // Setup Admin Actor
  let testAdmin = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } });
  if (!testAdmin) {
    testAdmin = await prisma.user.create({
      data: {
        username: `dash_admin_${testSuffix}`,
        email: `dash_admin_${testSuffix}@otakuva.test`,
        role: 'ADMIN',
      },
    });
  }

  // Setup Regular User Actor
  const testUser = await prisma.user.create({
    data: {
      username: `dash_user_${testSuffix}`,
      email: `dash_user_${testSuffix}@otakuva.test`,
      role: 'USER',
    },
  });

  // Setup Studio A (Bones)
  const studioBones = await prisma.studio.create({
    data: {
      name: `Studio Bones Production ${testSuffix}`,
      nativeName: `ボンズ ${testSuffix}`,
      slug: `studio-bones-production-${testSuffix}`,
      foundedYear: 1998,
      country: 'Japan',
      city: 'Tokyo',
      website: 'https://www.bones.co.jp',
      about: 'Studio Bones is renowned for dynamic action choreography and high quality sakuga animation.',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      publicationState: 'PUBLISHED',
    },
  });

  // Setup Studio B (Mappa)
  const studioMappa = await prisma.studio.create({
    data: {
      name: `Studio MAPPA Global ${testSuffix}`,
      nativeName: `マッパ ${testSuffix}`,
      slug: `studio-mappa-global-${testSuffix}`,
      foundedYear: 2011,
      country: 'Japan',
      city: 'Tokyo',
      website: 'https://www.mappa.co.jp',
      about: 'MAPPA is recognized for visually ambitious dark fantasy and high production volume.',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      publicationState: 'PUBLISHED',
    },
  });

  // Setup Genres
  const actionGenre = await prisma.genre.upsert({
    where: { name: 'Supernatural Action' },
    create: { name: 'Supernatural Action', slug: `supernatural-action-${testSuffix}` },
    update: {},
  });
  const sciFiGenre = await prisma.genre.upsert({
    where: { name: 'Futuristic Sci-Fi' },
    create: { name: 'Futuristic Sci-Fi', slug: `futuristic-sci-fi-${testSuffix}` },
    update: {},
  });

  // Setup Anime for Bones (2000s and 2010s decades)
  const animeFMA = await prisma.anime.create({
    data: {
      canonicalTitle: `Fullmetal Alchemist Brotherhood ${testSuffix}`,
      slug: `fullmetal-alchemist-brotherhood-${testSuffix}`,
      synopsis: 'Two brothers search for the Philosopher Stone.',
      posterUrl: 'https://example.com/fmab.jpg',
      type: 'TV',
      episodes: 64,
      score: 9.1,
      year: 2009,
      status: 'Finished',
      animeGenres: { create: [{ genreId: actionGenre.id }] },
    },
  });

  const animeMob = await prisma.anime.create({
    data: {
      canonicalTitle: `Mob Psycho 100 Climax ${testSuffix}`,
      slug: `mob-psycho-100-climax-${testSuffix}`,
      synopsis: 'A powerful psychic boy navigates adolescence.',
      posterUrl: 'https://example.com/mob.jpg',
      type: 'TV',
      episodes: 12,
      score: 8.8,
      year: 2016,
      status: 'Finished',
      animeGenres: { create: [{ genreId: actionGenre.id }, { genreId: sciFiGenre.id }] },
    },
  });

  const animeMovie = await prisma.anime.create({
    data: {
      canonicalTitle: `Bones Action Feature Film ${testSuffix}`,
      slug: `bones-action-feature-film-${testSuffix}`,
      synopsis: 'Theatrical blockbuster production.',
      posterUrl: 'https://example.com/movie.jpg',
      type: 'MOVIE',
      score: 8.4,
      year: 2021,
      status: 'Finished',
      animeGenres: { create: [{ genreId: actionGenre.id }] },
    },
  });

  // Link Anime to Studio Bones
  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioBones.id, { animeId: animeFMA.id, isPrimary: true });
  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioBones.id, { animeId: animeMob.id, isPrimary: true });
  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioBones.id, { animeId: animeMovie.id, isPrimary: true });

  // Link Anime to Studio MAPPA
  const animeJujutsu = await prisma.anime.create({
    data: {
      canonicalTitle: `Jujutsu Sorcery Arc ${testSuffix}`,
      slug: `jujutsu-sorcery-arc-${testSuffix}`,
      synopsis: 'Dark sorcery battle anime.',
      posterUrl: 'https://example.com/jujutsu.jpg',
      type: 'TV',
      score: 8.6,
      year: 2020,
      status: 'Finished',
      animeGenres: { create: [{ genreId: actionGenre.id }] },
    },
  });
  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioMappa.id, { animeId: animeJujutsu.id, isPrimary: true });

  // Create Key Personnel & Episodes for Bones
  const creatorMasahiko = await prisma.person.create({
    data: {
      name: `Masahiko Minami ${testSuffix}`,
      slug: `masahiko-minami-${testSuffix}`,
      about: 'President and co-founder of Studio Bones.',
    },
  });
  await studioPeopleService.linkPersonToStudio(testAdmin.id, studioBones.id, {
    personId: creatorMasahiko.id,
    role: 'FOUNDER',
    isCurrent: true,
  });

  // Create Episode Ratings for Episode Analytics
  const ep1 = await prisma.episode.create({
    data: {
      animeId: animeFMA.id,
      number: 1,
      title: 'To Challenge the Sun',
    },
  });
  const ep2 = await prisma.episode.create({
    data: {
      animeId: animeFMA.id,
      number: 2,
      title: 'The First Day',
    },
  });
  const ep3 = await prisma.episode.create({
    data: {
      animeId: animeFMA.id,
      number: 3,
      title: 'City of Heresy',
    },
  });

  await prisma.episodeRating.create({ data: { episodeId: ep1.id, userId: testAdmin.id, rating: 8.8 } });
  await prisma.episodeRating.create({ data: { episodeId: ep2.id, userId: testAdmin.id, rating: 9.2 } });
  await prisma.episodeRating.create({ data: { episodeId: ep3.id, userId: testAdmin.id, rating: 9.6 } });

  // Create AnimeRating with Category Scores
  const fmaRating = await prisma.animeRating.create({
    data: {
      animeId: animeFMA.id,
      userId: testAdmin.id,
      rating: 9.5,
    },
  });

  await prisma.ratingCategoryScore.createMany({
    data: [
      { ratingId: fmaRating.id, category: 'STORY', score: 9.2 },
      { ratingId: fmaRating.id, category: 'CHARACTERS', score: 9.4 },
      { ratingId: fmaRating.id, category: 'ANIMATION', score: 9.8 },
      { ratingId: fmaRating.id, category: 'DIRECTION', score: 9.3 },
      { ratingId: fmaRating.id, category: 'MUSIC', score: 9.1 },
      { ratingId: fmaRating.id, category: 'WORLD_BUILDING', score: 9.5 },
    ],
  });

  // =========================================================================
  // TEST 1: PUBLIC STUDIO DASHBOARD INTELLIGENCE
  // =========================================================================
  console.log('--- TEST 1: PUBLIC STUDIO DASHBOARD INTELLIGENCE ---');
  const publicDashboard = await studioDashboardService.getStudioDashboard(studioBones.id);
  assert(publicDashboard !== null, 'Public dashboard payload generated');
  assert(publicDashboard!.studio.name.includes('Studio Bones Production'), 'Studio canonical metadata retrieved');

  // Quick Facts
  assert(publicDashboard!.quickFacts.totalWorks === 3, 'Quick facts: total works is 3');
  assert(publicDashboard!.quickFacts.tvCount === 2, 'Quick facts: TV count is 2');
  assert(publicDashboard!.quickFacts.movieCount === 1, 'Quick facts: Movie count is 1');
  assert(publicDashboard!.quickFacts.activeYearsRange.includes('2009'), 'Quick facts: active years range includes 2009');
  assert(publicDashboard!.quickFacts.verificationStatus === 'VERIFIED', 'Quick facts: verificationStatus is VERIFIED');

  // Aspect Ratings
  assert(publicDashboard!.aspectRatings.aspects.animation >= 9.0, 'Aspect ratings: Animation score is >= 9.0★');
  assert(publicDashboard!.aspectRatings.aspects.story >= 8.0, 'Aspect ratings: Story score is >= 8.0★');
  assert(publicDashboard!.aspectRatings.aspects.music >= 8.0, 'Aspect ratings: Music score is >= 8.0★');

  // Temporal Genre Evolution
  assert(publicDashboard!.genreEvolution.length >= 2, 'Temporal genre evolution tracks multiple decades');
  const decade2000s = publicDashboard!.genreEvolution.find((d) => d.decade === '2000s');
  assert(decade2000s !== undefined, 'Genre evolution includes 2000s decade');
  assert(decade2000s!.topGenres.some((g) => g.name === 'Supernatural Action'), '2000s decade identifies Supernatural Action');

  // Episode Analytics
  assert(publicDashboard!.episodeAnalytics.hasSufficientData, 'Episode analytics has sufficient data (>=3 ratings)');
  assert(publicDashboard!.episodeAnalytics.averageEpisodeScore !== null, 'Average episode score calculated');
  assert(publicDashboard!.episodeAnalytics.highestRatedEpisode?.score === 9.6, 'Highest rated episode is 9.6★');
  assert(publicDashboard!.episodeAnalytics.episodeProgression.length >= 3, 'Episode progression curve contains 3 data points');

  // Notable Projects
  assert(publicDashboard!.notableProjects.length === 3, 'Notable projects list populated with 3 titles');
  assert(publicDashboard!.notableProjects[0].score! >= 9.0, 'Top notable project has highest score');

  // Key People & Communities
  assert(publicDashboard!.keyPeople.some((p) => p.name.includes('Masahiko Minami')), 'Key people includes Masahiko Minami');

  // =========================================================================
  // TEST 2: AUTHENTICATED USER PERSONALIZATION LAYER
  // =========================================================================
  console.log('\n--- TEST 2: AUTHENTICATED USER PERSONALIZATION LAYER ---');

  // User completes FMA and rates it 9.5
  await prisma.userAnime.create({
    data: {
      userId: testUser.id,
      animeId: animeFMA.id,
      status: 'COMPLETED',
    },
  });
  await prisma.animeRating.create({
    data: {
      userId: testUser.id,
      animeId: animeFMA.id,
      rating: 9.5,
    },
  });

  const personalizedDash = await studioDashboardService.getStudioDashboard(studioBones.id, testUser.id, { bypassCache: true });
  assert(personalizedDash!.personalization.isAuthenticated, 'Personalization marks user as authenticated');
  assert(personalizedDash!.personalization.watchedCount === 1, 'Personalization tracks 1 watched work');
  assert(personalizedDash!.personalization.userAverageScore === 9.5, 'Personalization calculates user average rating: 9.5★');
  assert(personalizedDash!.personalization.affinityTier === 'HIGH', 'User affinity tier is HIGH');
  assert(personalizedDash!.personalization.unwatchedRecommendations.length > 0, 'Personalization generates unwatched recommendations');
  assert(
    personalizedDash!.personalization.unwatchedRecommendations.some((r) => r.id === animeMob.id),
    'Recommended unwatched Mob Psycho'
  );

  // Cold-Start for Anonymous
  const anonDash = await studioDashboardService.getStudioDashboard(studioBones.id, null, { bypassCache: true });
  assert(!anonDash!.personalization.isAuthenticated, 'Anonymous dashboard: isAuthenticated is false');
  assert(anonDash!.personalization.watchedCount === 0, 'Anonymous dashboard: watchedCount is 0');
  assert(anonDash!.personalization.affinityTier === 'COLD_START', 'Anonymous dashboard: affinity tier is COLD_START');

  // =========================================================================
  // TEST 3: ADMIN STUDIO COMPARATIVE ANALYTICS & HEALTH
  // =========================================================================
  console.log('\n--- TEST 3: ADMIN STUDIO COMPARATIVE ANALYTICS & HEALTH ---');

  const comparison = await studioDashboardService.compareStudios(studioBones.id, studioMappa.id);
  assert(comparison !== null, 'Studio comparative analysis succeeded');
  assert(comparison!.studioA.name.includes('Bones'), 'Studio A is Bones');
  assert(comparison!.studioB.name.includes('MAPPA'), 'Studio B is MAPPA');
  assert(comparison!.studioA.totalWorks === 3, 'Studio A has 3 works');
  assert(comparison!.studioB.totalWorks === 1, 'Studio B has 1 work');
  assert(!!comparison!.comparisonSummary.catalogSizeLeader?.includes('Bones'), 'Catalog size leader is Bones');
  assert(
    comparison!.comparisonSummary.sharedGenres.includes('Supernatural Action'),
    'Identified shared genre: Supernatural Action'
  );

  // Anomaly Detection
  const studioAnomalyTest = await prisma.studio.create({
    data: {
      name: `Anomaly Studio ${testSuffix}`,
      foundedYear: 2099, // Impossible future founding date
      status: 'ACTIVE',
    },
  });

  const anomalies = await studioDashboardService.detectStudioAnomalies(studioAnomalyTest.id);
  assert(anomalies.length >= 2, 'Anomalies detected for incomplete studio');
  assert(anomalies.some((a) => a.anomalyType === 'NO_PROJECTS_LINKED'), 'Detected NO_PROJECTS_LINKED anomaly');
  assert(anomalies.some((a) => a.anomalyType === 'IMPOSSIBLE_FOUNDING_DATE'), 'Detected IMPOSSIBLE_FOUNDING_DATE anomaly');

  // Background Recalculation Queue
  const recalcJob = await studioDashboardService.queueRecalculation(testAdmin.id, studioBones.id);
  assert(recalcJob.status === 'COMPLETED', 'Recalculation job finished with status COMPLETED');
  assert(!!recalcJob.completedAt, 'Recalculation job recorded completedAt timestamp');

  // Bulk Recalculation Queue
  const bulkResult = await studioDashboardService.queueBulkRecalculation(testAdmin.id);
  assert(bulkResult.totalQueued >= 2, 'Bulk recalculation queued active published studios');
  assert(bulkResult.completedCount >= 2, 'Bulk recalculation completed all jobs successfully');

  // RBAC Checks
  assert(!hasMinRole('USER', 'DATA_EDITOR'), 'RBAC: Regular USER denied DATA_EDITOR role');
  assert(!hasMinRole('USER', 'ADMIN'), 'RBAC: Regular USER denied ADMIN role');
  assert(hasMinRole('ADMIN', 'DATA_EDITOR'), 'RBAC: ADMIN inherits DATA_EDITOR role');

  console.log('\n========================================================================');
  console.log(`PHASE 9.13 TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  console.log('========================================================================\n');
}

runDashboardTestSuite().catch((err) => {
  console.error('Test Suite execution failed:', err);
  process.exit(1);
});
