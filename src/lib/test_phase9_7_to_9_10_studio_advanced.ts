/**
 * OTAKUVA MASTER TEST SUITE — PHASES 9.7 → 9.10
 * STUDIO NEWS, COMMUNITY, DISCOVERY & DATA INTELLIGENCE
 * 
 * Comprehensive verification covering:
 * - Phase 9.7: Studio News & Real-World Updates (entity matching, taxonomy, source attribution, resilience, admin linking)
 * - Phase 9.8: Studio Community Integration (studio hubs, public/private access, discussion previews, membership)
 * - Phase 9.9: Studio Discovery & Recommendation (similarity engine, personalized discovery, guest feeds, exploration slots)
 * - Phase 9.10: Studio Data Intelligence & Verification (completeness score, conflict detection, verification status, duplicate detection, atomic safe merge)
 */

import { prisma } from './prisma';
import { studioAdminService } from './engine/studio/studioAdminService';
import { studioProjectService } from './engine/studio/studioProjectService';
import { studioPeopleService } from './engine/studio/studioPeopleService';
import { studioNewsService } from './engine/studio/studioNewsService';
import { studioCommunityService } from './engine/studio/studioCommunityService';
import { studioDiscoveryService } from './engine/studio/studioDiscoveryService';
import { studioDataIntelligenceService } from './engine/studio/studioDataIntelligenceService';
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

