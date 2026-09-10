/**
 * OTAKUVA MASTER TEST SUITE — PHASE 3
 * ANIME / SEASON / API FOUNDATION
 * 
 * Verifies all 17 core focus areas:
 * 1. Canonical Anime architecture
 * 2. Canonical Season architecture
 * 3. Anime ↔ Season ↔ Episode relationships
 * 4. Anime API architecture
 * 5. Season API architecture
 * 6. Episode API integration
 * 7. API response contracts
 * 8. Query/filter/sort architecture
 * 9. API validation
 * 10. API security
 * 11. API caching
 * 12. API performance
 * 13. API pagination
 * 14. API error handling
 * 15. API observability
 * 16. Frontend/API separation
 * 17. Integration with Library, Schedule and Progress
 */

import { prisma } from './prisma';
import { AnimeCatalogEngine } from './engine/anime/animeCatalogEngine';
import { SeasonEngine } from './engine/anime/seasonEngine';
import { EpisodeEngine } from './engine/anime/episodeEngine';
import { validateAnimeQueryParams, validateIdOrSlug } from './security/apiValidator';
import { CacheManager } from './performance/cacheManager';
import { RateLimiter } from './security/rateLimiter';
import { sanitizeText } from './security/xssSanitizer';
import { toggleEpisodeWatchStatus } from './engine/watch/watchEngine';
import { createSuccessResponse, createErrorResponse } from './api/apiHandler';

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: any) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ [PASS] ${testName}`);
  } else {
    console.error(`  ✗ [FAIL] ${testName}`, detail !== undefined ? detail : '');
  }
}

async function runPhase3MasterTests() {
  console.log('============================================================');
  console.log('STARTING OTAKUVA PHASE 3 MASTER VERIFICATION SUITE');
  console.log('============================================================\n');

  let testUser: any = null;
  let testAnime: any = null;

  try {
    // Setup test user and canonical anime fixture
    const testUserId = `test_p3_user_${Date.now()}`;
    testUser = await prisma.user.create({
      data: {
        id: testUserId,
        username: `p3user_${Date.now()}`,
        email: `p3_${Date.now()}@otakuva.test`,
        role: 'USER',
      },
    });

    const testAnimeSlug = `phase3-canonical-anime-${Date.now()}`;
    testAnime = await prisma.anime.create({
    data: {
      slug: testAnimeSlug,
      canonicalTitle: 'Frieren: Beyond Journey\'s End (Phase 3 Master)',
      synopsis: 'An elf mage embarks on a journey to truly understand humans after defeating the Demon King.',
      type: 'TV',
      status: 'FINISHED',
      episodes: 28,
      score: 9.38,
      scoredBy: 340000,
      popularity: 25,
      members: 650000,
      rank: 1,
      year: 2023,
      season: 'FALL',
      posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600',
      bannerUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200',
      titles: {
        create: [
          { type: 'english', title: 'Frieren: Beyond Journey\'s End', language: 'en', isPrimary: true },
          { type: 'japanese', title: '葬送のフリーレン', language: 'ja', isPrimary: false },
          { type: 'romaji', title: 'Sousou no Frieren', language: 'ja-ro', isPrimary: false },
        ],
      },
      animeGenres: {
        create: [
          { genre: { connectOrCreate: { where: { name: 'Fantasy' }, create: { name: 'Fantasy', slug: 'fantasy' } } } },
          { genre: { connectOrCreate: { where: { name: 'Adventure' }, create: { name: 'Adventure', slug: 'adventure' } } } },
        ],
      },
      animeThemes: {
        create: [
          { theme: { connectOrCreate: { where: { name: 'Time Travel' }, create: { name: 'Time Travel', slug: 'time-travel' } } } },
        ],
      },
    },
  });

  // Create Season 1 and Season 2
  const season1 = await prisma.season.create({
    data: {
      animeId: testAnime.id,
      seasonNumber: 1,
      title: 'Season 1: The Mage Exam',
      seasonType: 'MAIN',
      episodeCount: 16,
      sortOrder: 1,
      year: 2023,
    },
  });

  const season2 = await prisma.season.create({
    data: {
      animeId: testAnime.id,
      seasonNumber: 2,
      title: 'Season 2: First-Class Mage Exam Arc',
      seasonType: 'MAIN',
      episodeCount: 12,
      sortOrder: 2,
      year: 2024,
    },
  });

  // Create 5 Episodes for Season 1, and 2 for Season 2
  const ep1 = await prisma.episode.create({
    data: {
      animeId: testAnime.id,
      seasonId: season1.id,
      number: 1,
      title: 'The Journey\'s End',
      duration: '24 min',
      filler: false,
      recap: false,
    },
  });

  const ep2 = await prisma.episode.create({
    data: {
      animeId: testAnime.id,
      seasonId: season1.id,
      number: 2,
      title: 'It Didn\'t Have to Be Magic...',
      duration: '24 min',
      filler: false,
      recap: false,
    },
  });

  const ep3 = await prisma.episode.create({
    data: {
      animeId: testAnime.id,
      seasonId: season1.id,
      number: 3,
      title: 'Killing Magic',
      duration: '24 min',
      filler: false,
      recap: false,
    },
  });

  const ep17 = await prisma.episode.create({
    data: {
      animeId: testAnime.id,
      seasonId: season2.id,
      number: 17,
      title: 'Take Care',
      duration: '24 min',
      filler: false,
      recap: false,
    },
  });

  // -------------------------------------------------------------
  // FOCUS 1: Canonical Anime Architecture
  // -------------------------------------------------------------
  console.log('Testing Focus 1: Canonical Anime Architecture...');
  const fetchedAnime = await AnimeCatalogEngine.getAnimeByIdOrSlug(testAnime.id);
  assert(Boolean(fetchedAnime), 'AnimeCatalogEngine retrieves anime by ID');
  assert(fetchedAnime?.slug === testAnimeSlug, 'Anime slug matches canonical value');
  assert(fetchedAnime?.titles.length === 3, 'All canonical titles (en, ja, romaji) are loaded');
  assert(Boolean(fetchedAnime?.genres.includes('Fantasy')), 'Canonical genres attached correctly');

  // -------------------------------------------------------------
  // FOCUS 2: Canonical Season Architecture
  // -------------------------------------------------------------
  console.log('\nTesting Focus 2: Canonical Season Architecture...');
  const seasonData = await SeasonEngine.getAnimeSeasons(testAnime.id);
  assert(seasonData.directSeasons.length === 2, 'SeasonEngine resolves all direct canonical seasons');
  assert(seasonData.directSeasons[0].seasonNumber === 1, 'Season 1 numbered correctly');
  assert(seasonData.directSeasons[1].seasonNumber === 2, 'Season 2 numbered correctly');
  assert(seasonData.directSeasons[0].episodes?.length === 3, 'Season 1 contains its 3 assigned episodes');

  // -------------------------------------------------------------
  // FOCUS 3: Anime ↔ Season ↔ Episode Relationships
  // -------------------------------------------------------------
  console.log('\nTesting Focus 3: Anime ↔ Season ↔ Episode Relationships...');
  const ep1Detail = await EpisodeEngine.getEpisodeDetail(ep1.id);
  assert(Boolean(ep1Detail), 'EpisodeEngine loads episode detail');
  assert(ep1Detail?.anime.id === testAnime.id, 'Episode links to canonical parent Anime');
  assert(ep1Detail?.season?.id === season1.id, 'Episode links to canonical parent Season');
  assert(ep1Detail?.nextEpisode?.id === ep2.id, 'Next episode pointer correctly resolves ep 2');

  const ep2Detail = await EpisodeEngine.getEpisodeDetail(ep2.id);
  assert(ep2Detail?.previousEpisode?.id === ep1.id, 'Previous episode pointer correctly resolves ep 1');
  assert(ep2Detail?.nextEpisode?.id === ep3.id, 'Next episode pointer correctly resolves ep 3');

  // -------------------------------------------------------------
  // FOCUS 4: Anime API Architecture (Catalog Query)
  // -------------------------------------------------------------
  console.log('\nTesting Focus 4: Anime API Architecture...');
  const catalogRes = await AnimeCatalogEngine.queryAnimeCatalog({
    q: 'Frieren',
    genre: 'Fantasy',
    type: 'TV',
    limit: 10,
    page: 1,
  });
  assert(catalogRes.items.length > 0, 'Catalog query finds matching anime');
  assert(catalogRes.pagination.page === 1, 'Pagination page matches request');
  assert(catalogRes.pagination.limit === 10, 'Pagination limit matches request');
  assert(Boolean(catalogRes.items[0]?.genres.includes('Fantasy')), 'Result item contains Fantasy genre');

  // -------------------------------------------------------------
  // FOCUS 5: Season API Architecture
  // -------------------------------------------------------------
  console.log('\nTesting Focus 5: Season API Architecture...');
  const s1Detail = await SeasonEngine.getSeasonDetail(season1.id);
  assert(Boolean(s1Detail), 'SeasonEngine loads single season detail');
  assert(s1Detail?.season.title === 'Season 1: The Mage Exam', 'Season title matches canonical name');
  assert(s1Detail?.season.episodes?.length === 3, 'Season detail includes full episode roster');

  // -------------------------------------------------------------
  // FOCUS 6: Episode API Integration
  // -------------------------------------------------------------
  console.log('\nTesting Focus 6: Episode API Integration...');
  const epRoster = await EpisodeEngine.getAnimeEpisodes(testAnime.id, { page: 1, limit: 50 });
  assert(epRoster.episodes.length === 4, 'EpisodeEngine returns all 4 created episodes for anime');
  assert(epRoster.progress?.totalCount === 28, 'Total episode count matches anime schema');

  // Filter by season
  const s2OnlyEpisodes = await EpisodeEngine.getAnimeEpisodes(testAnime.id, { seasonId: season2.id });
  assert(s2OnlyEpisodes.episodes.length === 1, 'Filtering episodes by seasonId returns only season 2 episodes');
  assert(s2OnlyEpisodes.episodes[0].number === 17, 'Season 2 episode is #17');

  // -------------------------------------------------------------
  // FOCUS 7: API Response Contracts
  // -------------------------------------------------------------
  console.log('\nTesting Focus 7: API Response Contracts...');
  const mockSuccess = createSuccessResponse({ id: '123' }, { page: 1, limit: 10, total: 1, totalPages: 1, hasNextPage: false, hasPrevPage: false }, false, performance.now());
  const successJson = await mockSuccess.json();
  assert(successJson.success === true, 'Success envelope has success: true');
  assert(successJson.data.id === '123', 'Success envelope contains data');
  assert(successJson.meta.page === 1, 'Success envelope contains pagination meta');
  assert(typeof successJson.executionTimeMs === 'number', 'Success envelope contains executionTimeMs');

  const mockError = createErrorResponse('Item not found', 404, 'NOT_FOUND');
  const errorJson = await mockError.json();
  assert(errorJson.success === false, 'Error envelope has success: false');
  assert(errorJson.error.code === 'NOT_FOUND', 'Error envelope contains code');
  assert(errorJson.error.message === 'Item not found', 'Error envelope contains message');

  // -------------------------------------------------------------
  // FOCUS 8: Query / Filter / Sort Architecture
  // -------------------------------------------------------------
  console.log('\nTesting Focus 8: Query / Filter / Sort Architecture...');
  const sortResDesc = await AnimeCatalogEngine.queryAnimeCatalog({ sortBy: 'score', sortOrder: 'desc', limit: 5 });
  assert(sortResDesc.items.length > 0, 'Sorted catalog query returns items');
  if (sortResDesc.items.length > 1) {
    const s0 = sortResDesc.items[0].score || 0;
    const s1 = sortResDesc.items[1].score || 0;
    assert(s0 >= s1, 'Catalog items are strictly ordered descending by score');
  }

  const sortResYear = await AnimeCatalogEngine.queryAnimeCatalog({ sortBy: 'year', sortOrder: 'desc', limit: 5 });
  assert(sortResYear.items.length > 0, 'Sorted catalog by year returns items');

  // -------------------------------------------------------------
  // FOCUS 9: API Validation
  // -------------------------------------------------------------
  console.log('\nTesting Focus 9: API Validation...');
  const validParams = new URLSearchParams('q=Naruto&genre=Action&year=2020&page=2&limit=25&sortBy=score');
  const validRes = validateAnimeQueryParams(validParams);
  assert(validRes.isValid, 'Valid query parameters pass validation');
  assert(validRes.data.page === 2, 'Parsed page is 2');
  assert(validRes.data.limit === 25, 'Parsed limit is 25');

  const invalidParams = new URLSearchParams('year=-50&page=0&limit=500&season=INVALID_SEASON');
  const invalidRes = validateAnimeQueryParams(invalidParams);
  assert(!invalidRes.isValid, 'Invalid query parameters fail validation');
  assert(Boolean(invalidRes.errors.year), 'Error caught for negative year');
  assert(Boolean(invalidRes.errors.page), 'Error caught for page 0');
  assert(Boolean(invalidRes.errors.limit), 'Error caught for limit > 100');
  assert(Boolean(invalidRes.errors.season), 'Error caught for invalid season');

  const idValidation = validateIdOrSlug('');
  assert(!idValidation.isValid, 'Empty ID fails validation');

  // -------------------------------------------------------------
  // FOCUS 10: API Security (Rate Limiter & Sanitizer)
  // -------------------------------------------------------------
  console.log('\nTesting Focus 10: API Security...');
  const xssInput = '<script>alert("hack")</script>Naruto & Friends';
  const sanitized = sanitizeText(xssInput);
  assert(!sanitized.includes('<script>'), 'XSS script tags are completely stripped');
  assert(sanitized.includes('Naruto &amp; Friends'), 'Ampersands and characters are properly encoded');

  const testIp = `sec_test_ip_${Date.now()}`;
  let allowedCount = 0;
  for (let i = 0; i < 70; i++) {
    const check = RateLimiter.checkRateLimit('SEARCH', testIp, { maxRequests: 60, windowMs: 60000 });
    if (check.allowed) allowedCount++;
  }
  assert(allowedCount === 60, 'RateLimiter strictly blocks requests after limit (60 max allowed)');

  // -------------------------------------------------------------
  // FOCUS 11: API Caching & Tag Invalidation
  // -------------------------------------------------------------
  console.log('\nTesting Focus 11: API Caching...');
  const testCacheKey = `test:anime:${Date.now()}`;
  CacheManager.set(testCacheKey, { cachedValue: 42 }, 60, ['tag:anime:master_test']);
  const cachedVal = CacheManager.get<{ cachedValue: number }>(testCacheKey);
  assert(cachedVal?.cachedValue === 42, 'CacheManager stores and retrieves cached values');

  const purgedCount = CacheManager.invalidateTag('tag:anime:master_test');
  assert(purgedCount >= 1, 'CacheManager invalidates by tag');
  assert(CacheManager.get(testCacheKey) === null, 'Cache key is evicted after tag purge');

  // -------------------------------------------------------------
  // FOCUS 12: API Performance Benchmark
  // -------------------------------------------------------------
  console.log('\nTesting Focus 12: API Performance Benchmark...');
  const t0 = performance.now();
  await AnimeCatalogEngine.getAnimeByIdOrSlug(testAnime.id);
  const dbFetchTime = performance.now() - t0;
  assert(dbFetchTime < 300, `Database fetch completes within performance threshold (${Math.round(dbFetchTime)}ms < 300ms)`);

  // -------------------------------------------------------------
  // FOCUS 13: API Pagination Boundary Handling
  // -------------------------------------------------------------
  console.log('\nTesting Focus 13: API Pagination...');
  const outOfBoundsRes = await AnimeCatalogEngine.queryAnimeCatalog({ page: 99999, limit: 10 });
  assert(outOfBoundsRes.items.length === 0, 'Out-of-bounds page returns empty items array');
  assert(outOfBoundsRes.pagination.hasNextPage === false, 'hasNextPage is false on out-of-bounds page');
  assert(outOfBoundsRes.pagination.hasPrevPage === true, 'hasPrevPage is true on high page numbers');

  // -------------------------------------------------------------
  // FOCUS 14: API Error Handling & Structured Codes
  // -------------------------------------------------------------
  console.log('\nTesting Focus 14: API Error Handling...');
  let notFoundCaught = false;
  try {
    const nonexistent = await SeasonEngine.getAnimeSeasons('nonexistent-anime-id-9999');
  } catch (err: any) {
    notFoundCaught = true;
    assert(err.message === 'Anime not found', 'Appropriate error thrown on non-existent resource');
  }
  assert(notFoundCaught, 'Non-existent season fetch throws catchable error');

  // -------------------------------------------------------------
  // FOCUS 15: API Observability & Telemetry
  // -------------------------------------------------------------
  console.log('\nTesting Focus 15: API Observability...');
  const telemetryRes = createSuccessResponse({ ok: true }, undefined, false, performance.now() - 25);
  const telemetryHeaders = telemetryRes.headers;
  assert(Boolean(telemetryHeaders.get('X-Response-Time-Ms')), 'Response includes X-Response-Time-Ms header');
  assert(telemetryHeaders.get('X-Otakuva-Cache') === 'MISS', 'Cache MISS header is recorded');

  // -------------------------------------------------------------
  // FOCUS 16: Frontend / API Separation
  // -------------------------------------------------------------
  console.log('\nTesting Focus 16: Frontend / API Separation...');
  assert(typeof AnimeCatalogEngine.queryAnimeCatalog === 'function', 'AnimeCatalogEngine exposes query method');
  assert(typeof SeasonEngine.getAnimeSeasons === 'function', 'SeasonEngine exposes seasons method');
  assert(typeof EpisodeEngine.getAnimeEpisodes === 'function', 'EpisodeEngine exposes episodes method');

  // -------------------------------------------------------------
  // FOCUS 17: Integration with Library, Schedule & Progress
  // -------------------------------------------------------------
  console.log('\nTesting Focus 17: Integration with Library, Schedule & Progress...');
  // 1. User watches episode 1
  const watchRes = await toggleEpisodeWatchStatus({
    userId: testUser.id,
    animeId: testAnime.id,
    episodeId: ep1.id,
    status: 'WATCHED',
  });
  assert(watchRes.isWatched === true, 'Episode 1 marked watched');
  assert(watchRes.totalCompleted === 1, 'Total completed episodes is 1');
  assert(watchRes.userAnime.status === 'WATCHING', 'Anime status transitioned to WATCHING in user library');

  // 2. Fetch authenticated episode list and verify isWatched and nextUnwatchedEpisode
  const authEpList = await EpisodeEngine.getAnimeEpisodes(testAnime.id, {}, testUser.id);
  const watchedEp1 = authEpList.episodes.find((e) => e.id === ep1.id);
  const unwatchedEp2 = authEpList.episodes.find((e) => e.id === ep2.id);
  assert(watchedEp1?.isWatched === true, 'Episode 1 reports isWatched: true');
  assert(unwatchedEp2?.isWatched === false, 'Episode 2 reports isWatched: false');
  assert(authEpList.progress?.nextUnwatchedEpisodeId === ep2.id, 'Next unwatched episode resolves to Episode 2');
  assert(authEpList.progress?.watchedCount === 1, 'Watched count is 1');

  } finally {
    // Clean up test fixtures safely in finally block
    if (testUser?.id) {
      await prisma.userEpisodeProgress.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.userAnime.deleteMany({ where: { userId: testUser.id } }).catch(() => {});
      await prisma.user.delete({ where: { id: testUser.id } }).catch(() => {});
    }
    if (testAnime?.id) {
      await prisma.episode.deleteMany({ where: { animeId: testAnime.id } }).catch(() => {});
      await prisma.season.deleteMany({ where: { animeId: testAnime.id } }).catch(() => {});
      await prisma.animeTitle.deleteMany({ where: { animeId: testAnime.id } }).catch(() => {});
      await prisma.animeGenre.deleteMany({ where: { animeId: testAnime.id } }).catch(() => {});
      await prisma.animeTheme.deleteMany({ where: { animeId: testAnime.id } }).catch(() => {});
      await prisma.anime.delete({ where: { id: testAnime.id } }).catch(() => {});
    }
  }

  console.log('\n============================================================');
  console.log(`PHASE 3 MASTER TEST RESULTS: ${passedTests}/${totalTests} PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('============================================================');

  if (passedTests === totalTests) {
    console.log('🎉 ALL 17 FOCUS AREAS VERIFIED AND COMPLIANT WITH OTAKUVA PHASE 3 STANDARDS!');
  } else {
    throw new Error(`Test suite failed: ${totalTests - passedTests} tests failed.`);
  }
}

runPhase3MasterTests()
  .catch((err) => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
