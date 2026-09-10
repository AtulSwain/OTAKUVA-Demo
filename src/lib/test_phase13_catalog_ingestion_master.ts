/**
 * OTAKUVA MASTER TEST SUITE — PHASE 13
 * ANIME CATALOG & DATA INGESTION ENGINE (13.1 → 13.103)
 * 
 * Comprehensive automated verification covering:
 * - 13.1 Provider-Agnostic Architecture & Adapter Registry
 * - 13.2 Data Normalization, Formats, Seasons & Multi-Language Titles
 * - 13.3 Multi-Stage Entity Resolution & Exact ID Deduplication
 * - 13.4 Over-Merge Protections (Sequel, Remake & Format Distinction)
 * - 13.5 Canonical Studio Deduplication & Alias Mapping
 * - 13.6 Canonical Creator & Person Resolution
 * - 13.7 Episode Ingestion, Decimal Numbering & Uniqueness
 * - 13.8 Ingestion Pipeline Idempotency & Provenance
 * - 13.9 5-Dimensional Data Quality Score & Orphan Detection
 * - 13.10 Search Index Synchronization & Real-Time Discovery
 * - 13.11 Admin Duplicate Review & Transactional Safe Merge (User Data Preserved)
 * - 13.12 Failure Queue & Security RBAC Enforcement
 */

import { prisma } from './prisma';
import { ProviderRegistry, CatalogProviderAdapter } from './catalog/providerAdapter';
import { CatalogNormalizer } from './catalog/normalizer';
import { EntityResolver } from './catalog/entityResolver';
import { CanonicalStudioResolver } from './catalog/canonicalStudioResolver';
import { CanonicalCreatorResolver } from './catalog/canonicalCreatorResolver';
import { IngestionPipeline } from './catalog/ingestionPipeline';
import { DataQualityEngine } from './catalog/dataQualityEngine';
import { SearchSyncEngine } from './catalog/searchSync';
import { AdminDuplicateReviewEngine } from './catalog/adminDuplicateReview';
import { searchCatalog } from './search';
import { UserFactory, AnimeFactory, RatingFactory, ReviewFactory, CommunityFactory } from './testing/testFactories';
import { ProviderAnime } from './providers/animeProvider.interface';
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

