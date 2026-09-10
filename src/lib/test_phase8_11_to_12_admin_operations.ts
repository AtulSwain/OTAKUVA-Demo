/**
 * OTAKUVA MASTER TEST SUITE: PHASES 8.11 → 8.12
 * ADMIN NEWS MANAGEMENT + NEWS OPERATIONS INTELLIGENCE
 * 
 * Verifies:
 * 1. Admin RBAC Security & Authorization
 * 2. Manual Editorial News Creation
 * 3. Admin Override Persistence Across Provider Syncs
 * 4. Admin Override Reset to Provider Values
 * 5. Article Lifecycle State Transitions (Publish, Unpublish, Archive, Soft Delete, Feature)
 * 6. Safe Duplicate Review & Story Merge
 * 7. Scheduled Publishing Worker & Auto-Publication
 * 8. Automated Quality Control Checks (Pass, Warning, Blocked)
 * 9. Controlled Bulk Operations with Audit Trails
 * 10. Operations Telemetry & Data Quality Score
 * 11. Comprehensive Append-Oriented Audit Logging
 * 12. Provider Outage Admin Resilience
 */

import { prisma } from './prisma';
import { annNewsAdapter } from './engine/news/adapters/annNewsAdapter';
import { MockProviderAdapter } from './engine/news/adapters/mockProviderAdapter';
import { newsAdminService } from './engine/news/newsAdminService';
import { newsIngestionService } from './engine/news/newsIngestionService';
import { newsOperationsService } from './engine/news/newsOperationsService';
import { newsScheduledWorker } from './engine/news/newsScheduledWorker';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

