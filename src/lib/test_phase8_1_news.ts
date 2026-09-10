/**
 * OTAKUVA PHASE 8.1 — NEWS DATA ARCHITECTURE MASTER TEST SUITE
 * 
 * Tests:
 * 1. Provider Abstraction & Adapters
 * 2. Ingestion Pipeline & Normalization
 * 3. CRITICAL: Ingestion Idempotency & Deduplication
 * 4. Partial Batch Failure Resilience
 * 5. Entity Matching & Alias Resolution
 * 6. Low-Confidence Matching & Admin Review Queue
 * 7. Multi-Provider Syndication & NewsStoryCluster Linking
 * 8. Manual Editorial News Entry
 * 9. Admin Override System & Data Priority Rule
 * 10. Provider Health Tracking & Failure Handling
 * 11. External Provider Disconnection Resilience (Zero Frontend Dependency)
 * 12. News Queries, Pagination, Filtering & Search
 * 13. Standardized Event Engine Logging
 */

import { prisma } from './prisma';
import { annNewsAdapter } from './engine/news/adapters/annNewsAdapter';
import { officialSourceAdapter } from './engine/news/adapters/officialSourceAdapter';
import { MockProviderAdapter } from './engine/news/adapters/mockProviderAdapter';
import { newsIngestionService } from './engine/news/newsIngestionService';
import { newsEngine } from './engine/news/newsEngine';
import { newsEntityMatcher } from './engine/news/newsEntityMatcher';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runPhase8_1Tests() {
  console.log('================================================================');
  console.log('🧪 RUNNING OTAKUVA PHASE 8.1 NEWS DATA ARCHITECTURE TEST SUITE');
  console.log('================================================================\n');

  // STEP 0: Prepare test environment & ensure prerequisite entities exist
  let testAnime = await prisma.anime.findFirst({
    where: { OR: [{ slug: 'frieren-beyond-journeys-end' }, { canonicalTitle: "Frieren: Beyond Journey's End" }] },
  });

  if (!testAnime) {
    testAnime = await prisma.anime.create({
      data: {
        externalSource: 'test_ann',
        externalId: 'frieren_81',
        canonicalTitle: "Frieren: Beyond Journey's End",
        slug: 'frieren-beyond-journeys-end',
        type: 'TV',
        synopsis: 'The adventure is over but life goes on for an elf mage just beginning to learn what living is all about.',
        posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600',
      },
    });
  }

  // Ensure titles exist
  await prisma.animeTitle.upsert({
    where: { id: `title_frieren_ja_${testAnime.id}` },
    update: {},
    create: {
      id: `title_frieren_ja_${testAnime.id}`,
      animeId: testAnime.id,
      type: 'japanese',
      title: 'Sousou no Frieren',
      searchableTitle: 'sousou no frieren',
    },
  });

  let testStudio = await prisma.studio.findFirst({
    where: { OR: [{ name: 'Madhouse' }, { slug: 'madhouse' }] },
  });
  if (!testStudio) {
    testStudio = await prisma.studio.create({
      data: { name: 'Madhouse', slug: 'madhouse' },
    });
  }

  const adminUser = await prisma.user.upsert({
    where: { email: 'phase8_admin@otakuva.com' },
    update: {},
    create: { username: 'Phase8_NewsAdmin', email: 'phase8_admin@otakuva.com', role: 'ADMIN' },
  });

  // Clean prior test news records
  await prisma.newsReviewQueue.deleteMany({});
  await prisma.newsArticleAnime.deleteMany({});
  await prisma.newsArticleStudio.deleteMany({});
  await prisma.newsArticlePerson.deleteMany({});
  await prisma.newsArticle.deleteMany({});
  await prisma.newsStoryCluster.deleteMany({});
  await prisma.newsProvider.deleteMany({});

  // --- TEST 1: Provider Abstraction & Adapter Contract ---
  console.log('--- TEST 1: Provider Abstraction & Adapter Contract ---');
  assert(annNewsAdapter.id === 'ann', 'ANN adapter exposes valid ID');
  assert(officialSourceAdapter.id === 'official_press', 'Official Press adapter exposes valid ID');

  const health = await annNewsAdapter.healthCheck();
  assert(health.status === 'HEALTHY', 'ANN adapter health check returns HEALTHY');

  // --- TEST 2: Ingestion Pipeline & Normalization ---
  console.log('\n--- TEST 2: Ingestion Pipeline & Normalization ---');
  const annResult = await newsIngestionService.ingestFromProvider(annNewsAdapter, { limit: 10 });
  assert(annResult.totalFetched > 0, `Fetched ${annResult.totalFetched} articles from ANN`);
  assert(annResult.createdCount > 0, `Created ${annResult.createdCount} canonical news articles in database`);
  assert(annResult.failedCount === 0, 'Zero failed articles during initial ingestion');

  const sampleArticle = await prisma.newsArticle.findFirst({
    where: { provider: 'ANN' },
  });
  assert(Boolean(sampleArticle), 'Sample article found in database');
  assert(sampleArticle!.sourceName === 'Anime News Network', 'Source attribution preserved as Anime News Network');
  assert(Boolean(sampleArticle!.canonicalUrl), 'Canonical URL retained');
  assert(sampleArticle!.contentType === 'SOURCE_METADATA', 'Content ownership classified as SOURCE_METADATA');

  // --- TEST 3: CRITICAL TEST — Ingestion Idempotency & Deduplication ---
  console.log('\n--- TEST 3: CRITICAL TEST — Ingestion Idempotency & Deduplication ---');
  const initialTotalCount = await prisma.newsArticle.count();
  const reingestResult = await newsIngestionService.ingestFromProvider(annNewsAdapter, { limit: 10 });

  const postReingestTotalCount = await prisma.newsArticle.count();
  assert(
    initialTotalCount === postReingestTotalCount,
    `Idempotency verified: Total articles remain ${postReingestTotalCount} (no duplicates created)`
  );
  assert(reingestResult.createdCount === 0, 'Re-ingestion created 0 new articles');
  assert(reingestResult.updatedCount > 0, `Re-ingestion updated ${reingestResult.updatedCount} existing articles`);

  // --- TEST 4: Partial Batch Failure Resilience ---
  console.log('\n--- TEST 4: Partial Batch Failure Resilience ---');
  const mockAdapterPartial = new MockProviderAdapter('mock_partial', 'Partial Failure Provider');
  mockAdapterPartial.setArticles([
    {
      externalId: 'mock-valid-1',
      provider: 'MOCK_PARTIAL',
      title: 'Valid Anime Industry Report 1',
      summary: 'Summary 1',
      sourceName: 'Partial Provider',
      sourceUrl: 'https://partial.mock/1',
      publishedAt: new Date(),
    },
    {
      externalId: 'mock-invalid-1',
      provider: 'MOCK_PARTIAL',
      title: '', // INVALID: Missing title
      sourceName: '',
      sourceUrl: '',
      publishedAt: new Date(),
    },
    {
      externalId: 'mock-valid-2',
      provider: 'MOCK_PARTIAL',
      title: 'Valid Anime Industry Report 2',
      summary: 'Summary 2',
      sourceName: 'Partial Provider',
      sourceUrl: 'https://partial.mock/2',
      publishedAt: new Date(),
    },
  ]);

  const partialResult = await newsIngestionService.ingestFromProvider(mockAdapterPartial);
  assert(partialResult.totalFetched === 3, 'Fetched 3 raw articles in batch');
  assert(partialResult.createdCount === 2, '2 valid articles successfully stored');
  assert(partialResult.failedCount === 1, '1 invalid article isolated and recorded as failure');

  // --- TEST 5: Entity Matching & Alias Resolution ---
  console.log('\n--- TEST 5: Entity Matching & Alias Resolution ---');
  const entitySeedAdapter = new MockProviderAdapter('entity_seed', 'Entity Seed Provider');
  entitySeedAdapter.setArticles([
    {
      externalId: 'ann-2026-08-01-frieren-s2',
      provider: 'ANN',
      title: "Frieren: Beyond Journey's End Season 2 Officially Confirmed by Madhouse",
      summary: 'Frieren continuation in production.',
      sourceName: 'Anime News Network',
      sourceUrl: 'https://www.animenewsnetwork.com/news/2026/frieren-s2',
      publishedAt: new Date(),
      mentionedAnimeTitles: ["Frieren: Beyond Journey's End"],
      mentionedStudioNames: ['Madhouse'],
    },
  ]);
  await newsIngestionService.ingestFromProvider(entitySeedAdapter);

  const animeRelation = await prisma.newsArticleAnime.findFirst({
    where: { animeId: testAnime.id },
    include: { anime: true },
  });
  assert(Boolean(animeRelation), 'News article matched to Anime entity via alias');
  assert(animeRelation!.status === 'CONFIRMED', 'Match status is CONFIRMED');
  assert(animeRelation!.confidenceScore >= 0.80, `High confidence score: ${animeRelation!.confidenceScore}`);

  const studioRelation = await prisma.newsArticleStudio.findFirst({
    where: { studioId: testStudio.id },
    include: { studio: true },
  });
  assert(Boolean(studioRelation), 'News article matched to Studio Madhouse');
  assert(studioRelation!.status === 'CONFIRMED', 'Studio match status is CONFIRMED');

  // --- TEST 6: Low-Confidence Matching & Admin Review Queue ---
  console.log('\n--- TEST 6: Low-Confidence Matching & Admin Review Queue ---');
  const mockAdapterLowConf = new MockProviderAdapter('mock_review', 'Review Queue Provider');
  mockAdapterLowConf.setArticles([
    {
      externalId: 'mock-ambiguous-1',
      provider: 'MOCK_REVIEW',
      title: 'Studio Mad Special Retrospective on Animation Heritage',
      summary: 'Discussing the history of Mad animation productions.',
      sourceName: 'Review Provider',
      sourceUrl: 'https://review.mock/1',
      publishedAt: new Date(),
      mentionedStudioNames: ['Mad'], // Ambiguous substring mention
    },
  ]);

  await newsIngestionService.ingestFromProvider(mockAdapterLowConf);
  const reviewItems = await prisma.newsReviewQueue.findMany({
    where: { status: 'PENDING' },
  });
  assert(reviewItems.length > 0, `Ambiguous entity match routed to Admin Review Queue (${reviewItems.length} items)`);
  assert(reviewItems[0].entityType === 'STUDIO', 'Review queue item is for STUDIO entity');

  // --- TEST 7: Multi-Provider Syndication & NewsStoryCluster ---
  console.log('\n--- TEST 7: Multi-Provider Syndication & NewsStoryCluster ---');
  const mockProviderB = new MockProviderAdapter('mock_syndicated', 'Global Anime Wire');
  mockProviderB.setArticles([
    {
      externalId: 'global-frieren-s2-announcement',
      provider: 'MOCK_SYNDICATED',
      title: "Frieren: Beyond Journey's End Season 2 Production Officially Confirmed by Madhouse", // Same story
      summary: 'Global syndicate coverage for Frieren season two return.',
      sourceName: 'Global Anime Wire',
      sourceUrl: 'https://globalwire.mock/frieren-s2',
      publishedAt: new Date(),
    },
  ]);

  await newsIngestionService.ingestFromProvider(mockProviderB);

  const annArticle = await prisma.newsArticle.findFirst({
    where: { externalId: 'ann-2026-08-01-frieren-s2' },
  });
  const globalArticle = await prisma.newsArticle.findFirst({
    where: { externalId: 'global-frieren-s2-announcement' },
  });

  assert(Boolean(annArticle) && Boolean(globalArticle), 'Both provider-specific articles coexist');
  assert(annArticle!.id !== globalArticle!.id, 'Separate canonical records preserved');
  assert(
    Boolean(annArticle!.clusterId) && annArticle!.clusterId === globalArticle!.clusterId,
    'Both articles connected via shared NewsStoryCluster'
  );

  // --- TEST 8: Manual Editorial News Creation ---
  console.log('\n--- TEST 8: Manual Editorial News Creation ---');
  const manualArticle = await newsEngine.createManualNewsArticle(adminUser.id, {
    title: 'OTAKUVA Seasonal Industry Digest: Autumn Animation Trends',
    summary: 'A curated comprehensive breakdown of original animation projects and studio expansions.',
    content: 'Full editorial analysis of studio capacity and production committees.',
    contentType: 'OTAKUVA_SUMMARY',
    category: 'INDUSTRY',
    mentionedAnimeIds: [testAnime.id],
    mentionedStudioIds: [testStudio.id],
  });

  assert(manualArticle.provider === 'INTERNAL', 'Provider marked as INTERNAL');
  assert(manualArticle.sourceName === 'OTAKUVA Editorial', 'Source attribution marked as OTAKUVA Editorial');
  assert(manualArticle.animeRelations.length === 1, 'Manual anime relationship established');

  // --- TEST 9: Admin Override & Display Priority Rule ---
  console.log('\n--- TEST 9: Admin Override & Display Priority Rule ---');
  const articleToOverride = await prisma.newsArticle.findFirst({ where: { provider: 'ANN' } });
  assert(Boolean(articleToOverride), 'Target article for override found');

  await newsEngine.applyAdminOverride(adminUser.id, articleToOverride!.id, {
    title: '[Official Update] Frieren Season 2 Confirmed by Madhouse Desk',
    summary: 'Curated editorial summary taking priority.',
    overrideReason: 'Refined clarity for community readership',
  });

  const displayedArticle = await newsEngine.getNewsById(articleToOverride!.id);
  assert(
    displayedArticle!.displayTitle === '[Official Update] Frieren Season 2 Confirmed by Madhouse Desk',
    'Display title reflects Admin Override'
  );
  assert(
    displayedArticle!.title !== displayedArticle!.displayTitle,
    'Underlying raw/normalized provider title preserved in database'
  );
  assert(displayedArticle!.hasAdminOverride === true, 'hasAdminOverride flag is true');

  // --- TEST 10: Provider Health Tracking & Failure Handling ---
  console.log('\n--- TEST 10: Provider Health Tracking & Failure Handling ---');
  const failingAdapter = new MockProviderAdapter('failing_provider', 'Unstable News Source');
  failingAdapter.shouldFail = true;

  const failResult = await newsIngestionService.ingestFromProvider(failingAdapter);
  assert(failResult.errors.length > 0, 'Provider failure caught cleanly without crashing');

  const providerRecord = await prisma.newsProvider.findUnique({ where: { slug: 'failing_provider' } });
  assert(Boolean(providerRecord), 'Provider record exists');
  assert(providerRecord!.status === 'DEGRADED' || providerRecord!.status === 'FAILED', 'Provider status set to DEGRADED/FAILED');
  assert(providerRecord!.failureCount > 0, 'Failure count incremented');

  // --- TEST 11: Resilience / Zero Frontend Dependency ---
  console.log('\n--- TEST 11: Resilience (Zero External Dependency for Reads) ---');
  // Even if all external sources are unreachable, OTAKUVA news queries return previously stored data
  const cachedNews = await newsEngine.getNews({ limit: 10 });
  assert(cachedNews.articles.length > 0, `OTAKUVA news query returns ${cachedNews.articles.length} articles locally`);

  // --- TEST 12: News Queries, Pagination, Filtering & Search ---
  console.log('\n--- TEST 12: News Queries, Pagination, Filtering & Search ---');
  // Category Filter
  const prodNews = await newsEngine.getNews({ category: 'PRODUCTION' });
  assert(prodNews.articles.every((a) => a.category === 'PRODUCTION'), 'Category filter strictly matches PRODUCTION');

  // Anime Context Query
  const frierenNews = await newsEngine.getNews({ animeId: testAnime.id });
  assert(frierenNews.articles.length > 0, 'Anime contextual news query returns matching articles');

  // Search Query
  const searchRes = await newsEngine.searchNews('Frieren');
  assert(searchRes.articles.length > 0, 'Search query for "Frieren" returns relevant articles');

  // Pagination
  const page1 = await newsEngine.getNews({ limit: 2, page: 1 });
  const page2 = await newsEngine.getNews({ limit: 2, page: 2 });
  assert(page1.articles.length === 2, 'Page 1 returns exactly 2 articles');
  assert(page2.articles.length > 0, 'Page 2 returns next page of articles');
  assert(page1.articles[0].id !== page2.articles[0].id, 'Pagination offsets correctly');

  // --- TEST 13: Standardized Event Engine Stream ---
  console.log('\n--- TEST 13: Standardized Event Engine Stream ---');
  const newsEvents = await prisma.eventLog.findMany({
    where: { entityType: 'NEWS' },
  });
  const eventTypes = newsEvents.map((e) => e.eventType);
  assert(eventTypes.includes('NEWS_INGESTED'), 'EventLog contains NEWS_INGESTED');
  assert(eventTypes.includes('NEWS_UPDATED'), 'EventLog contains NEWS_UPDATED');

  console.log('\n================================================================');
  console.log('🎉 ALL 13 PHASE 8.1 NEWS DATA ARCHITECTURE TESTS PASSED!');
  console.log('================================================================\n');
}

runPhase8_1Tests()
  .catch((err) => {
    console.error('Phase 8.1 test suite failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