async function runPhase13MasterTestSuite() {
  const testSuffix = Date.now();
  const malIdBase = 400000 + Math.floor(Math.random() * 50000);
  console.log('========================================================================');
  console.log('OTAKUVA — PHASE 13 ANIME CATALOG & DATA INGESTION MASTER SUITE');
  console.log(`Execution Timestamp: ${new Date().toISOString()}`);
  console.log('========================================================================\n');

  // =========================================================================
  // TEST 1: PROVIDER-AGNOSTIC ADAPTER REGISTRY
  // =========================================================================
  console.log('--- TEST 1: PROVIDER-AGNOSTIC ADAPTER REGISTRY ---');

  const providers = ProviderRegistry.listProviders();
  assert(providers.includes('anilist'), 'ProviderRegistry includes anilist adapter');
  assert(providers.includes('jikan'), 'ProviderRegistry includes jikan adapter');

  const customAdapter: CatalogProviderAdapter = {
    providerName: 'custom_kitsu',
    fetchAnimeDetails: async () => null,
    searchAnime: async () => ({ items: [], pagination: { currentPage: 1, lastVisiblePage: 1, hasNextPage: false } }),
    fetchAnimeList: async () => ({ items: [], pagination: { currentPage: 1, lastVisiblePage: 1, hasNextPage: false } }),
    fetchEpisodes: async () => ({ episodes: [], pagination: { currentPage: 1, lastVisiblePage: 1, hasNextPage: false } }),
    fetchCharacters: async () => [],
    fetchStaff: async () => [],
    fetchRelations: async () => [],
  };
  ProviderRegistry.registerProvider(customAdapter);
  assert(ProviderRegistry.getProvider('custom_kitsu').providerName === 'custom_kitsu', 'Registered custom provider adapter');

  // =========================================================================
  // TEST 2: DATA NORMALIZATION, TAXONOMY & MULTI-LANGUAGE TITLES
  // =========================================================================
  console.log('\n--- TEST 2: DATA NORMALIZATION, TAXONOMY & MULTI-LANGUAGE TITLES ---');

  const rawMockAnime: ProviderAnime = {
    externalId: `mal_${testSuffix}_1`,
    externalSource: 'mal',
    malId: malIdBase,
    title: `Starlight Journey Novel Horizon Alpha`,
    titles: [
      { type: 'english', title: `Starlight Journey Novel Horizon Alpha`, language: 'en' },
      { type: 'japanese', title: `星光の旅 Novel Horizon`, language: 'ja' },
      { type: 'romaji', title: `Seikou no Tabi Horizon`, language: 'ja-ro' },
    ],
    synopsis: 'During their decade-long quest, the hero party defeated the Demon King.',
    type: 'TV Series',
    status: 'Finished Airing',
    season: 'Fall 2023',
    year: 2023,
    episodes: 28,
    score: 9.35,
    posterUrl: 'https://otakuva.test/frieren.jpg',
    genres: ['Adventure', 'Drama', 'Fantasy'],
    themes: ['Magic', 'Historical'],
    studios: [{ name: 'Madhouse', isMain: true }],
    producers: ['TOHO animation', 'Shogakukan'],
    licensors: ['Crunchyroll'],
  };

  const normalized = CatalogNormalizer.normalize(rawMockAnime);
  assert(normalized.type === 'TV', 'Normalized "TV Series" to canonical type TV');
  assert(normalized.status === 'FINISHED', 'Normalized "Finished Airing" to canonical status FINISHED');
  assert(normalized.season === 'FALL', 'Normalized season to canonical FALL');
  assert(normalized.year === 2023, 'Preserved accurate release year 2023');
  assert(normalized.titles.length === 3, 'Extracted 3 multi-language titles (Canonical, Japanese, Romaji)');
  assert(normalized.genres.includes('Fantasy'), 'Extracted canonical Fantasy genre');

  // =========================================================================
  // TEST 3: MULTI-STAGE ENTITY RESOLUTION & EXACT ID DEDUPLICATION
  // =========================================================================
  console.log('\n--- TEST 3: MULTI-STAGE ENTITY RESOLUTION & EXACT ID DEDUPLICATION ---');

  // 1. Ingest initial entity
  const initialIngest = await IngestionPipeline.ingestSingleAnime(rawMockAnime, 'mal');
  assert(initialIngest.success && Boolean(initialIngest.animeId), 'Initial ingestion created or resolved canonical anime');

  // 2. Ingest duplicate with exact MAL ID
  const duplicateWithSameId: ProviderAnime = {
    ...rawMockAnime,
    title: `Frieren: Beyond Journey's End ${testSuffix} (Updated)`,
  };
  const duplicateResolution = await EntityResolver.resolveEntity(CatalogNormalizer.normalize(duplicateWithSameId));
  assert(duplicateResolution.isMatch, 'EntityResolver detected duplicate on exact MAL ID');
  assert(duplicateResolution.canonicalAnimeId === initialIngest.animeId, 'Resolved to original canonical anime ID');
  assert(duplicateResolution.confidence === 'HIGH_CONFIDENCE', 'Confidence is HIGH_CONFIDENCE (1.0)');

  // =========================================================================
  // TEST 4: OVER-MERGE PROTECTIONS (SEQUELS, REMAKES & DERIVATIVES)
  // =========================================================================
  console.log('\n--- TEST 4: OVER-MERGE PROTECTIONS (SEQUELS, REMAKES & DERIVATIVES) ---');

  // Test Season 1 vs Season 2
  const season2Mock: ProviderAnime = {
    ...rawMockAnime,
    externalId: `mal_${testSuffix}_2`,
    malId: malIdBase + 1,
    title: `Frieren: Beyond Journey's End Season 2 ${testSuffix}`,
    year: 2025,
  };
  const season2Resolution = await EntityResolver.resolveEntity(CatalogNormalizer.normalize(season2Mock));
  assert(!season2Resolution.isMatch, 'Over-merge protection prevented merging Season 2 into Season 1');

  // Test Movie adaptation vs TV series
  const movieMock: ProviderAnime = {
    ...rawMockAnime,
    externalId: `mal_${testSuffix}_3`,
    malId: malIdBase + 2,
    title: `Frieren: The Movie ${testSuffix}`,
    type: 'Movie',
    year: 2026,
  };
  const movieResolution = await EntityResolver.resolveEntity(CatalogNormalizer.normalize(movieMock));
  assert(!movieResolution.isMatch, 'Over-merge protection prevented merging Movie into TV series');

  // =========================================================================
  // TEST 5: CANONICAL STUDIO DEDUPLICATION & ALIAS MAPPING
  // =========================================================================
  console.log('\n--- TEST 5: CANONICAL STUDIO DEDUPLICATION & ALIAS MAPPING ---');

  const studio1 = await CanonicalStudioResolver.resolveStudio(`MAPPA Studio ${testSuffix}`);
  assert(Boolean(studio1.studioId), 'Created or resolved canonical Studio');

  const studio2 = await CanonicalStudioResolver.resolveStudio(`MAPPA Studio ${testSuffix} Co., Ltd.`);
  assert(studio2.studioId === studio1.studioId, 'Resolved "Co., Ltd." variant to existing canonical Studio');

  const studio3 = await CanonicalStudioResolver.resolveStudio(`株式会社MAPPA Studio ${testSuffix}`);
  assert(studio3.studioId === studio1.studioId, 'Resolved Japanese legal prefix to existing canonical Studio');

  // =========================================================================
  // TEST 6: CANONICAL CREATOR & PERSON RESOLUTION
  // =========================================================================
  console.log('\n--- TEST 6: CANONICAL CREATOR & PERSON RESOLUTION ---');

  const creator1 = await CanonicalCreatorResolver.resolvePerson({
    externalId: `staff_${testSuffix}_1`,
    name: `Keiichiro Saito Test Director ${testSuffix}`,
    nameKanji: '斎藤 圭一郎',
  });
  assert(Boolean(creator1.personId), 'Created canonical Creator entity');

  const creator2 = await CanonicalCreatorResolver.resolvePerson({
    externalId: `staff_${testSuffix}_1`,
    name: `Keiichiro Saito Test Director ${testSuffix} (Director)`,
  });
  assert(creator2.personId === creator1.personId, 'Resolved creator by external ID avoiding duplication');

  // =========================================================================
  // TEST 7: EPISODE INGESTION & DECIMAL NUMBERING SUPPORT
  // =========================================================================
  console.log('\n--- TEST 7: EPISODE INGESTION & DECIMAL NUMBERING SUPPORT ---');

  const episodesCount = await IngestionPipeline.ingestEpisodes(initialIngest.animeId, [
    { number: 1.0, title: 'The Journey\'s End', synopsis: 'Prologue of Frieren', filler: false, recap: false },
    { number: 1.5, title: 'Special Recap 1', synopsis: 'Mid-season recap', filler: false, recap: true },
    { number: 2.0, title: 'It Didn\'t Have to Be Magic...', synopsis: 'Meeting Fern', filler: false, recap: false },
  ]);
  assert(episodesCount === 3, 'Ingested 3 episodes with decimal recap support');

  const recapEpisode = await prisma.episode.findUnique({
    where: { animeId_number: { animeId: initialIngest.animeId, number: 1.5 } },
  });
  assert(recapEpisode !== null && recapEpisode.recap === true, 'Decimal episode 1.5 stored as recap');

  // =========================================================================
  // TEST 8: INGESTION PIPELINE IDEMPOTENCY & PROVENANCE
  // =========================================================================
  console.log('\n--- TEST 8: INGESTION PIPELINE IDEMPOTENCY & PROVENANCE ---');

  const duplicateIngestResult = await IngestionPipeline.ingestSingleAnime(rawMockAnime, 'mal');
  assert(duplicateIngestResult.success, 'Duplicate ingestion succeeded cleanly');
  assert(!duplicateIngestResult.isNew, 'Idempotency: Recognized existing entity (isNew = false)');
  assert(duplicateIngestResult.animeId === initialIngest.animeId, 'Idempotency: Reused original anime ID');

  const totalAnimeForExternalId = await prisma.animeExternalId.count({
    where: { provider: 'mal', externalId: rawMockAnime.externalId },
  });
  assert(totalAnimeForExternalId === 1, 'Idempotency: Maintained exactly 1 external ID mapping');

  // =========================================================================
  // TEST 9: 5-DIMENSIONAL DATA QUALITY SCORE & ORPHAN DETECTION
  // =========================================================================
  console.log('\n--- TEST 9: 5-DIMENSIONAL DATA QUALITY SCORE & ORPHAN DETECTION ---');

  const qualityScore = DataQualityEngine.evaluateAnimeQuality({
    canonicalTitle: rawMockAnime.title,
    slug: 'frieren-beyond-journeys-end',
    synopsis: rawMockAnime.synopsis,
    type: 'TV',
    status: 'FINISHED',
    episodes: 28,
    year: 2023,
    posterUrl: rawMockAnime.posterUrl,
    genresCount: 3,
    themesCount: 2,
    studiosCount: 1,
    externalIdsCount: 1,
  });

  assert(qualityScore.totalScore >= 90, `Quality Score is high (${qualityScore.totalScore} / 100)`);
  assert(qualityScore.identityScore === 20, 'Identity dimension is maxed (20/20)');
  assert(qualityScore.metadataScore === 25, 'Metadata dimension is maxed (25/25)');

  const qualityReport = await DataQualityEngine.generateQualityReport();
  assert(qualityReport.totalAnimeCount > 0, 'Generated comprehensive catalog quality report');
  assert(qualityReport.orphanIssues.orphanedEpisodes === 0, '0 orphaned episodes detected');

  // =========================================================================
  // TEST 10: SEARCH INDEX SYNCHRONIZATION & DISCOVERY
  // =========================================================================
  console.log('\n--- TEST 10: SEARCH INDEX SYNCHRONIZATION & DISCOVERY ---');

  await SearchSyncEngine.syncAnimeSearchIndex(initialIngest.animeId);

  // Search by exact canonical title
  const searchByTitle = await searchCatalog({ query: `Starlight Journey` });
  assert(searchByTitle.items.some((item) => item.id === initialIngest.animeId), 'Search discovered anime by Canonical Title');

  // Search by Japanese title
  const searchByJapanese = await searchCatalog({ query: `星光の旅` });
  assert(searchByJapanese.items.some((item) => item.id === initialIngest.animeId), 'Search discovered anime by Japanese Title');

  // =========================================================================
  // TEST 11: ADMIN DUPLICATE REVIEW & TRANSACTIONAL SAFE MERGE
  // =========================================================================
  console.log('\n--- TEST 11: ADMIN DUPLICATE REVIEW & TRANSACTIONAL SAFE MERGE ---');

  // 1. Create duplicate anime entities with distinct user data
  const adminUser = await UserFactory.create({ role: 'ADMIN' });
  const regularUser = await UserFactory.create();

  const sourceAnime = await AnimeFactory.create({ canonicalTitle: `Duplicate Anime Source ${testSuffix}` });
  const targetAnime = await AnimeFactory.create({ canonicalTitle: `Canonical Anime Target ${testSuffix}` });

  // Attach ratings, reviews, watch progress, and community link to sourceAnime
  await RatingFactory.create(regularUser.id, sourceAnime.id, 9.5);
  await ReviewFactory.create(regularUser.id, sourceAnime.id, 'Phenomenal story on duplicate record', 10);
  await prisma.userAnime.create({
    data: { userId: regularUser.id, animeId: sourceAnime.id, status: 'WATCHING', episodesWatched: 5 },
  });
  const community = await CommunityFactory.create(adminUser.id, {
    name: `Community for ${testSuffix}`,
    animeId: sourceAnime.id,
  });

  // 2. Execute Administrative Merge
  const mergeResult = await AdminDuplicateReviewEngine.executeMerge(
    sourceAnime.id,
    targetAnime.id,
    adminUser.id,
    'De-duplicating duplicate imported entry'
  );

  assert(mergeResult.success, 'Administrative safe merge executed successfully');
  assert(mergeResult.migratedRatings === 1, '100% User Ratings migrated to canonical anime');
  assert(mergeResult.migratedReviews === 1, '100% User Reviews migrated to canonical anime');
  assert(mergeResult.migratedWatchHistory === 1, '100% User Watch History migrated to canonical anime');

  // 3. Verify user rating is now linked to targetAnime
  const updatedRating = await prisma.animeRating.findUnique({
    where: { userId_animeId: { userId: regularUser.id, animeId: targetAnime.id } },
  });
  assert(updatedRating !== null && updatedRating.rating === 9.5, 'User rating preserved on canonical target');

  // 4. Verify community link is now pointing to targetAnime
  const updatedCommunity = await prisma.community.findUnique({
    where: { id: community.id },
  });
  assert(updatedCommunity?.animeId === targetAnime.id, 'Community discussion relinked to canonical target');

  // 5. Verify source anime is marked as MERGED
  const mergedSource = await prisma.anime.findUnique({ where: { id: sourceAnime.id } });
  assert(mergedSource?.status === 'MERGED', 'Source anime status set to MERGED');

  // =========================================================================
  // TEST 12: SECURITY, RBAC & FAILURE HANDLING
  // =========================================================================
  console.log('\n--- TEST 12: SECURITY, RBAC & FAILURE HANDLING ---');

  assert(!hasMinRole('USER', 'DATA_EDITOR'), 'RBAC: Regular USER denied catalog sync permission');
  assert(hasMinRole('ADMIN', 'DATA_EDITOR'), 'RBAC: ADMIN granted catalog sync permission');
  assert(hasMinRole('SUPER_ADMIN', 'ADMIN'), 'RBAC: SUPER_ADMIN granted catalog merge permission');

  // Ingestion failure queue test
  IngestionPipeline.reset();
  const invalidRawAnime: ProviderAnime = {
    externalId: '',
    externalSource: 'anilist',
    title: '',
    synopsis: '',
    type: 'TV',
    status: 'Finished',
    posterUrl: '',
    genres: [],
    themes: [],
    studios: [],
    producers: [],
    licensors: [],
    titles: [],
  };
  const failedIngest = await IngestionPipeline.ingestSingleAnime(invalidRawAnime);
  assert(!failedIngest.success, 'Invalid raw payload failed safely');
  assert(IngestionPipeline.getFailures().length === 1, 'Failure logged in IngestionFailureQueue');

  // Cleanup transient test artifacts
  await prisma.animeRating.deleteMany({ where: { animeId: { in: [sourceAnime.id, targetAnime.id, initialIngest.animeId] } } });
  await prisma.review.deleteMany({ where: { animeId: { in: [sourceAnime.id, targetAnime.id, initialIngest.animeId] } } });
  await prisma.userAnime.deleteMany({ where: { animeId: { in: [sourceAnime.id, targetAnime.id, initialIngest.animeId] } } });
  await prisma.discussion.deleteMany({ where: { animeId: { in: [sourceAnime.id, targetAnime.id, initialIngest.animeId] } } });
  await prisma.episode.deleteMany({ where: { animeId: { in: [sourceAnime.id, targetAnime.id, initialIngest.animeId] } } });
  await prisma.animeGenre.deleteMany({ where: { animeId: { in: [sourceAnime.id, targetAnime.id, initialIngest.animeId] } } });
  await prisma.animeStudio.deleteMany({ where: { animeId: { in: [sourceAnime.id, targetAnime.id, initialIngest.animeId] } } });
  await prisma.animeTitle.deleteMany({ where: { animeId: { in: [sourceAnime.id, targetAnime.id, initialIngest.animeId] } } });
  await prisma.animeExternalId.deleteMany({ where: { animeId: { in: [sourceAnime.id, targetAnime.id, initialIngest.animeId] } } });
  await prisma.anime.deleteMany({ where: { id: { in: [sourceAnime.id, targetAnime.id, initialIngest.animeId] } } });
  await prisma.communityChannel.deleteMany({ where: { communityId: community.id } });
  await prisma.communityMember.deleteMany({ where: { communityId: community.id } });
  await prisma.community.deleteMany({ where: { id: community.id } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, regularUser.id] } } });

  console.log('\n========================================================================');
  console.log(`PHASE 13 CATALOG INGESTION TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  console.log('========================================================================\n');
}

runPhase13MasterTestSuite().catch((err) => {
  console.error('Phase 13 Master Test Suite fatal error:', err);
  process.exit(1);
});