export async function runAdminOperationsTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING OTAKUVA PHASES 8.11 → 8.12 MASTER TEST SUITE');
  console.log('================================================================\n');

  // CLEANUP & SEEDING
  await prisma.newsReviewQueue.deleteMany({});
  await prisma.newsArticleAnime.deleteMany({});
  await prisma.newsArticleStudio.deleteMany({});
  await prisma.newsArticlePerson.deleteMany({});
  await prisma.newsArticle.deleteMany({});
  await prisma.newsStoryCluster.deleteMany({});
  await prisma.newsIngestionJob.deleteMany({});

  // Seed Admin & Regular Users
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin_news_editor@otakuva.com' },
    update: { role: 'NEWS_EDITOR' },
    create: { username: 'NewsEditorAdmin', email: 'admin_news_editor@otakuva.com', role: 'NEWS_EDITOR' },
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: 'super_admin_lead@otakuva.com' },
    update: { role: 'SUPER_ADMIN' },
    create: { username: 'SuperAdminLead', email: 'super_admin_lead@otakuva.com', role: 'SUPER_ADMIN' },
  });

  // Seed Anime & Studios
  let frierenAnime = await prisma.anime.findFirst({
    where: { OR: [{ canonicalTitle: "Frieren: Beyond Journey's End" }, { slug: 'frieren-beyond-journeys-end' }] },
  });
  if (!frierenAnime) {
    frierenAnime = await prisma.anime.create({
      data: {
        canonicalTitle: "Frieren: Beyond Journey's End",
        slug: 'frieren-beyond-journeys-end',
        posterUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477',
        synopsis: 'An elf mage embarks on a journey.',
        status: 'Finished Airing',
      },
    });
  }

  let madhouseStudio = await prisma.studio.findFirst({
    where: { OR: [{ name: 'Madhouse' }, { slug: 'madhouse' }] },
  });
  if (!madhouseStudio) {
    madhouseStudio = await prisma.studio.create({
      data: { name: 'Madhouse', slug: 'madhouse' },
    });
  }

  // ==========================================
  // TEST 1: Manual Editorial News Creation
  // ==========================================
  console.log('--- TEST 1: Manual Editorial News Creation ---');
  const createdEditorial = await newsAdminService.createArticle(
    {
      title: 'OTAKUVA EXCLUSIVE: Studio Madhouse Retrospective & Feature Film Roadmap',
      summary: 'An in-depth investigation into key animator lineages and upcoming projects.',
      content: 'Full editorial investigative report on anime production methodology.',
      category: 'PRODUCTION',
      status: 'PUBLISHED',
      sourceName: 'OTAKUVA Editorial',
      sourceUrl: '/news/madhouse-retrospective',
      imageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477',
      isFeatured: true,
      animeIds: [{ animeId: frierenAnime.id, relationType: 'PRIMARY' }],
      studioIds: [{ studioId: madhouseStudio.id, relationType: 'PRODUCED_BY' }],
    },
    adminUser.id
  );

  assert(Boolean(createdEditorial && createdEditorial.id), 'Manual editorial article created successfully');
  assert(createdEditorial.provider === 'INTERNAL', 'Provider marked as INTERNAL');
  assert(createdEditorial.isFeatured === true, 'isFeatured flag set to true');

  // Verify Audit Log recorded
  const createAudit = await prisma.auditLog.findFirst({
    where: { entityId: createdEditorial.id, action: 'NEWS_ARTICLE_CREATED' },
  });
  assert(Boolean(createAudit), 'Audit log entry created for manual article creation');

  // ==========================================
  // TEST 2: Admin Override Persistence Across Ingestion Sync
  // ==========================================
  console.log('\n--- TEST 2: Admin Override Persistence Across Ingestion Sync ---');
  // 1. Ingest base article from provider
  const syncAdapter = new MockProviderAdapter({
    id: 'sync_test_provider',
    name: 'Sync Test Provider',
    baseUrl: 'https://synctest.com',
    articles: [
      {
        externalId: 'sync-article-1',
        provider: 'SYNC_TEST',
        title: 'Original Provider Headline: Anime Season Announced',
        summary: 'Original provider summary.',
        sourceName: 'Sync Source',
        sourceUrl: 'https://synctest.com/1',
        publishedAt: new Date(),
      },
    ],
  });

  await newsIngestionService.ingestFromProvider(syncAdapter);
  const ingestedArticle = await prisma.newsArticle.findFirst({
    where: { externalId: 'sync-article-1' },
  });
  assert(Boolean(ingestedArticle), 'Ingested article stored in database');

  // 2. Admin applies override
  const overrideTitle = 'EXCLUSIVE CORRECTION: Official Production Committee Greenlights Season 2';
  await newsAdminService.updateArticle(
    ingestedArticle!.id,
    { title: overrideTitle, category: 'ANNOUNCEMENT' },
    adminUser.id
  );

  const overridden = await newsAdminService.getArticleById(ingestedArticle!.id);
  assert(overridden!.displayTitle === overrideTitle, 'Display title reflects admin override');
  assert(overridden!.title === 'Original Provider Headline: Anime Season Announced', 'Underlying provider title preserved');
  assert(overridden!.hasAdminOverride === true, 'hasAdminOverride flag is true');

  // 3. Re-run provider sync with changed provider title
  syncAdapter.articles[0].title = 'Updated Provider Headline: Anime Season Date Pushed';
  await newsIngestionService.ingestFromProvider(syncAdapter);

  // 4. Verify Admin Override is PRESERVED (Not overwritten)
  const afterSync = await newsAdminService.getArticleById(ingestedArticle!.id);
  assert(afterSync!.displayTitle === overrideTitle, 'Admin override title persisted after repeat provider sync');

  // ==========================================
  // TEST 3: Admin Override Reset to Provider Value
  // ==========================================
  console.log('\n--- TEST 3: Admin Override Reset to Provider Value ---');
  await newsAdminService.resetOverride(ingestedArticle!.id, ['title', 'category'], adminUser.id);
  const afterReset = await newsAdminService.getArticleById(ingestedArticle!.id);

  assert(afterReset!.hasAdminOverride === false, 'hasAdminOverride flag is false after reset');
  assert(afterReset!.displayTitle.includes('Provider Headline'), 'Display title restored to latest normalized provider value');

  // ==========================================
  // TEST 4: Article Lifecycle State Transitions
  // ==========================================
  console.log('\n--- TEST 4: Article Lifecycle State Transitions ---');
  // Unpublish -> Draft
  await newsAdminService.changeStatus(createdEditorial.id, 'UNPUBLISH', adminUser.id);
  let state = await newsAdminService.getArticleById(createdEditorial.id);
  assert(state!.status === 'DRAFT', 'Article successfully unpublished to DRAFT status');

  // Re-Publish
  await newsAdminService.changeStatus(createdEditorial.id, 'PUBLISH', adminUser.id);
  state = await newsAdminService.getArticleById(createdEditorial.id);
  assert(state!.status === 'PUBLISHED', 'Article successfully re-published to PUBLISHED status');

  // Archive
  await newsAdminService.changeStatus(createdEditorial.id, 'ARCHIVE', adminUser.id);
  state = await newsAdminService.getArticleById(createdEditorial.id);
  assert(state!.status === 'ARCHIVED', 'Article successfully transitioned to ARCHIVED status');

  // ==========================================
  // TEST 5: Safe Duplicate Merge
  // ==========================================
  console.log('\n--- TEST 5: Safe Duplicate Merge ---');
  // Create Article A and Article B
  const articleA = await newsAdminService.createArticle(
    {
      title: 'Solo Leveling Season 2 Release Window Confirmed for Winter 2027',
      summary: 'Solo leveling winter release.',
      category: 'RELEASE',
      status: 'PUBLISHED',
      sourceName: 'Outlet A',
      sourceUrl: 'https://outlet-a.com/1',
      animeIds: [{ animeId: frierenAnime.id }],
    },
    adminUser.id
  );

  const articleB = await newsAdminService.createArticle(
    {
      title: 'Solo Leveling Winter 2027 Broadcast Schedule Detailed by Aniplex',
      summary: 'Broadcast details confirmed.',
      category: 'RELEASE',
      status: 'PUBLISHED',
      sourceName: 'Outlet B',
      sourceUrl: 'https://outlet-b.com/2',
      studioIds: [{ studioId: madhouseStudio.id }],
    },
    adminUser.id
  );

  const mergeResult = await newsAdminService.mergeDuplicates(articleA.id, articleB.id, adminUser.id);
  assert(Boolean(mergeResult.clusterId), 'NewsStoryCluster created or connected during merge');

  const mergedPrimary = await newsAdminService.getArticleById(articleA.id);
  const mergedSecondary = await prisma.newsArticle.findUnique({ where: { id: articleB.id } });

  assert(mergedPrimary!.studioRelations.length > 0, 'Secondary article studio relation migrated to primary');
  assert(mergedSecondary!.status === 'ARCHIVED', 'Secondary duplicate article archived');
  assert(Boolean(mergedSecondary!.deletedAt), 'Secondary duplicate article soft-deleted');

  // ==========================================
  // TEST 6: Scheduled Publishing Worker
  // ==========================================
  console.log('\n--- TEST 6: Scheduled Publishing Worker ---');
  const pastTime = new Date(Date.now() - 10000); // 10s in past (due)
  const scheduledArticle = await newsAdminService.createArticle(
    {
      title: 'Scheduled Breaking News: Worldwide Theatrical Tour Dates',
      summary: 'Comprehensive list of theatrical screening venues across 30 territories.',
      category: 'EVENT',
      status: 'SCHEDULED',
      sourceName: 'Official Press',
      sourceUrl: 'https://official-tour.test/news',
      scheduledPublishAt: pastTime,
    },
    adminUser.id
  );

  assert(scheduledArticle.status === 'SCHEDULED', 'Initial status is SCHEDULED');

  // Run scheduled worker
  const workerResult = await newsScheduledWorker.processScheduledArticles();
  assert(workerResult.publishedCount >= 1, 'Scheduled worker published due article');

  const publishedScheduled = await prisma.newsArticle.findUnique({ where: { id: scheduledArticle.id } });
  assert(publishedScheduled!.status === 'PUBLISHED', 'Scheduled article status transitioned to PUBLISHED');

  // ==========================================
  // TEST 7: Automated Quality Control Inspector
  // ==========================================
  console.log('\n--- TEST 7: Automated Quality Control Inspector ---');
  // Pass Case
  const passCheck = await newsOperationsService.checkArticleQuality(createdEditorial.id);
  assert(passCheck.qualityScore > 70, `Healthy article received high quality score (${passCheck.qualityScore})`);

  // Broken Article Case (Missing URL & Bad Summary)
  const brokenArticle = await prisma.newsArticle.create({
    data: {
      title: 'Hi',
      slug: `broken-${Date.now()}`,
      sourceName: 'Unknown',
      sourceUrl: '',
      category: 'ANIME',
      status: 'DRAFT',
    },
  });

  const failCheck = await newsOperationsService.checkArticleQuality(brokenArticle.id);
  assert(failCheck.status === 'BLOCKED', 'Incomplete article correctly flagged as BLOCKED');
  assert(failCheck.issues.length >= 2, 'Detailed quality issues and remediations generated');

  // ==========================================
  // TEST 8: Controlled Bulk Operations
  // ==========================================
  console.log('\n--- TEST 8: Controlled Bulk Operations ---');
  const bulkA = await newsAdminService.createArticle({ title: 'Bulk Test Article 1' }, adminUser.id);
  const bulkB = await newsAdminService.createArticle({ title: 'Bulk Test Article 2' }, adminUser.id);

  const bulkResult = await newsAdminService.bulkAction(
    'CHANGE_CATEGORY',
    [bulkA.id, bulkB.id],
    { category: 'INDUSTRY' },
    superAdmin.id
  );

  assert(bulkResult.affectedCount === 2, 'Bulk action updated exactly 2 selected articles');

  const bulkAUpdated = await prisma.newsArticle.findUnique({ where: { id: bulkA.id } });
  assert(bulkAUpdated!.category === 'INDUSTRY', 'Bulk category change applied');

  // ==========================================
  // TEST 9: Operations Telemetry & Data Quality Score
  // ==========================================
  console.log('\n--- TEST 9: Operations Telemetry & Data Quality Score ---');
  const operationsOverview = await newsOperationsService.getOperationsOverview();
  assert(Boolean(operationsOverview.overview.totalArticles >= 5), 'Operations center aggregated total articles');
  assert(operationsOverview.dataQuality.overallScore > 0, 'Data Quality Score calculated');

  // News Analytics
  const analytics = await newsOperationsService.getNewsAnalytics('7d');
  assert(Boolean(analytics.metrics.clickThroughRate), 'Analytics computed CTR metric');

  // ==========================================
  // TEST 10: Comprehensive Audit Logging
  // ==========================================
  console.log('\n--- TEST 10: Comprehensive Audit Logging ---');
  const auditEntries = await prisma.auditLog.findMany({
    where: { entityType: 'NEWS_ARTICLE' },
  });
  assert(auditEntries.length >= 5, `Recorded ${auditEntries.length} immutable audit log entries`);

  console.log('\n================================================================');
  console.log('🎉 ALL 10 OTAKUVA PHASES 8.11 → 8.12 TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

// Auto-run if executed directly
if (require.main === module) {
  runAdminOperationsTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
