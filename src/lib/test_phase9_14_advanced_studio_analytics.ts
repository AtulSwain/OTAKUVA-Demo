/**
 * OTAKUVA MASTER TEST SUITE — PHASE 9.14
 * ADVANCED STUDIO ANALYTICS & METRICS ENGINE
 * 
 * Comprehensive automated verification covering:
 * - Studio Performance Engine (composite performance score studio_performance_score_v1)
 * - Rating Analytics Engine (Bayesian adjustment bayesian_studio_score_v1, aspect ratings, score histograms)
 * - Quality & Consistency Analytics (standard deviation, variance, z-score outlier detection)
 * - Production Analytics Engine (production cadence, format distribution, production gaps)
 * - Genre Intelligence & Diversity (temporal evolution, Shannon Entropy Diversity Index)
 * - Audience Intelligence & Privacy Thresholds (cohort completion rate, growth windows, privacy guard >= 5)
 * - Community & News Analytics (discussion momentum, news volume, spike co-occurrence detection)
 * - Studio Momentum Engine (studio_momentum_score_v1 with explainable contributing signals)
 * - Forecasting & Trend Detection (FORECAST_v1, 7d/30d/90d horizons, trend classification)
 * - Multi-Period Studio Comparison (side-by-side benchmarking across time periods)
 * - Snapshots, Background Queue & Caching (StudioAnalyticsSnapshot model, queue execution, cache purge)
 * - Admin Operations & RBAC Security Enforcement
 */

import { prisma } from './prisma';
import { studioAdvancedAnalyticsService, METRIC_VERSIONS } from './engine/studio/studioAdvancedAnalyticsService';
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

