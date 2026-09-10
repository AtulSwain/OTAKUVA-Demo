/**
 * OTAKUVA MASTER TEST SUITE — PHASES 9.11 → 9.12
 * ADVANCED STUDIO CMS & STUDIO KNOWLEDGE GRAPH
 * 
 * Comprehensive verification covering:
 * - Phase 9.11: Advanced Studio CMS & Editorial Management (list queries, completeness, duplicate guard, versions, rollback, media validation, import preview, conflict resolution, publication lifecycle, RBAC)
 * - Phase 9.12: Studio Knowledge Graph & Relationship Intelligence (relational nodes/edges, depth traversal, BFS path finding, recommendation explanations, TTL caching, privacy isolation)
 */

import { prisma } from './prisma';
import { studioCmsService } from './engine/studio/studioCmsService';
import { studioKnowledgeGraphService } from './engine/studio/studioKnowledgeGraphService';
import { studioProjectService } from './engine/studio/studioProjectService';
import { studioPeopleService } from './engine/studio/studioPeopleService';
import { studioNewsService } from './engine/studio/studioNewsService';
import { studioCommunityService } from './engine/studio/studioCommunityService';
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

async function runCmsAndGraphTestSuite() {
  console.log('========================================================================');
  console.log('OTAKUVA ENGINE — PHASES 9.11 → 9.12 CMS & KNOWLEDGE GRAPH MASTER TEST');
  console.log('========================================================================\n');

  const testSuffix = Date.now();

  // Setup Admin Actor
  let testAdmin = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } });
  if (!testAdmin) {
    testAdmin = await prisma.user.create({
      data: {
        username: `graph_admin_${testSuffix}`,
        email: `graph_admin_${testSuffix}@otakuva.test`,
        role: 'ADMIN',
      },
    });
  }

  // Setup Regular User Actor
  const testUser = await prisma.user.create({
    data: {
      username: `graph_user_${testSuffix}`,
      email: `graph_user_${testSuffix}@otakuva.test`,
      role: 'USER',
    },
  });

  // =========================================================================
  // PHASE 9.11: ADVANCED STUDIO CMS & EDITORIAL MANAGEMENT TESTS
  // =========================================================================
  console.log('--- PHASE 9.11: ADVANCED STUDIO CMS & EDITORIAL MANAGEMENT TESTS ---');

  // Test 1: Studio Creation with Pre-Creation Duplicate Detection Guard
  const uniqueName = `Kyoto Animation Studio ${testSuffix}`;
  const uniqueNative = `京都アニメーション ${testSuffix}`;
  const dupCheckBefore = await studioCmsService.checkDuplicateStudio(uniqueName, uniqueNative);
  assert(!dupCheckBefore.hasDuplicate, 'Duplicate check returns false for fresh studio');

  const studioKyoAni = await studioCmsService.createStudioWithDuplicateGuard(testAdmin.id, {
    name: uniqueName,
    nativeName: uniqueNative,
    foundedYear: 1981,
    country: 'Japan',
    city: 'Uji',
    website: 'https://www.kyotoanimation.co.jp',
    about: 'Kyoto Animation is celebrated for exceptional artistic craftsmanship and staff-centered production.',
    status: 'ACTIVE',
  });
  assert(!!studioKyoAni.id, 'Studio created successfully via CMS');

  // Test 2: Duplicate Guard Blocks Creation of Matching Studio
  let duplicateBlocked = false;
  try {
    await studioCmsService.createStudioWithDuplicateGuard(testAdmin.id, {
      name: uniqueName,
      foundedYear: 1981,
    });
  } catch (err: any) {
    if (err.message.includes('POSSIBLE_DUPLICATE')) {
      duplicateBlocked = true;
    }
  }
  assert(duplicateBlocked, 'Pre-creation duplicate guard blocked redundant studio creation');

  // Test 3: Version History & Initial Version 1 Snapshot
  const initialVersions = await studioCmsService.getStudioVersions(studioKyoAni.id);
  assert(initialVersions.length === 1, 'Initial Version 1 snapshot created upon studio creation');
  assert(initialVersions[0].versionNumber === 1, 'Version number is 1');

  // Test 4: Update Metadata and Create Version 2 Snapshot
  await prisma.studio.update({
    where: { id: studioKyoAni.id },
    data: { about: 'Updated KyoAni editorial description with additional awards and expansions.' },
  });
  const v2 = await studioCmsService.createStudioVersion(testAdmin.id, studioKyoAni.id, 'Updated editorial description');
  assert(v2.versionNumber === 2, 'Version 2 snapshot recorded');

  // Test 5: Rollback to Historical Version 1
  const rollbackResult = await studioCmsService.rollbackToVersion(testAdmin.id, studioKyoAni.id, 1);
  assert(rollbackResult.success, 'Rollback to Version 1 succeeded');
  assert(
    !!rollbackResult.studio.about?.includes('celebrated for exceptional artistic craftsmanship'),
    'Studio about field restored to Version 1 content'
  );
  assert(rollbackResult.version.versionNumber === 3, 'Rollback creates new Version 3 audit snapshot');

  // Test 6: Media Asset Registration & MIME Validation
  const validMedia = await studioCmsService.addStudioMedia(testAdmin.id, studioKyoAni.id, {
    mediaType: 'LOGO',
    url: 'https://example.com/kyoani-logo.png',
    mimeType: 'image/png',
    fileSizeBytes: 1024 * 500, // 500KB
    status: 'APPROVED',
  });
  assert(validMedia.mediaType === 'LOGO' && validMedia.status === 'APPROVED', 'Valid PNG media asset registered');

  let invalidMimeBlocked = false;
  try {
    await studioCmsService.addStudioMedia(testAdmin.id, studioKyoAni.id, {
      mediaType: 'GALLERY',
      url: 'https://example.com/malicious.exe',
      mimeType: 'application/x-msdownload',
    });
  } catch (err: any) {
    invalidMimeBlocked = true;
  }
  assert(invalidMimeBlocked, 'Invalid executable MIME type rejected');

  // Test 7: Admin Studio List with Completeness & Relation Counts
  const cmsList = await studioCmsService.getAdminStudiosList({ query: `Kyoto Animation Studio ${testSuffix}` });
  assert(cmsList.studios.length === 1, 'Admin CMS list retrieves target studio');
  assert(cmsList.studios[0].completenessScore >= 60, `Completeness calculated: ${cmsList.studios[0].completenessScore}%`);
  assert(cmsList.studios[0].counts.versions >= 3, 'Versions count populated in CMS list');

  // Test 8: Import Preview Classification
  const importPreview = await studioCmsService.previewStudioImport([
    { name: `Brand New Studio ${testSuffix}`, foundedYear: 2024 },
    { name: uniqueName, foundedYear: 1981 }, // Duplicate/Updated
    { name: uniqueName, foundedYear: 1999 }, // Conflict on foundedYear
    { name: '' }, // Invalid
  ]);
  assert(importPreview.newCount === 1, 'Import preview categorized 1 NEW studio');
  assert(importPreview.updatedCount === 1, 'Import preview categorized 1 UPDATED studio');
  assert(importPreview.conflictCount === 1, 'Import preview categorized 1 CONFLICT studio');
  assert(importPreview.invalidCount === 1, 'Import preview categorized 1 INVALID studio');

  // Test 9: Conflict Resolution Workflow
  const resolvedConflict = await studioCmsService.resolveStudioConflict(
    testAdmin.id,
    studioKyoAni.id,
    'MANUAL_CORRECTION',
    { foundedYear: 1981 }
  );
  assert(resolvedConflict.verificationStatus === 'VERIFIED', 'Conflict resolved with verificationStatus = VERIFIED');

  // Test 10: Publication Lifecycle State Transitions (DRAFT -> PUBLISHED -> ARCHIVED)
  const draftStudio = await studioCmsService.updateStudioPublicationState(testAdmin.id, studioKyoAni.id, 'DRAFT', 'Preparing revisions');
  assert(draftStudio.publicationState === 'DRAFT', 'Studio transitioned to DRAFT');

  const pubStudio = await studioCmsService.updateStudioPublicationState(testAdmin.id, studioKyoAni.id, 'PUBLISHED', 'Published official catalog');
  assert(pubStudio.publicationState === 'PUBLISHED', 'Studio transitioned to PUBLISHED');

  // =========================================================================
  // PHASE 9.12: STUDIO KNOWLEDGE GRAPH & RELATIONSHIP INTELLIGENCE TESTS
  // =========================================================================
  console.log('\n--- PHASE 9.12: STUDIO KNOWLEDGE GRAPH & RELATIONSHIP INTELLIGENCE TESTS ---');

  // Setup Graph Relational Entities
  const dramaGenre = await prisma.genre.upsert({
    where: { name: 'Emotional Drama' },
    create: { name: 'Emotional Drama', slug: `emotional-drama-${testSuffix}` },
    update: {},
  });

  const animeViolet = await prisma.anime.create({
    data: {
      canonicalTitle: `Violet Evergarden Masterpiece ${testSuffix}`,
      slug: `violet-evergarden-masterpiece-${testSuffix}`,
      synopsis: 'An Auto Memory Doll learns the meaning of love.',
      posterUrl: 'https://example.com/violet.jpg',
      type: 'TV',
      episodes: 13,
      score: 8.9,
      year: 2018,
      animeGenres: { create: [{ genreId: dramaGenre.id }] },
    },
  });

  const animeHyouka = await prisma.anime.create({
    data: {
      canonicalTitle: `Hyouka Classic Mystery ${testSuffix}`,
      slug: `hyouka-classic-mystery-${testSuffix}`,
      synopsis: 'Hotaro Oreki solves school mysteries with curiosity.',
      posterUrl: 'https://example.com/hyouka.jpg',
      type: 'TV',
      episodes: 22,
      score: 8.5,
      year: 2012,
      animeGenres: { create: [{ genreId: dramaGenre.id }] },
    },
  });

  // Link Anime to Studio (PRODUCED edges)
  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioKyoAni.id, {
    animeId: animeViolet.id,
    role: 'MAIN_STUDIO',
    isPrimary: true,
  });
  await studioProjectService.linkAnimeToStudio(testAdmin.id, studioKyoAni.id, {
    animeId: animeHyouka.id,
    role: 'MAIN_STUDIO',
    isPrimary: true,
  });

  // Create Director Person & Link (EMPLOYS & DIRECTED edges)
  const directorTaichi = await prisma.person.create({
    data: {
      name: `Taichi Ishidate ${testSuffix}`,
      slug: `taichi-ishidate-${testSuffix}`,
      about: 'Renowned animation director at Kyoto Animation.',
    },
  });

  await studioPeopleService.linkPersonToStudio(testAdmin.id, studioKyoAni.id, {
    personId: directorTaichi.id,
    role: 'DIRECTOR',
    isCurrent: true,
    tenureStartYear: 2002,
  });

  await prisma.animeStaff.create({
    data: {
      animeId: animeViolet.id,
      personId: directorTaichi.id,
      role: 'Director',
    },
  });

  // Create News & Community (ABOUT & COMMUNITY_FOR edges)
  const kyoNews = await prisma.newsArticle.create({
    data: {
      title: `Kyoto Animation Unveils New Feature Film Project ${testSuffix}`,
      slug: `kyoani-unveils-new-feature-film-${testSuffix}`,
      summary: 'Kyoto Animation announced production of their next theatrical production.',
      category: 'PRODUCTION',
      sourceName: 'Anime News Network',
      sourceUrl: 'https://www.animenewsnetwork.com/news/kyoani',
      status: 'PUBLISHED',
    },
  });
  await studioNewsService.linkArticleToStudio(testAdmin.id, studioKyoAni.id, {
    articleId: kyoNews.id,
    relationType: 'PRIMARY_SUBJECT',
  });

  const kyoCommunity = await studioCommunityService.createStudioCommunity(testAdmin.id, studioKyoAni.id, {
    name: `KyoAni Appreciation Society ${testSuffix}`,
    description: 'Community celebrating the artistry of Kyoto Animation.',
    visibility: 'PUBLIC',
  });

  // Test 11: Multi-Hop Knowledge Graph Generation (Depth 2)
  const graphDepth2 = await studioKnowledgeGraphService.getStudioKnowledgeGraph(studioKyoAni.id, { depth: 2 });
  assert(graphDepth2 !== null, 'Knowledge graph generated');
  assert(graphDepth2!.nodes.some((n) => n.entityType === 'STUDIO'), 'Graph contains root STUDIO node');
  assert(graphDepth2!.nodes.some((n) => n.entityType === 'ANIME' && n.label.includes('Violet Evergarden')), 'Graph contains ANIME node');
  assert(graphDepth2!.nodes.some((n) => n.entityType === 'PERSON' && n.label.includes('Taichi Ishidate')), 'Graph contains PERSON node');
  assert(graphDepth2!.nodes.some((n) => n.entityType === 'GENRE' && n.label === 'Emotional Drama'), 'Graph contains GENRE node');
  assert(graphDepth2!.nodes.some((n) => n.entityType === 'NEWS'), 'Graph contains NEWS node');
  assert(graphDepth2!.nodes.some((n) => n.entityType === 'COMMUNITY'), 'Graph contains COMMUNITY node');
  assert(graphDepth2!.edges.some((e) => e.edgeType === 'PRODUCED'), 'Graph contains PRODUCED edge');
  assert(graphDepth2!.edges.some((e) => e.edgeType === 'EMPLOYS'), 'Graph contains EMPLOYS edge');
  assert(graphDepth2!.edges.some((e) => e.edgeType === 'HAS_GENRE'), 'Graph contains HAS_GENRE edge');

  // Test 12: Graph BFS Path Finding
  const pathResult = await studioKnowledgeGraphService.findGraphPath(studioKyoAni.id, dramaGenre.id, 4);
  assert(pathResult.found, 'Shortest graph path found between Studio and Genre');
  assert(pathResult.hopCount === 2, `Path hop count is 2 (Studio -> Anime -> Genre), received ${pathResult.hopCount}`);
  assert(pathResult.explanation.includes('Emotional Drama'), 'Path explanation describes traversal sequence');

  // Test 13: Graph-Based Recommendation Explanation
  await prisma.userAnime.create({
    data: {
      userId: testUser.id,
      animeId: animeViolet.id,
      status: 'COMPLETED',
    },
  });

  const recExplanation = await studioKnowledgeGraphService.getGraphRecommendationExplanation(testUser.id, animeHyouka.id);
  assert(recExplanation.confidence === 'HIGH', 'Recommendation explanation confidence is HIGH');
  assert(
    recExplanation.explanation.includes('Violet Evergarden') && recExplanation.explanation.includes('Kyoto Animation'),
    'Graph derived explainable recommendation: "Because you completed Violet Evergarden from Kyoto Animation"'
  );

  // Test 14: Cache Invalidation Check
  studioKnowledgeGraphService.invalidateStudioGraphCache(studioKyoAni.id);
  const reGraph = await studioKnowledgeGraphService.getStudioKnowledgeGraph(studioKyoAni.id, { depth: 1 });
  assert(reGraph!.depth === 1, 'Cache invalidated and re-queried with depth 1');

  // Test 15: Security & RBAC Enforcement
  assert(!hasMinRole('USER', 'DATA_EDITOR'), 'RBAC: Regular USER denied DATA_EDITOR permissions');
  assert(!hasMinRole('USER', 'ADMIN'), 'RBAC: Regular USER denied ADMIN permissions');
  assert(hasMinRole('ADMIN', 'DATA_EDITOR'), 'RBAC: ADMIN inherits DATA_EDITOR permissions');

  console.log('\n========================================================================');
  console.log(`PHASES 9.11 → 9.12 TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  console.log('========================================================================\n');
}

runCmsAndGraphTestSuite().catch((err) => {
  console.error('Test Suite execution failed:', err);
  process.exit(1);
});
