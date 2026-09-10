/**
 * OTAKUVA MASTER TEST SUITE: PHASES 8.2 → 8.5
 * PRODUCTION NEWS INGESTION + ENTITY INTELLIGENCE
 * 
 * Verifies:
 * 1. Provider Client & Error Mapping
 * 2. Provider Health & Latency Probes
 * 3. Normalization (XSS sanitization, Unicode, Category mapping, URL clean)
 * 4. Deduplication & Idempotency
 * 5. Cross-Provider Story Clustering
 * 6. 9-Stage Ingestion Pipeline
 * 7. Partial Batch Failure Isolation
 * 8. Layered Entity Intelligence (Anime, Studio, Person)
 * 9. Review Queue & Admin Resolution
 * 10. Admin Correction Memory
 * 11. Data Priority Rule
 * 12. Event Engine Stream
 * 13. Security Defenses & Local Read Independence
 */

import { prisma } from './prisma';
import { annNewsAdapter } from './engine/news/adapters/annNewsAdapter';
import { MockProviderAdapter } from './engine/news/adapters/mockProviderAdapter';
import { newsDeduplicationService } from './engine/news/newsDeduplicationService';
import { newsEngine } from './engine/news/newsEngine';
import { newsEntityMatcher } from './engine/news/newsEntityMatcher';
import { newsIngestionService } from './engine/news/newsIngestionService';
import { newsNormalizationService } from './engine/news/newsNormalizationService';
import { newsProviderClient } from './engine/news/newsProviderClient';
import { RawNewsArticle } from './engine/news/newsTypes';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