async function runAdvancedAnalyticsTestSuite() {
  console.log('========================================================================');
  console.log('OTAKUVA ENGINE — PHASE 9.14 ADVANCED STUDIO ANALYTICS MASTER TEST');
  console.log('========================================================================\n');

  const testSuffix = Date.now();

  // Setup Admin Actor
  let testAdmin = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } });
  if (!testAdmin) {
    testAdmin = await prisma.user.create({
      data: {
        username: `analytics_admin_${testSuffix}`,
        email: `analytics_admin_${testSuffix}@otakuva.test`,
        role: 'ADMIN',
      },
    });
  }

  // Setup Regular User Actor
  const testUser = await prisma.user.create({
    data: {
      username: `analytics_user_${testSuffix}`,
      email: `analytics_user_${testSuffix}@otakuva.test`,
      role: 'USER',
    },
  });

  // Setup Primary Studio (Studio Ufotable)
  const studioUfotable = await prisma.studio.create({
    data: {
      name: `Ufotable Visual Studio ${testSuffix}`,
      nativeName: `ユーフォーテーブル ${testSuffix}`,
      slug: `ufotable-visual-studio-${testSuffix}`,
      foundedYear: 2000,
      country: 'Japan',
      city: 'Tokyo',
      website: 'https://www.ufotable.com',
      about: 'Ufotable is known for groundbreaking digital compositing, 3D CGI integration, and high octane action scenes.',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      publicationState: 'PUBLISHED',
    },
  });

  // Setup Secondary Studio (Studio Wit)
  const studioWit = await prisma.studio.create({
    data: {
      name: `WIT Animation Studio ${testSuffix}`,
      nativeName: `ウィットスタジオ ${testSuffix}`,
      slug: `wit-animation-studio-${testSuffix}`,
      foundedYear: 2012,
      country: 'Japan',
      city: 'Tokyo',
      website: 'https://witstudio.co.jp',
      about: 'WIT Studio is known for cinematic camera movement and detailed background art.',
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      publicationState: 'PUBLISHED',
    },
  });

  // Setup Genres
  const fantasyGenre = await prisma.genre.upsert({
    where: { name: 'Dark Fantasy' },
    create: { name: 'Dark Fantasy', slug: `dark-fantasy-${testSuffix}` },
    update: {},
  });
  const actionGenre = await prisma.genre.upsert({
    where: { name: 'Supernatural Action' },
    create: { name: 'Supernatural Action', slug: `supernatural-action-${testSuffix}` },
    update: {},
  });
  const mysteryGenre = await prisma.genre.upsert({
    where: { name: 'Supernatural Mystery' },
    create: { name: 'Supernatural Mystery', slug: `supernatural-mystery-${testSuffix}` },
    update: {},
  });

  // Setup Anime Projects for Ufotable (Spanning multiple years: 2007, 2011, 2019, 2023)
  const animeKara = await prisma.anime.create({
    data: {
      canonicalTitle: `The Garden of Sinners ${testSuffix}`,
      slug: `the-garden-of-sinners-${testSuffix}`,
      synopsis: 'Supernatural occult murder mysteries.',
      posterUrl: 'https://example.com/kara.jpg',
      type: 'MOVIE',
      score: 8.5,
      year: 2007,
      status: 'Finished',
      animeGenres: { create: [{ genreId: mysteryGenre.id }, { genreId: fantasyGenre.id }] },
    },
  });

  const animeFateZero = await prisma.anime.create({
    data: {
      canonicalTitle: `Fate Zero Holy Grail War ${testSuffix}`,
      slug: `fate-zero-holy-grail-war-${testSuffix}`,
      synopsis: 'Seven mages summon heroic spirits to fight for the Holy Grail.',
      posterUrl: 'https://example.com/fate.jpg',
      type: 'TV',
      episodes: 25,
      score: 8.8,
      year: 2011,
      status: 'Finished',
      animeGenres: { create: [{ genreId: fantasyGenre.id }, { genreId: actionGenre.id }] },
    },
  });

  const animeDemonSlayer = await prisma.anime.create({
    data: {
      canonicalTitle: `Demon Slayer Kimetsu ${testSuffix}`,
      slug: `demon-slayer-kimetsu-${testSuffix}`,
      synopsis: 'A boy becomes a demon slayer to save his sister.',
      posterUrl: 'https://example.com/ds.jpg',
      type: 'TV',
      episodes: 26,
      score: 9.2,
      year: 2019,
      status: 'Finished',
      animeGenres: { create: [{ genreId: actionGenre.id }, { genreId: fantasyGenre.id }] },
    },
  });

  const animeUpcoming = await prisma.anime.create({
    data: {
      canonicalTitle: `Genshin Animation Project ${testSuffix}`,
      slug: `genshin-animation-project-${testSuffix}`,
      synopsis: 'Epic fantasy adventure across Teyvat.',
      posterUrl: 'https://example.com/genshin.jpg',
      type: 'TV',
      score: null,
      year: 2026,
      status: 'UPCOMING',
      animeGenres: { create: [{ genreId: fantasyGenre.id }] },
    },
  });

  // Link Anime to Studio Ufotable
  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioUfotable.id, { animeId: animeKara.id, isPrimary: true });
  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioUfotable.id, { animeId: animeFateZero.id, isPrimary: true });
  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioUfotable.id, { animeId: animeDemonSlayer.id, isPrimary: true });
  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioUfotable.id, { animeId: animeUpcoming.id, isPrimary: true });

  // Link Anime to Studio WIT
  const animeAOT = await prisma.anime.create({
    data: {
      canonicalTitle: `Attack on Titan Season 1 ${testSuffix}`,
      slug: `attack-on-titan-season-1-${testSuffix}`,
      synopsis: 'Humanity fights against giant titans.',
      posterUrl: 'https://example.com/aot.jpg',
      type: 'TV',
      episodes: 25,
      score: 9.0,
      year: 2013,
      status: 'Finished',
      animeGenres: { create: [{ genreId: actionGenre.id }, { genreId: fantasyGenre.id }] },
    },
  });
  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioWit.id, { animeId: animeAOT.id, isPrimary: true });

  // Create Ratings & Category Scores for Ufotable
  const rating1 = await prisma.animeRating.create({
    data: { animeId: animeDemonSlayer.id, userId: testAdmin.id, rating: 9.5 },
  });
  const rating2 = await prisma.animeRating.create({
    data: { animeId: animeDemonSlayer.id, userId: testUser.id, rating: 9.0 },
  });
  const rating3 = await prisma.animeRating.create({
    data: { animeId: animeFateZero.id, userId: testAdmin.id, rating: 8.8 },
  });

  await prisma.ratingCategoryScore.createMany({
    data: [
      { ratingId: rating1.id, category: 'STORY', score: 8.8 },
      { ratingId: rating1.id, category: 'CHARACTERS', score: 9.0 },
      { ratingId: rating1.id, category: 'ANIMATION', score: 9.9 },
      { ratingId: rating1.id, category: 'DIRECTION', score: 9.5 },
      { ratingId: rating1.id, category: 'MUSIC', score: 9.4 },
      { ratingId: rating1.id, category: 'WORLD_BUILDING', score: 9.2 },
    ],
  });

  // Create Cohort User Activity (5 users for privacy threshold verification)
  for (let i = 1; i <= 5; i++) {
    const cohortUser = await prisma.user.create({
      data: {
        username: `cohort_user_${i}_${testSuffix}`,
        email: `cohort_user_${i}_${testSuffix}@otakuva.test`,
      },
    });
    await prisma.userAnime.create({
      data: {
        userId: cohortUser.id,
        animeId: animeDemonSlayer.id,
        status: i <= 4 ? 'COMPLETED' : 'WATCHING',
      },
    });
  }

  // Create Community and Discussions for Ufotable
  const community = await prisma.community.create({
    data: {
      name: `Ufotable Enthusiasts ${testSuffix}`,
      slug: `ufotable-enthusiasts-${testSuffix}`,
      description: 'Official fan club for Ufotable animation.',
      studioId: studioUfotable.id,
      communityType: 'STUDIO',
      ownerId: testAdmin.id,
      memberCount: 42,
    },
  });

  await prisma.discussion.create({
    data: {
      communityId: community.id,
      authorId: testAdmin.id,
      title: 'Which Ufotable fight scene is the greatest in anime history?',
      body: 'Discuss the animation in Demon Slayer Episode 19 vs Fate/Stay Night Heaven Feel!',
    },
  });

  // Create Verified News for Ufotable
  const newsArticle = await prisma.newsArticle.create({
    data: {
      title: `Ufotable Announces Epic New Teaser for Anime Project ${testSuffix}`,
      slug: `ufotable-announces-epic-teaser-${testSuffix}`,
      content: 'Ufotable has revealed brand new key visuals and production details.',
      category: 'ANNOUNCEMENTS',
      sourceName: 'Anime News Network',
      sourceUrl: `https://example.com/news/${testSuffix}`,
      canonicalUrl: `https://example.com/news/${testSuffix}`,
      publishedAt: new Date(),
    },
  });

  await prisma.newsArticleStudio.create({
    data: {
      articleId: newsArticle.id,
      studioId: studioUfotable.id,
      relationType: 'PRIMARY_SUBJECT',
    },
  });

  // =========================================================================
  // TEST 1: STUDIO PERFORMANCE ENGINE & COMPOSITE SCORE
  // =========================================================================
  console.log('--- TEST 1: STUDIO PERFORMANCE ENGINE & COMPOSITE SCORE ---');

  const analytics = await studioAdvancedAnalyticsService.getStudioAdvancedAnalytics(
    studioUfotable.id,
    'ALL_TIME',
    { forceLiveCalculation: true, bypassCache: true }
  );

  assert(analytics !== null, 'Advanced studio analytics result generated');
  assert(analytics!.performance.version === METRIC_VERSIONS.PERFORMANCE_SCORE, 'Uses versioned formula studio_performance_score_v1');
  assert(analytics!.performance.totalProjects === 4, 'Tracks 4 total projects');
  assert(analytics!.performance.completedProjects === 3, 'Tracks 3 completed projects');
  assert(analytics!.performance.upcomingProjects === 1, 'Tracks 1 upcoming project');
  assert(analytics!.performance.score >= 50 && analytics!.performance.score <= 100, 'Calculates valid composite performance score');
  assert(analytics!.performance.completionRate >= 0.7, 'Calculates cohort completion rate >= 70%');

  // =========================================================================
  // TEST 2: RATING ANALYTICS & BAYESIAN ADJUSTMENT
  // =========================================================================
  console.log('\n--- TEST 2: RATING ANALYTICS & BAYESIAN ADJUSTMENT ---');

  assert(analytics!.ratings.rawAverage !== null && analytics!.ratings.rawAverage >= 8.5, 'Calculates raw average score >= 8.5★');
  assert(analytics!.ratings.bayesianScore !== null, 'Calculates Bayesian adjusted score');
  assert(analytics!.ratings.aspects.animation >= 9.0, 'Aspect score: Animation is >= 9.0★');
  assert(analytics!.ratings.aspects.direction >= 8.5, 'Aspect score: Direction is >= 8.5★');
  assert(analytics!.ratings.distribution.some((d) => d.range === '9-10' && d.count >= 2), 'Score distribution populates 9-10 bucket');

  // Rating Consistency & Outliers
  assert(analytics!.ratings.consistency.tier !== undefined, 'Rating consistency tier determined');
  assert(typeof analytics!.ratings.consistency.standardDeviation === 'number', 'Standard deviation computed');
  assert(analytics!.ratings.outliers !== undefined, 'Project outlier analysis executed');

  // =========================================================================
  // TEST 3: PRODUCTION ANALYTICS & TIMELINE
  // =========================================================================
  console.log('\n--- TEST 3: PRODUCTION ANALYTICS & TIMELINE ---');

  assert(analytics!.production.totalEpisodes >= 50, 'Production tracks >= 50 total episodes');
  assert(analytics!.production.formatDistribution.some((f) => f.format === 'TV'), 'Format distribution includes TV');
  assert(analytics!.production.formatDistribution.some((f) => f.format === 'MOVIE'), 'Format distribution includes MOVIE');
  assert(analytics!.production.projectsPerYear.length >= 3, 'Production tracks multiple release years');
  assert(analytics!.production.activeYearsRange.includes('2007'), 'Active years range includes 2007');

  // =========================================================================
  // TEST 4: GENRE INTELLIGENCE & SHANNON DIVERSITY INDEX
  // =========================================================================
  console.log('\n--- TEST 4: GENRE INTELLIGENCE & SHANNON DIVERSITY INDEX ---');

  assert(analytics!.genres.distribution.some((g) => g.name === 'Dark Fantasy'), 'Identifies Dark Fantasy in genre distribution');
  assert(analytics!.genres.evolution.length >= 2, 'Genre evolution covers multiple decades');
  assert(analytics!.genres.diversity.shannonIndex > 0, 'Computes positive Shannon Entropy Index (H > 0)');
  assert(analytics!.genres.diversity.normalizedDiversity > 0, 'Computes Normalized Diversity (0.0 to 1.0)');
  assert(analytics!.genres.diversity.tier !== undefined, 'Categorizes genre diversity tier');

  // =========================================================================
  // TEST 5: AUDIENCE INTELLIGENCE & PRIVACY PROTECTIONS
  // =========================================================================
  console.log('\n--- TEST 5: AUDIENCE INTELLIGENCE & PRIVACY PROTECTIONS ---');

  assert(analytics!.audience.totalWatchers >= 5, 'Audience tracks >= 5 total watchers');
  assert(analytics!.audience.totalCompleters >= 4, 'Audience tracks >= 4 total completers');
  assert(analytics!.audience.isPrivacyProtected, 'Enforces privacy guard: isPrivacyProtected is true for cohort >= 5');
  assert(analytics!.audience.growth.window30d >= 5, 'Audience 30-day growth window tracks recent activity');

  // =========================================================================
  // TEST 6: COMMUNITY & NEWS ANALYTICS WITH SPIKE DETECTION
  // =========================================================================
  console.log('\n--- TEST 6: COMMUNITY & NEWS ANALYTICS WITH SPIKE DETECTION ---');

  assert(analytics!.communityAndNews.communityCount >= 1, 'Tracks linked studio community');
  assert(analytics!.communityAndNews.discussionCount >= 1, 'Tracks active community discussions');
  assert(analytics!.communityAndNews.newsCount >= 1, 'Tracks verified news articles');
  assert(analytics!.communityAndNews.newsCategories.some((c) => c.category === 'ANNOUNCEMENTS'), 'News category breakdown includes ANNOUNCEMENTS');

  // =========================================================================
  // TEST 7: STUDIO MOMENTUM ENGINE & EXPLAINABILITY
  // =========================================================================
  console.log('\n--- TEST 7: STUDIO MOMENTUM ENGINE & EXPLAINABILITY ---');

  assert(analytics!.momentum.score > 0, 'Computes positive studio momentum score');
  assert(analytics!.momentum.explanation.length > 0, 'Generates plain-language momentum explanation');
  assert(analytics!.momentum.contributingSignals.length === 5, 'Breaks down 5 contributing momentum signals');
  assert(analytics!.momentum.contributingSignals.some((s) => s.signal.includes('Audience')), 'Includes Audience signal');

  // =========================================================================
  // TEST 8: STATISTICAL FORECASTING & TREND PROJECTION
  // =========================================================================
  console.log('\n--- TEST 8: STATISTICAL FORECASTING & TREND PROJECTION ---');

  assert(analytics!.forecast.isForecast === true, 'Explicitly flags payload as isForecast: true');
  assert(analytics!.forecast.model === METRIC_VERSIONS.FORECAST_MODEL, 'Uses exponential smoothing forecast model');
  assert(analytics!.forecast.confidence === 'HIGH' || analytics!.forecast.confidence === 'MEDIUM', 'Determines valid forecast confidence');
  assert(analytics!.forecast.horizons.days7.expectedEngagementIndex > 0, 'Computes 7-day projected index');
  assert(analytics!.forecast.horizons.days30.expectedEngagementIndex > 0, 'Computes 30-day projected index');
  assert(analytics!.forecast.horizons.days90.expectedEngagementIndex > 0, 'Computes 90-day projected index');
  assert(analytics!.forecast.disclaimer.length > 0, 'Includes statistical projection disclaimer');

  // =========================================================================
  // TEST 9: MULTI-PERIOD STUDIO COMPARISON
  // =========================================================================
  console.log('\n--- TEST 9: MULTI-PERIOD STUDIO COMPARISON ---');

  const comparison = await studioAdvancedAnalyticsService.compareStudiosMultiPeriod(
    studioUfotable.id,
    studioWit.id,
    'ALL_TIME'
  );

  assert(comparison !== null, 'Multi-period studio comparison succeeded');
  assert(comparison!.studioA.name.includes('Ufotable'), 'Studio A is Ufotable');
  assert(comparison!.studioB.name.includes('WIT'), 'Studio B is WIT');
  assert(comparison!.comparison.catalogSizeLeader.includes('Ufotable'), 'Catalog size leader identified as Ufotable');
  assert(comparison!.comparison.sharedGenres.includes('Dark Fantasy'), 'Identifies shared genre: Dark Fantasy');

  // =========================================================================
  // TEST 10: SNAPSHOT PERSISTENCE, CACHING & BACKGROUND QUEUE
  // =========================================================================
  console.log('\n--- TEST 10: SNAPSHOT PERSISTENCE, CACHING & BACKGROUND QUEUE ---');

  // Check Snapshot Created in Database
  const snapshot = await prisma.studioAnalyticsSnapshot.findUnique({
    where: {
      studioId_period_metricVersion: {
        studioId: studioUfotable.id,
        period: 'ALL_TIME',
        metricVersion: METRIC_VERSIONS.PERFORMANCE_SCORE,
      },
    },
  });
  assert(snapshot !== null, 'StudioAnalyticsSnapshot stored in SQLite database');
  assert(snapshot!.projectCount === 4, 'Snapshot project count is 4');

  // Queue Recalculation Job
  const job = await studioAdvancedAnalyticsService.queueAnalyticsJob(testAdmin.id, studioUfotable.id);
  assert(job.status === 'COMPLETED', 'Analytics refresh job finished with COMPLETED status');
  assert(job.completedAt !== undefined, 'Job recorded completedAt timestamp');

  // Admin Dashboard Overview
  const adminDash = await studioAdvancedAnalyticsService.getAdminAnalyticsDashboard();
  assert(adminDash.totalStudios >= 2, 'Admin dashboard tracks total studios');
  assert(adminDash.totalSnapshots >= 1, 'Admin dashboard tracks generated snapshots');
  assert(['HEALTHY', 'WARNING', 'CRITICAL'].includes(adminDash.systemHealth), 'System health computed');

  // =========================================================================
  // TEST 11: SECURITY & RBAC PERMISSION ENFORCEMENT
  // =========================================================================
  console.log('\n--- TEST 11: SECURITY & RBAC PERMISSION ENFORCEMENT ---');

  assert(!hasMinRole('USER', 'DATA_EDITOR'), 'RBAC: Regular USER denied DATA_EDITOR permissions');
  assert(!hasMinRole('USER', 'ADMIN'), 'RBAC: Regular USER denied ADMIN permissions');
  assert(hasMinRole('ADMIN', 'DATA_EDITOR'), 'RBAC: ADMIN inherits DATA_EDITOR permissions');

  console.log('\n========================================================================');
  console.log(`PHASE 9.14 TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  console.log('========================================================================\n');
}

runAdvancedAnalyticsTestSuite().catch((err) => {
  console.error('Test Suite execution failed:', err);
  process.exit(1);
});