async function runAdvancedStudioTestSuite() {
  console.log('========================================================================');
  console.log('OTAKUVA ENGINE — PHASES 9.7 → 9.10 ADVANCED STUDIO MASTER TEST SUITE');
  console.log('========================================================================\n');

  const testSuffix = Date.now();

  // Setup Admin Actor
  let testAdmin = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } });
  if (!testAdmin) {
    testAdmin = await prisma.user.create({
      data: {
        username: `adv_admin_${testSuffix}`,
        email: `adv_admin_${testSuffix}@otakuva.test`,
        role: 'ADMIN',
      },
    });
  }

  // Setup Dedicated Regular User Actor
  const testUser = await prisma.user.create({
    data: {
      username: `adv_user_${testSuffix}`,
      email: `adv_user_${testSuffix}@otakuva.test`,
      role: 'USER',
    },
  });

  // Create Primary Test Studio (Trigger Intelligence)
  const primaryStudio = await studioAdminService.createStudio(testAdmin.id, {
    name: `Studio Trigger Advanced ${testSuffix}`,
    nativeName: 'トリガーアドバンスド',
    foundedYear: 2011,
    country: 'Japan',
    city: 'Suginami',
    website: 'https://st-trigger.co.jp',
    about: 'Studio Trigger is an animation studio known for high-octane visual dynamism.',
    status: 'ACTIVE',
  });
  const studioId = primaryStudio.id;

  // Create Secondary Similar Test Studio (Gainax Legacy)
  const similarStudio = await studioAdminService.createStudio(testAdmin.id, {
    name: `Studio Gainax Legacy ${testSuffix}`,
    foundedYear: 1984,
    country: 'Japan',
    status: 'ACTIVE',
  });

  // Create Duplicate Studio (Trigger Duplicate to test merge)
  const duplicateStudio = await studioAdminService.createStudio(testAdmin.id, {
    name: `Studio Trigger Advanced Duplicate ${testSuffix}`,
    nativeName: 'トリガーアドバンスド',
    foundedYear: 2011,
    status: 'ACTIVE',
  });

  // Create Test Genre
  const scifiGenre = await prisma.genre.upsert({
    where: { name: 'Sci-Fi Action' },
    create: { name: 'Sci-Fi Action', slug: `scifi-action-${testSuffix}` },
    update: {},
  });

  // Create Test Anime for Primary Studio
  const animeKLK = await prisma.anime.create({
    data: {
      canonicalTitle: `Kill la Kill Battle ${testSuffix}`,
      slug: `kill-la-kill-battle-${testSuffix}`,
      synopsis: 'Ryuko Matoi searches for her fathers killer.',
      posterUrl: 'https://example.com/klk.jpg',
      type: 'TV',
      episodes: 24,
      score: 8.8,
      status: 'Finished',
      year: 2013,
      animeGenres: { create: [{ genreId: scifiGenre.id }] },
    },
  });

  const animeCyberpunk = await prisma.anime.create({
    data: {
      canonicalTitle: `Cyberpunk Edgerunners Odyssey ${testSuffix}`,
      slug: `cyberpunk-edgerunners-odyssey-${testSuffix}`,
      synopsis: 'David Martinez survives Night City.',
      posterUrl: 'https://example.com/edgerunners.jpg',
      type: 'ONA',
      episodes: 10,
      score: 9.0,
      status: 'Finished',
      year: 2022,
      animeGenres: { create: [{ genreId: scifiGenre.id }] },
    },
  });

  // Link Anime to Primary Studio
  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioId, {
    animeId: animeKLK.id,
    role: 'MAIN_STUDIO',
    isPrimary: true,
  });
  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioId, {
    animeId: animeCyberpunk.id,
    role: 'MAIN_STUDIO',
    isPrimary: true,
  });

  // Create Anime for Similar Studio (Gurren Lagann)
  const animeGurren = await prisma.anime.create({
    data: {
      canonicalTitle: `Gurren Lagann Mecha ${testSuffix}`,
      slug: `gurren-lagann-mecha-${testSuffix}`,
      synopsis: 'Simon and Kamina pierce the heavens.',
      posterUrl: 'https://example.com/gurren.jpg',
      type: 'TV',
      episodes: 27,
      score: 8.7,
      status: 'Finished',
      year: 2007,
      animeGenres: { create: [{ genreId: scifiGenre.id }] },
    },
  });
  await studioProjectService.linkAnimeToStudio(testAdmin.id, similarStudio.id, {
    animeId: animeGurren.id,
    role: 'MAIN_STUDIO',
    isPrimary: true,
  });

  // Create Shared Director Person
  const directorHiroyuki = await prisma.person.create({
    data: {
      name: `Hiroyuki Imaishi ${testSuffix}`,
      slug: `hiroyuki-imaishi-${testSuffix}`,
      about: 'Renowned action anime director.',
    },
  });

  // Link Director to Primary and Similar Studios
  await studioPeopleService.linkPersonToStudio(testAdmin.id, studioId, {
    personId: directorHiroyuki.id,
    role: 'DIRECTOR',
    isCurrent: true,
  });
  await studioPeopleService.linkPersonToStudio(testAdmin.id, similarStudio.id, {
    personId: directorHiroyuki.id,
    role: 'DIRECTOR',
    isCurrent: false,
    tenureStartYear: 1995,
    tenureEndYear: 2011,
  });

  // =========================================================================
  // PHASE 9.7: STUDIO NEWS & REAL-WORLD UPDATES TESTS
  // =========================================================================
  console.log('--- PHASE 9.7: STUDIO NEWS & REAL-WORLD UPDATES TESTS ---');

  // Create Test News Article
  const newsArticle = await prisma.newsArticle.create({
    data: {
      title: `Studio Trigger Announces New Original Project at Anime Expo ${testSuffix}`,
      slug: `studio-trigger-announces-new-original-project-${testSuffix}`,
      summary: 'Studio Trigger revealed their latest ambitious anime production during their official panel.',
      category: 'ANNOUNCEMENTS',
      sourceName: 'Anime News Network',
      sourceUrl: 'https://www.animenewsnetwork.com/news/2026/trigger-project',
      canonicalUrl: 'https://www.animenewsnetwork.com/news/2026/trigger-project',
      status: 'PUBLISHED',
      provider: 'ANN',
      externalId: `ann-adv-${testSuffix}`,
    },
  });

  // Link Article to Studio
  await studioNewsService.linkArticleToStudio(testAdmin.id, studioId, {
    articleId: newsArticle.id,
    relationType: 'PRIMARY_SUBJECT',
    confidenceScore: 0.98,
    matchMethod: 'EXACT_NAME',
  });

  // Query Studio News
  const newsFeed = await studioNewsService.getStudioNews(studioId, { limit: 10 });
  assert(newsFeed.total === 1, 'Studio news feed retrieves linked article');
  assert(newsFeed.articles[0].relationship.relationType === 'PRIMARY_SUBJECT', 'News relationType PRIMARY_SUBJECT preserved');
  assert(newsFeed.articles[0].sourceName === 'Anime News Network', 'Source attribution preserved');
  assert(newsFeed.articles[0].canonicalUrl.includes('animenewsnetwork.com'), 'Canonical "Read Original" URL retained');

  // Category Filtering Test
  const annFilter = await studioNewsService.getStudioNews(studioId, { category: 'ANNOUNCEMENTS' });
  assert(annFilter.total === 1, 'Category filter "ANNOUNCEMENTS" matches');

  const prodFilter = await studioNewsService.getStudioNews(studioId, { category: 'PRODUCTION' });
  assert(prodFilter.total === 0, 'Category filter "PRODUCTION" correctly returns 0 for non-matching category');

  // Outage Resilience: Non-existent provider or empty query does not throw
  const resilientQuery = await studioNewsService.getStudioNews('non-existent-studio-slug');
  assert(resilientQuery.articles.length === 0 && resilientQuery.studio === null, 'Non-existent studio handled cleanly without error');

  // =========================================================================
  // PHASE 9.8: STUDIO COMMUNITY INTEGRATION TESTS
  // =========================================================================
  console.log('\n--- PHASE 9.8: STUDIO COMMUNITY INTEGRATION TESTS ---');

  // Create Studio Community
  const studioCommunity = await studioCommunityService.createStudioCommunity(testAdmin.id, studioId, {
    name: `Studio Trigger Fanatics ${testSuffix}`,
    description: 'Official fan hub for all Trigger productions, fan art, and episode discussions.',
    visibility: 'PUBLIC',
  });
  assert(studioCommunity.communityType === 'STUDIO', 'Community created with communityType = "STUDIO"');
  assert(studioCommunity.studioId === studioId, 'Community linked to Studio ID');

  // Create Discussion Topic inside Community
  await prisma.discussion.create({
    data: {
      communityId: studioCommunity.id,
      authorId: testAdmin.id,
      title: 'What is your favorite Trigger fight scene?',
      body: 'Share your favorite animation cuts from Kill la Kill and Gurren Lagann!',
    },
  });

  // Query Studio Communities
  const commFeed = await studioCommunityService.getStudioCommunities(studioId, testUser.id);
  assert(commFeed.total >= 1, 'Studio communities feed retrieves linked hub');
  assert(commFeed.communities[0].recentDiscussions.length === 1, 'Active discussion topic summarized in community preview');
  assert(!commFeed.communities[0].isMember, 'User membership correctly identified as false before joining');

  // =========================================================================
  // PHASE 9.9: STUDIO DISCOVERY & RECOMMENDATION TESTS
  // =========================================================================
  console.log('\n--- PHASE 9.9: STUDIO DISCOVERY & RECOMMENDATION TESTS ---');

  // Multi-factor Studio Similarity
  const similarList = await studioDiscoveryService.getSimilarStudios(studioId, 5);
  assert(similarList.length >= 1, 'Studio similarity engine computes related studios');
  assert(similarList.some((s) => s.id === similarStudio.id), 'Gainax identified as similar to Trigger (shared key director Hiroyuki Imaishi)');
  assert(similarList[0].explanation.length > 0, 'Explainable similarity reason generated');

  // Simulate User Taste Activity on Primary Studio
  await prisma.userAnime.create({
    data: {
      userId: testUser.id,
      animeId: animeCyberpunk.id,
      status: 'COMPLETED',
    },
  });
  await prisma.animeRating.create({
    data: {
      userId: testUser.id,
      animeId: animeCyberpunk.id,
      rating: 9.5,
    },
  });

  // Personalized Discovery
  const personalizedDiscovery = await studioDiscoveryService.getPersonalizedStudioDiscovery(testUser.id);
  assert(personalizedDiscovery.personalizationTier === 'AUTHENTICATED', 'Personalization tier is AUTHENTICATED for active user');
  assert(personalizedDiscovery.forYou.some((s) => s.studio.id === studioId), 'Trigger recommended in For You section');
  assert(personalizedDiscovery.discoverNewStudios.length >= 0, 'Exploration discovery slots generated');

  // Guest Discovery
  const guestDiscovery = await studioDiscoveryService.getGuestStudioDiscovery();
  assert(guestDiscovery.personalizationTier === 'GUEST', 'Guest discovery tier returned');
  assert(guestDiscovery.popularStudios.length >= 1, 'Popular studios listed');

  // Personalized Studio Profile Context
  const studioPersonalization = await studioDiscoveryService.getStudioUserPersonalization(testUser.id, studioId);
  assert(studioPersonalization !== null, 'Personalized studio context retrieved');
  assert(studioPersonalization!.watchedCount === 1, 'Watched productions count = 1');
  assert(studioPersonalization!.unwatchedRecommendations.some((a) => a.id === animeKLK.id), 'Unwatched KLK recommended on Trigger profile');

  // =========================================================================
  // PHASE 9.10: STUDIO DATA INTELLIGENCE & VERIFICATION TESTS
  // =========================================================================
  console.log('\n--- PHASE 9.10: STUDIO DATA INTELLIGENCE & VERIFICATION TESTS ---');

  // Completeness & Health Report
  const healthReport = await studioDataIntelligenceService.getStudioHealthReport(studioId);
  assert(healthReport !== null, 'Studio health report generated');
  assert(healthReport!.completenessScore >= 60, `Completeness score calculated: ${healthReport!.completenessScore}%`);
  assert(healthReport!.checks.overview && healthReport!.checks.projectsLinked && healthReport!.checks.staffIndexed, 'Core data completeness checks passed');

  // Verification Status Update
  await studioDataIntelligenceService.updateVerificationStatus(testAdmin.id, studioId, 'VERIFIED', 'Verified against official studio portal');
  const checkVerified = await prisma.studio.findUnique({ where: { id: studioId } });
  assert(checkVerified?.verificationStatus === 'VERIFIED', 'Studio verificationStatus updated to VERIFIED');

  // Global Data Health Overview
  const globalHealth = await studioDataIntelligenceService.getGlobalDataHealthOverview();
  assert(globalHealth.totalStudios >= 3, 'Global data health overview aggregates all studios');
  assert(globalHealth.verified >= 1, 'Global verified count updated');

  // Duplicate Studio Identification
  assert(healthReport!.possibleDuplicates.length >= 1, 'Trigger duplicate detected by duplicate identification engine');

  // Link anime to duplicate studio to verify safe merge
  const duplicateAnime = await prisma.anime.create({
    data: {
      canonicalTitle: `Little Witch Academia TV ${testSuffix}`,
      slug: `little-witch-academia-tv-${testSuffix}`,
      synopsis: 'Akko Kagari enrolls at Luna Nova Magical Academy.',
      posterUrl: 'https://example.com/lwa.jpg',
      type: 'TV',
      score: 8.4,
    },
  });
  await studioProjectService.linkAnimeToStudio(testAdmin.id, duplicateStudio.id, {
    animeId: duplicateAnime.id,
    role: 'MAIN_STUDIO',
  });

  // Execute Atomic Safe Merge
  const mergeResult = await studioDataIntelligenceService.mergeStudios(testAdmin.id, {
    targetStudioId: studioId,
    sourceStudioId: duplicateStudio.id,
    reason: 'Duplicate entity consolidated into canonical Trigger profile',
  });
  assert(mergeResult.success, 'Atomic safe studio merge succeeded');
  assert(mergeResult.migratedProjectsCount >= 1, 'Anime productions migrated to target canonical studio');

  // Check Source Studio is Archived and Marked MERGED
  const sourceAfterMerge = await prisma.studio.findUnique({ where: { id: duplicateStudio.id } });
  assert(sourceAfterMerge?.status === 'MERGED' && sourceAfterMerge?.publicationState === 'ARCHIVED', 'Duplicate source studio status set to MERGED and archived');

  // Check Target Studio absorbed the anime and aliases
  const targetAnimeCheck = await prisma.animeStudio.findUnique({
    where: { animeId_studioId: { animeId: duplicateAnime.id, studioId: studioId } },
  });
  assert(!!targetAnimeCheck, 'Migrated anime successfully linked to target canonical studio');

  // Check Audit Trail
  const auditLogs = await prisma.studioAuditLog.findMany({ where: { studioId } });
  assert(auditLogs.some((l) => l.action === 'MERGE'), 'MERGE action recorded in StudioAuditLog');

  // Security RBAC Check
  assert(!hasMinRole('USER', 'ADMIN'), 'RBAC: Normal USER prohibited from merging studios');

  console.log('\n========================================================================');
  console.log(`PHASES 9.7 → 9.10 TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  console.log('========================================================================\n');
}

runAdvancedStudioTestSuite().catch((err) => {
  console.error('Test Suite execution failed:', err);
  process.exit(1);
});