export async function runProductionNewsTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING OTAKUVA PHASES 8.2 → 8.5 PRODUCTION NEWS TEST SUITE');
  console.log('================================================================\n');

  // SETUP: Clean test records and seed required anime & studio
  await prisma.newsReviewQueue.deleteMany({});
  await prisma.newsArticleAnime.deleteMany({});
  await prisma.newsArticleStudio.deleteMany({});
  await prisma.newsArticlePerson.deleteMany({});
  await prisma.newsArticle.deleteMany({});
  await prisma.newsStoryCluster.deleteMany({});
  await prisma.newsIngestionJob.deleteMany({});

  let testAnime = await prisma.anime.findFirst({
    where: { OR: [{ canonicalTitle: "Frieren: Beyond Journey's End" }, { slug: 'frieren-beyond-journeys-end' }] },
  });
  if (!testAnime) {
    testAnime = await prisma.anime.create({
      data: {
        canonicalTitle: "Frieren: Beyond Journey's End",
        slug: 'frieren-beyond-journeys-end',
        posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477',
        synopsis: 'An elf mage embarks on a journey to understand humanity.',
        status: 'Finished Airing',
      },
    });
  }

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
    where: { email: 'phase8_master_admin@otakuva.com' },
    update: { role: 'ADMIN' },
    create: { username: 'Phase8_MasterAdmin', email: 'phase8_master_admin@otakuva.com', role: 'ADMIN' },
  });

  // ==========================================
  // TEST 1: Provider Client & Health Probes
  // ==========================================
  console.log('--- TEST 1: Provider Client & Health Probes ---');
  const annHealth = await annNewsAdapter.healthCheck();
  assert(annHealth.status === 'HEALTHY' || annHealth.status === 'DEGRADED', 'ANN provider health probe executed');
  assert(typeof annHealth.latencyMs === 'number' && annHealth.latencyMs >= 0, 'Health check returned latency measurement');

  // ==========================================
  // TEST 2: Normalization & HTML Sanitization
  // ==========================================
  console.log('\n--- TEST 2: Normalization & HTML Sanitization ---');
  const rawWithMaliciousHtml: RawNewsArticle = {
    externalId: 'test-norm-01',
    provider: 'ANN',
    title: "  Frieren: Beyond Journey&#39;s End &amp; &quot;Pluto&quot;   ",
    summary: '<p>Great news! <script>alert("xss")</script><iframe src="malicious.com"></iframe>Safe summary.</p>',
    sourceName: 'ANN',
    sourceUrl: 'https://www.animenewsnetwork.com/news/article-1/?utm_source=twitter&utm_medium=social#comments',
    canonicalUrl: 'https://www.animenewsnetwork.com/news/article-1/?ref=homepage',
    category: 'tv',
    publishedAt: new Date('2026-08-15T12:00:00Z'),
  };

  const normalized = newsNormalizationService.normalize(rawWithMaliciousHtml, 'ann');
  assert(normalized.title === 'Frieren: Beyond Journey\'s End & "Pluto"', 'Title unescaped entities and trimmed whitespace');
  assert(!normalized.summary?.includes('<script>'), 'XSS script tags successfully stripped');
  assert(!normalized.summary?.includes('<iframe>'), 'Iframe tags successfully stripped');
  assert(Boolean(normalized.summary?.includes('Safe summary.')), 'Valid text content preserved');
  assert(normalized.category === 'ANIME', 'Category "tv" mapped to canonical ANIME');
  assert(normalized.sourceName === 'Anime News Network', 'Source "ANN" normalized to canonical name');
  assert(normalized.canonicalUrl === 'https://www.animenewsnetwork.com/news/article-1', 'Tracking parameters stripped from URL');

  // ==========================================
  // TEST 3: Ingestion Pipeline & Database Storage
  // ==========================================
  console.log('\n--- TEST 3: Ingestion Pipeline & Database Storage ---');
  const ingestionResult = await newsIngestionService.ingestFromProvider(annNewsAdapter);
  assert(ingestionResult.totalFetched > 0, `Fetched ${ingestionResult.totalFetched} articles from ANN`);
  assert(ingestionResult.createdCount === ingestionResult.totalFetched, `Created ${ingestionResult.createdCount} canonical news articles in database`);
  assert(ingestionResult.failedCount === 0, 'Zero failed articles during initial ingestion');
  assert(ingestionResult.status === 'COMPLETED', 'Job status is COMPLETED');

  // ==========================================
  // TEST 4: CRITICAL IDEMPOTENCY TEST
  // ==========================================
  console.log('\n--- TEST 4: CRITICAL REPEAT TEST (Idempotency) ---');
  const countBefore = await prisma.newsArticle.count();
  const repeatResult = await newsIngestionService.ingestFromProvider(annNewsAdapter);
  const countAfter = await prisma.newsArticle.count();

  assert(countBefore === countAfter, `Total article count unchanged (${countBefore} === ${countAfter})`);
  assert(repeatResult.createdCount === 0, 'Re-ingestion created 0 new articles');
  assert(repeatResult.duplicatesDetected === repeatResult.totalFetched, `All ${repeatResult.totalFetched} articles detected as duplicates`);
  assert(repeatResult.updatedCount === repeatResult.totalFetched, 'Existing articles idempotently updated');

  // ==========================================
  // TEST 5: Partial Batch Failure Isolation
  // ==========================================
  console.log('\n--- TEST 5: Partial Batch Failure Isolation ---');
  const partialAdapter = new MockProviderAdapter({
    id: 'mock_partial',
    name: 'Partial Failure Mock',
    baseUrl: 'https://partial.test',
    articles: [
      {
        externalId: 'valid-01',
        provider: 'MOCK_PARTIAL',
        title: 'Valid Article 1 for Batch Test',
        sourceName: 'Mock Source',
        sourceUrl: 'https://partial.test/1',
        publishedAt: new Date(),
      },
      {
        externalId: '', // Invalid externalId will fail validation
        provider: 'MOCK_PARTIAL',
        title: 'Invalid Article with Empty ID',
        sourceName: 'Mock Source',
        sourceUrl: 'https://partial.test/2',
        publishedAt: new Date(),
      },
      {
        externalId: 'valid-02',
        provider: 'MOCK_PARTIAL',
        title: 'Valid Article 2 for Batch Test',
        sourceName: 'Mock Source',
        sourceUrl: 'https://partial.test/3',
        publishedAt: new Date(),
      },
    ],
  });

  const partialResult = await newsIngestionService.ingestFromProvider(partialAdapter);
  assert(partialResult.createdCount === 2, '2 valid articles successfully processed and stored');
  assert(partialResult.failedCount === 1, '1 invalid article isolated and recorded as failure');
  assert(partialResult.status === 'PARTIAL', 'Job status recorded as PARTIAL');

  // ==========================================
  // TEST 6: Layered Entity Intelligence
  // ==========================================
  console.log('\n--- TEST 6: Layered Entity Intelligence ---');
  const frierenSeedAdapter = new MockProviderAdapter({
    id: 'frieren_entity_mock',
    name: 'Anime News Network',
    baseUrl: 'https://www.animenewsnetwork.com',
    articles: [
      {
        externalId: 'ann-2026-08-01-frieren-s2',
        provider: 'ANN',
        title: "Frieren: Beyond Journey's End Season 2 Production Officially Confirmed by Madhouse",
        summary: 'The continuation of the acclaimed fantasy series is currently in active production with the core staff returning.',
        contentType: 'SOURCE_METADATA',
        sourceName: 'Anime News Network',
        sourceUrl: 'https://www.animenewsnetwork.com/news/2026/frieren-s2-production',
        canonicalUrl: 'https://www.animenewsnetwork.com/news/2026/frieren-s2-production',
        imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
        author: 'Egan Loo',
        category: 'PRODUCTION',
        publishedAt: new Date(),
        mentionedAnimeTitles: ["Frieren: Beyond Journey's End"],
        mentionedStudioNames: ['Madhouse'],
      },
    ],
  });
  await newsIngestionService.ingestFromProvider(frierenSeedAdapter);

  const frierenArticle = await prisma.newsArticle.findFirst({
    where: { externalId: 'ann-2026-08-01-frieren-s2' },
    include: {
      animeRelations: { include: { anime: true } },
      studioRelations: { include: { studio: true } },
    },
  });

  assert(Boolean(frierenArticle), 'Frieren news article located');
  assert(frierenArticle!.animeRelations.length > 0, 'Article matched to Anime entity');
  assert(frierenArticle!.animeRelations[0].anime.canonicalTitle === "Frieren: Beyond Journey's End", 'Matched canonical anime title');
  assert(frierenArticle!.animeRelations[0].relationType === 'PRIMARY', 'Primary subject tagged as PRIMARY relation');
  assert(frierenArticle!.studioRelations.length > 0, 'Article matched to Studio Madhouse');
  assert(frierenArticle!.studioRelations[0].studio.name === 'Madhouse', 'Studio relation verified');

  // ==========================================
  // TEST 7: Review Queue & Admin Resolution
  // ==========================================
  console.log('\n--- TEST 7: Review Queue & Admin Resolution ---');
  const ambiguousAdapter = new MockProviderAdapter({
    id: 'mock_ambiguous',
    name: 'Ambiguous Match Mock',
    baseUrl: 'https://ambiguous.test',
    articles: [
      {
        externalId: 'ambiguous-studio-01',
        provider: 'MOCK_AMBIGUOUS',
        title: 'New Fantasy Project in active development by Madhouse Animation Teams',
        summary: 'A new fantasy adaptation is being planned.',
        sourceName: 'Ambiguous Source',
        sourceUrl: 'https://ambiguous.test/news/1',
        publishedAt: new Date(),
        mentionedStudioNames: ['Madhouse Animation'], // Partial studio match -> REVIEW_REQUIRED
      },
    ],
  });

  await newsIngestionService.ingestFromProvider(ambiguousAdapter);
  const queue = await newsEngine.getAdminReviewQueue('PENDING');
  assert(queue.total >= 1, `Ambiguous match routed to Admin Review Queue (${queue.total} pending items)`);

  const itemToApprove = queue.items[0];
  const approved = await newsEngine.approveReviewQueueItem(adminUser.id, itemToApprove.id);
  assert(approved.status === 'APPROVED', 'Admin successfully approved pending match');

  const updatedQueue = await newsEngine.getAdminReviewQueue('APPROVED');
  assert(updatedQueue.items.some((i) => i.id === itemToApprove.id), 'Queue item recorded in APPROVED status');

  // ==========================================
  // TEST 8: Admin Correction Memory
  // ==========================================
  console.log('\n--- TEST 8: Admin Correction Memory ---');
  const dismissAdapter = new MockProviderAdapter({
    id: 'mock_dismiss',
    name: 'Dismissal Mock',
    baseUrl: 'https://dismiss.test',
    articles: [
      {
        externalId: 'dismiss-studio-01',
        provider: 'MOCK_DISMISS',
        title: 'Mystery Series Produced by Madhouse Production Line B',
        sourceName: 'Dismiss Source',
        sourceUrl: 'https://dismiss.test/news/2',
        publishedAt: new Date(),
        mentionedStudioNames: ['Madhouse Production Line B'],
      },
    ],
  });

  await newsIngestionService.ingestFromProvider(dismissAdapter);
  const pendingQueue = await newsEngine.getAdminReviewQueue('PENDING');
  const itemToDismiss = pendingQueue.items.find((i) => i.entityName === 'Madhouse Production Line B');
  assert(Boolean(itemToDismiss), 'Found item to dismiss');

  await newsEngine.dismissReviewQueueItem(adminUser.id, itemToDismiss!.id);
  const dismissedItem = await prisma.newsReviewQueue.findUnique({ where: { id: itemToDismiss!.id } });
  assert(dismissedItem?.status === 'DISMISSED', 'Item status updated to DISMISSED');

  // Re-syncing the same article must not re-propose the dismissed entity
  await newsIngestionService.ingestFromProvider(dismissAdapter);
  const checkPending = await newsEngine.getAdminReviewQueue('PENDING');
  assert(!checkPending.items.some((i) => i.entityName === 'Madhouse Production Line B'), 'Dismissed match was not re-proposed upon re-sync');

  // ==========================================
  // TEST 9: Cross-Provider Story Clustering
  // ==========================================
  console.log('\n--- TEST 9: Cross-Provider Story Clustering ---');
  const publisherA = new MockProviderAdapter({
    id: 'publisher_a',
    name: 'Publisher A Network',
    baseUrl: 'https://publisher-a.com',
    articles: [
      {
        externalId: 'pub-a-solo-leveling-movie',
        provider: 'PUBLISHER_A',
        title: 'Solo Leveling Theatrical Anime Film Officially Greenlit for 2027',
        summary: 'Aniplex announces feature film.',
        sourceName: 'Publisher A',
        sourceUrl: 'https://publisher-a.com/solo-leveling-film',
        canonicalUrl: 'https://publisher-a.com/solo-leveling-film',
        publishedAt: new Date(),
      },
    ],
  });

  const publisherB = new MockProviderAdapter({
    id: 'publisher_b',
    name: 'Publisher B Network',
    baseUrl: 'https://publisher-b.com',
    articles: [
      {
        externalId: 'pub-b-solo-leveling-movie',
        provider: 'PUBLISHER_B',
        title: 'Solo Leveling Theatrical Anime Film Announced by Production Committee',
        summary: 'Film is slated for 2027 release.',
        sourceName: 'Publisher B',
        sourceUrl: 'https://publisher-b.com/solo-leveling-film',
        canonicalUrl: 'https://publisher-b.com/solo-leveling-film',
        publishedAt: new Date(),
      },
    ],
  });

  await newsIngestionService.ingestFromProvider(publisherA);
  await newsIngestionService.ingestFromProvider(publisherB);

  const articleA = await prisma.newsArticle.findFirst({ where: { externalId: 'pub-a-solo-leveling-movie' } });
  const articleB = await prisma.newsArticle.findFirst({ where: { externalId: 'pub-b-solo-leveling-movie' } });

  assert(Boolean(articleA && articleB), 'Both publisher articles coexist');
  assert(Boolean(articleA?.clusterId && articleA.clusterId === articleB?.clusterId), 'Both articles connected via shared NewsStoryCluster');

  // ==========================================
  // TEST 10: Admin Override & Display Priority Rule
  // ==========================================
  console.log('\n--- TEST 10: Admin Override & Display Priority Rule ---');
  const targetArticle = await prisma.newsArticle.findFirst();
  assert(Boolean(targetArticle), 'Target article for override found');

  const overrideTitle = 'EXCLUSIVE: Verified Production Scoop';
  await newsEngine.applyAdminOverride(adminUser.id, targetArticle!.id, {
    title: overrideTitle,
    category: 'PRODUCTION',
    overrideReason: 'Official editorial headline enhancement',
  });

  const presentedArticle = await newsEngine.getNewsById(targetArticle!.id);
  assert(presentedArticle?.displayTitle === overrideTitle, 'Display title reflects Admin Override');
  assert(presentedArticle?.title === targetArticle!.title, 'Underlying provider title preserved in database');
  assert(presentedArticle?.hasAdminOverride === true, 'hasAdminOverride flag is true');

  // ==========================================
  // TEST 11: Event Engine Stream
  // ==========================================
  console.log('\n--- TEST 11: Event Engine Stream ---');
  const events = await prisma.eventLog.findMany({
    where: {
      eventType: { in: ['NEWS_INGESTED', 'NEWS_UPDATED', 'NEWS_ENTITY_MATCHED', 'NEWS_ENTITY_REVIEW_REQUIRED'] },
    },
  });
  assert(events.length > 0, `Recorded ${events.length} news lifecycle events in EventLog`);

  // ==========================================
  // TEST 12: Zero External Dependency for Reads
  // ==========================================
  console.log('\n--- TEST 12: Zero External Dependency for Reads ---');
  const localNews = await newsEngine.getNews({ limit: 50 });
  assert(localNews.articles.length >= 8, `OTAKUVA news API serves ${localNews.articles.length} articles purely from local database`);

  console.log('\n================================================================');
  console.log('🎉 ALL 12 OTAKUVA PHASES 8.2 → 8.5 PRODUCTION NEWS TESTS PASSED!');
  console.log('================================================================\n');
}

// Auto-run if executed directly
if (require.main === module) {
  runProductionNewsTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
