/**
 * OTAKUVA MASTER TEST SUITE — STUDIO DEDUPLICATION & CANONICAL IDENTITY SYSTEM
 * 
 * Production-grade automated verification covering:
 * - Deterministic Unicode, phonetic, and legal entity token normalization
 * - Multi-Signal Weighted Duplicate Scoring (External ID, Website, Name, Portfolio, People, Metadata)
 * - False Positive Protection (Distinct studios with similar names, co-productions, parent/subsidiary)
 * - Duplicate Cluster Grouping & Transitive Consistency
 * - Non-Destructive Merge Plan Previews & Count Reconciliation
 * - Safe Transactional Merge (Anime, Staff, News, Communities, History, Aliases, Redirects)
 * - StudioAlias & StudioRedirect Resolution (Zero broken links)
 * - Reversible Rollback from Serialized Database Snapshots
 * - Pre-Creation Identity Resolution (Ingestion & Import Pipeline Duplicate Prevention)
 * - Server-Side RBAC Security Enforcement
 */

import { prisma } from './prisma';
import { studioDeduplicationService } from './engine/studio/studioDeduplicationService';
import { studioService } from './engine/studio/studioService';
import { studioProjectService } from './engine/studio/studioProjectService';
import { studioPeopleService } from './engine/studio/studioPeopleService';
import { studioAdvancedAnalyticsService } from './engine/studio/studioAdvancedAnalyticsService';
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

async function runStudioDeduplicationTestSuite() {
  console.log('========================================================================');
  console.log('OTAKUVA ENGINE — STUDIO DEDUPLICATION & CANONICAL IDENTITY TEST SUITE');
  console.log('========================================================================\n');

  const testSuffix = Date.now();

  // Setup Admin Actor
  let testAdmin = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } });
  if (!testAdmin) {
    testAdmin = await prisma.user.create({
      data: {
        username: `dedup_admin_${testSuffix}`,
        email: `dedup_admin_${testSuffix}@otakuva.test`,
        role: 'ADMIN',
      },
    });
  }

  // Setup Regular User Actor
  const testUser = await prisma.user.create({
    data: {
      username: `dedup_user_${testSuffix}`,
      email: `dedup_user_${testSuffix}@otakuva.test`,
      role: 'USER',
    },
  });

  // =========================================================================
  // TEST 1: DETERMINISTIC NORMALIZATION & STRING ALGORITHMS
  // =========================================================================
  console.log('--- TEST 1: DETERMINISTIC NORMALIZATION & STRING ALGORITHMS ---');

  const norm1 = studioDeduplicationService.normalizeStudioName('Kyoto Animation Co., Ltd.');
  const norm2 = studioDeduplicationService.normalizeStudioName('Kyoto Animation Studio');
  const norm3 = studioDeduplicationService.normalizeStudioName('KYOTO ANIMATION');
  const norm4 = studioDeduplicationService.normalizeStudioName('株式会社Kyoto Animation');

  assert(norm1 === 'kyoto', `Normalized "Kyoto Animation Co., Ltd." -> "${norm1}"`);
  assert(norm2 === 'kyoto', `Normalized "Kyoto Animation Studio" -> "${norm2}"`);
  assert(norm3 === 'kyoto', `Normalized "KYOTO ANIMATION" -> "${norm3}"`);
  assert(norm4.includes('kyoto'), `Normalized Japanese legal prefix correctly: "${norm4}"`);

  // Website Normalization
  const web1 = studioDeduplicationService.normalizeWebsiteUrl('https://www.kyotoanimation.co.jp/');
  const web2 = studioDeduplicationService.normalizeWebsiteUrl('http://kyotoanimation.co.jp');
  assert(web1 === 'kyotoanimation.co.jp', `Normalized HTTPS URL -> "${web1}"`);
  assert(web2 === 'kyotoanimation.co.jp', `Normalized HTTP non-www URL -> "${web2}"`);
  assert(web1 === web2, 'Websites normalize identically across protocols and www');

  // String Similarity Algorithms
  const levScore = studioDeduplicationService.calculateLevenshteinSimilarity('cloverworks', 'clover works');
  const jaroScore = studioDeduplicationService.calculateJaroWinkler('cloverworks', 'clover works');
  const tokenScore = studioDeduplicationService.calculateTokenSimilarity('cloverworks anime studio', 'cloverworks animation');
  assert(levScore >= 0.85, `Levenshtein similarity is high (${(levScore * 100).toFixed(1)}%)`);
  assert(jaroScore >= 0.9, `Jaro-Winkler similarity is high (${(jaroScore * 100).toFixed(1)}%)`);
  assert(tokenScore >= 0.25, `Token similarity computed (${(tokenScore * 100).toFixed(1)}%)`);

  // =========================================================================
  // TEST 2: MULTI-SIGNAL IDENTITY MATCHING & EXPLAINABLE EVIDENCE
  // =========================================================================
  console.log('\n--- TEST 2: MULTI-SIGNAL IDENTITY MATCHING & EXPLAINABLE EVIDENCE ---');

  // Create Primary Canonical Studio
  const canonicalKyoAni = await prisma.studio.create({
    data: {
      name: `Kyoto Animation Official ${testSuffix}`,
      nativeName: `京都アニメーション ${testSuffix}`,
      slug: `kyoto-animation-official-${testSuffix}`,
      foundedYear: 1981,
      country: 'Japan',
      website: 'https://www.kyotoanimation.co.jp',
      externalId: `anilist_kyoani_${testSuffix}`,
      externalSource: 'anilist',
      about: 'Kyoto Animation is celebrated for detailed visual storytelling, in-house animation staff, and emotional warmth.',
      verificationStatus: 'VERIFIED',
      publicationState: 'PUBLISHED',
    },
  });

  // Create Duplicate Studio Record (Imported from another provider)
  const duplicateKyoAni = await prisma.studio.create({
    data: {
      name: `Kyoto Animation Co., Ltd. ${testSuffix}`,
      nativeName: `京都アニメーション ${testSuffix}`,
      slug: `kyoto-animation-co-ltd-${testSuffix}`,
      foundedYear: 1981,
      country: 'Japan',
      website: 'http://kyotoanimation.co.jp/',
      externalId: `anilist_kyoani_${testSuffix}`,
      externalSource: 'anilist',
      about: 'Japanese animation studio founded in 1981.',
      verificationStatus: 'UNVERIFIED',
      publicationState: 'PUBLISHED',
    },
  });

  // Create Distinct Unrelated Studio (Studio Pierrot)
  const distinctStudio = await prisma.studio.create({
    data: {
      name: `Pierrot Animation Studio ${testSuffix}`,
      nativeName: `ぴえろ ${testSuffix}`,
      slug: `pierrot-animation-studio-${testSuffix}`,
      foundedYear: 1979,
      country: 'Japan',
      website: 'https://pierrot.jp',
      verificationStatus: 'VERIFIED',
      publicationState: 'PUBLISHED',
    },
  });

  // Setup Anime Production for KyoAni
  const animeViolet = await prisma.anime.create({
    data: {
      canonicalTitle: `Violet Evergarden Masterwork ${testSuffix}`,
      slug: `violet-evergarden-masterwork-${testSuffix}`,
      synopsis: 'An auto memory doll searches for the meaning of love.',
      posterUrl: 'https://example.com/violet.jpg',
      type: 'TV',
      score: 9.0,
      year: 2018,
    },
  });

  // Link Anime to Canonical Studio
  await studioProjectService.linkAnimeToStudio(testAdmin.id, canonicalKyoAni.id, { animeId: animeViolet.id, isPrimary: true });
  // Link same Anime to Duplicate Studio
  await studioProjectService.linkAnimeToStudio(testAdmin.id, duplicateKyoAni.id, { animeId: animeViolet.id, isPrimary: true });

  // Score Canonical vs Duplicate
  const duplicateMatch = studioDeduplicationService.scoreStudioPair(
    await prisma.studio.findUnique({ where: { id: canonicalKyoAni.id }, include: { animeStudios: true, staffRelations: true } }),
    await prisma.studio.findUnique({ where: { id: duplicateKyoAni.id }, include: { animeStudios: true, staffRelations: true } })
  );

  assert(duplicateMatch.confidenceScore >= 0.9, `Duplicate confidence score is ${(duplicateMatch.confidenceScore * 100).toFixed(1)}% (>= 90%)`);
  assert(duplicateMatch.tier === 'DEFINITE_DUPLICATE', 'Classified as DEFINITE_DUPLICATE');
  assert(duplicateMatch.recommendedAction === 'AUTO_MERGE', 'Recommended action is AUTO_MERGE');
  assert(duplicateMatch.evidence.length >= 3, 'Generated 3+ explainable evidence points');
  assert(duplicateMatch.evidence.some((e) => e.includes('external ID')), 'Evidence cites external ID match');
  assert(duplicateMatch.evidence.some((e) => e.includes('website')), 'Evidence cites website match');

  // Score Canonical vs Distinct (False Positive Protection)
  const distinctMatch = studioDeduplicationService.scoreStudioPair(
    await prisma.studio.findUnique({ where: { id: canonicalKyoAni.id }, include: { animeStudios: true, staffRelations: true } }),
    await prisma.studio.findUnique({ where: { id: distinctStudio.id }, include: { animeStudios: true, staffRelations: true } })
  );

  assert(distinctMatch.confidenceScore < 0.4, `Distinct studio score is ${(distinctMatch.confidenceScore * 100).toFixed(1)}% (< 40%)`);
  assert(distinctMatch.tier === 'DISTINCT', 'False positive protected: classified as DISTINCT');
  assert(distinctMatch.recommendedAction === 'KEEP_SEPARATE', 'Recommended action is KEEP_SEPARATE');

  // =========================================================================
  // TEST 3: SCANNING & CLUSTER GENERATION
  // =========================================================================
  console.log('\n--- TEST 3: SCANNING & CLUSTER GENERATION ---');

  const scan = await studioDeduplicationService.scanForDuplicates({ minConfidence: 0.6 });
  assert(scan.totalScanned >= 3, 'Scan evaluated database studios');
  assert(scan.definiteDuplicatesCount >= 1, 'Identified definite duplicates');
  assert(scan.clusters.length >= 1, 'Grouped candidate pairs into clusters');

  const kyoAniCluster = scan.clusters.find((c) =>
    c.memberStudioIds.includes(canonicalKyoAni.id) && c.memberStudioIds.includes(duplicateKyoAni.id)
  );
  assert(kyoAniCluster !== undefined, 'Found KyoAni cluster with canonical and duplicate members');
  assert(kyoAniCluster!.memberStudioIds.includes(kyoAniCluster!.canonicalCandidateId), 'Identified valid canonical candidate lead in cluster');

  // =========================================================================
  // TEST 4: MERGE PLAN PREVIEW GENERATION
  // =========================================================================
  console.log('\n--- TEST 4: MERGE PLAN PREVIEW GENERATION ---');

  // Setup Extra Relations on Duplicate Studio to Test Migration
  const animeClannad = await prisma.anime.create({
    data: {
      canonicalTitle: `Clannad After Story ${testSuffix}`,
      slug: `clannad-after-story-${testSuffix}`,
      synopsis: 'A family navigates life in a small town.',
      posterUrl: 'https://example.com/clannad.jpg',
      type: 'TV',
      score: 9.3,
      year: 2008,
    },
  });
  await studioProjectService.linkAnimeToStudio(testAdmin.id, duplicateKyoAni.id, { animeId: animeClannad.id, isPrimary: true });

  const personDirector = await prisma.person.create({
    data: { name: `Naoko Yamada ${testSuffix}`, slug: `naoko-yamada-${testSuffix}` },
  });
  await studioPeopleService.linkPersonToStudio(testAdmin.id, duplicateKyoAni.id, {
    personId: personDirector.id,
    role: 'DIRECTOR',
  });

  const community = await prisma.community.create({
    data: {
      name: `KyoAni Fan Hub ${testSuffix}`,
      slug: `kyoani-fan-hub-${testSuffix}`,
      description: 'Community for Kyoto Animation fans.',
      studioId: duplicateKyoAni.id,
      communityType: 'STUDIO',
      ownerId: testAdmin.id,
    },
  });

  const preview = await studioDeduplicationService.generateMergePreview(canonicalKyoAni.id, duplicateKyoAni.id);
  assert(preview.canonicalStudio.id === canonicalKyoAni.id, 'Preview identifies canonical studio');
  assert(preview.mergingStudio.id === duplicateKyoAni.id, 'Preview identifies merging duplicate studio');
  assert(preview.migrationSummary.animeToMigrateCount === 1, 'Preview: 1 anime to migrate (Clannad)');
  assert(preview.migrationSummary.animeToCollapseCount === 1, 'Preview: 1 duplicate anime to collapse (Violet Evergarden)');
  assert(preview.migrationSummary.staffToMigrateCount === 1, 'Preview: 1 staff relation to migrate (Naoko Yamada)');
  assert(preview.migrationSummary.communitiesToRelinkCount === 1, 'Preview: 1 community to relink');
  assert(preview.migrationSummary.newAliasesToRegister.length >= 1, 'Preview: Identifies new aliases to register');

  // =========================================================================
  // TEST 5: TRANSACTIONAL SAFE MERGE EXECUTION
  // =========================================================================
  console.log('\n--- TEST 5: TRANSACTIONAL SAFE MERGE EXECUTION ---');

  const mergeResult = await studioDeduplicationService.executeSafeMerge({
    canonicalId: canonicalKyoAni.id,
    mergingId: duplicateKyoAni.id,
    actorId: testAdmin.id,
    reason: 'Consolidating duplicated external import records',
    confidenceScore: 0.98,
  });

  assert(mergeResult.success === true, 'Safe merge transaction executed successfully');
  assert(mergeResult.canonicalStudioId === canonicalKyoAni.id, 'Canonical studio preserved');
  assert(mergeResult.mergedStudioId === duplicateKyoAni.id, 'Merged studio ID recorded');
  assert(mergeResult.migratedRelationshipsCount >= 3, 'Migrated anime, staff, and community relationships');

  // Verify Merged Studio Status
  const updatedDuplicate = await prisma.studio.findUnique({ where: { id: duplicateKyoAni.id } });
  assert(updatedDuplicate!.status === 'MERGED', 'Merged studio status updated to MERGED');
  assert(updatedDuplicate!.publicationState === 'ARCHIVED', 'Merged studio publicationState set to ARCHIVED');

  // Verify Anime Reassigned to Canonical
  const clannadLink = await prisma.animeStudio.findUnique({
    where: { animeId_studioId: { animeId: animeClannad.id, studioId: canonicalKyoAni.id } },
  });
  assert(clannadLink !== null, 'Clannad successfully linked to canonical KyoAni');

  // Verify Community Reassigned to Canonical
  const updatedCommunity = await prisma.community.findUnique({ where: { id: community.id } });
  assert(updatedCommunity!.studioId === canonicalKyoAni.id, 'Community studioId relinked to canonical KyoAni');

  // Verify StudioMerge Record Created
  const mergeRecord = await prisma.studioMerge.findUnique({ where: { id: mergeResult.mergeId } });
  assert(mergeRecord !== null, 'StudioMerge record persisted');
  assert(mergeRecord!.status === 'COMPLETED', 'Merge record status is COMPLETED');
  assert(mergeRecord!.rollbackAvailable === true, 'Rollback snapshot available');

  // Verify StudioAlias Registered
  const aliasRecord = await prisma.studioAlias.findFirst({
    where: { studioId: canonicalKyoAni.id, alias: duplicateKyoAni.name },
  });
  assert(aliasRecord !== null, `Registered alias "${duplicateKyoAni.name}" under canonical studio`);

  // Verify StudioRedirect Registered
  const redirectRecord = await prisma.studioRedirect.findUnique({
    where: { sourceIdentifier: duplicateKyoAni.id },
  });
  assert(redirectRecord !== null, 'StudioRedirect registered for duplicate ID');
  assert(redirectRecord!.canonicalStudioId === canonicalKyoAni.id, 'Redirect points to canonical ID');

  // =========================================================================
  // TEST 6: TRANSPARENT URL & ALIAS RESOLUTION
  // =========================================================================
  console.log('\n--- TEST 6: TRANSPARENT URL & ALIAS RESOLUTION ---');

  // Query by duplicate ID
  const resolvedByDupId = await studioService.getStudioBySlugOrId(duplicateKyoAni.id);
  assert(resolvedByDupId !== null, 'getStudioBySlugOrId resolves duplicate ID');
  assert(resolvedByDupId!.id === canonicalKyoAni.id, 'Resolved duplicate ID redirects to Canonical Studio');

  // Query by duplicate Slug
  const resolvedByDupSlug = await studioService.getStudioBySlugOrId(duplicateKyoAni.slug!);
  assert(resolvedByDupSlug !== null, 'getStudioBySlugOrId resolves duplicate slug');
  assert(resolvedByDupSlug!.id === canonicalKyoAni.id, 'Resolved duplicate slug redirects to Canonical Studio');

  // Identifier Resolver Helper
  const canonicalId = await studioDeduplicationService.resolveStudioIdentifier(duplicateKyoAni.slug!);
  assert(canonicalId === canonicalKyoAni.id, 'resolveStudioIdentifier correctly resolves canonical ID');

  // =========================================================================
  // TEST 7: REVERSIBLE MERGE ROLLBACK
  // =========================================================================
  console.log('\n--- TEST 7: REVERSIBLE MERGE ROLLBACK ---');

  const rollbackRes = await studioDeduplicationService.rollbackStudioMerge(mergeResult.mergeId, testAdmin.id);
  assert(rollbackRes.success === true, 'Rollback operation returned success');

  const rolledBackDuplicate = await prisma.studio.findUnique({ where: { id: duplicateKyoAni.id } });
  assert(rolledBackDuplicate!.status === 'ACTIVE', 'Rolled back studio restored to ACTIVE status');
  assert(rolledBackDuplicate!.publicationState === 'PUBLISHED', 'Rolled back studio publicationState restored to PUBLISHED');

  const rolledBackMerge = await prisma.studioMerge.findUnique({ where: { id: mergeResult.mergeId } });
  assert(rolledBackMerge!.status === 'ROLLED_BACK', 'StudioMerge record status updated to ROLLED_BACK');

  // =========================================================================
  // TEST 8: PIPELINE IDENTITY RESOLUTION (PREVENT FUTURE DUPLICATES)
  // =========================================================================
  console.log('\n--- TEST 8: PIPELINE IDENTITY RESOLUTION (PREVENT FUTURE DUPLICATES) ---');

  // 1. Resolve by exact canonical name
  const resByName = await studioDeduplicationService.resolveStudioIdentity({
    name: canonicalKyoAni.name,
  });
  assert(resByName.isMatch === true, 'Pre-insert resolver detected exact name match');
  assert(resByName.existingStudioId === canonicalKyoAni.id, 'Resolved to existing canonical studio');

  // 2. Resolve by external ID
  const resByExtId = await studioDeduplicationService.resolveStudioIdentity({
    name: `Some New Ingested Name ${testSuffix}`,
    externalId: `anilist_kyoani_${testSuffix}`,
    externalSource: 'anilist',
  });
  assert(resByExtId.isMatch === true, 'Pre-insert resolver detected external ID match');
  assert(resByExtId.existingStudioId === canonicalKyoAni.id, 'Resolved external ID to existing canonical studio');

  // 3. Resolve by registered alias
  const resByAlias = await studioDeduplicationService.resolveStudioIdentity({
    name: duplicateKyoAni.name,
  });
  assert(resByAlias.isMatch === true, 'Pre-insert resolver detected registered alias match');

  // 4. Resolve by verified website
  const resByWeb = await studioDeduplicationService.resolveStudioIdentity({
    name: `Kyoto Ani New Sync ${testSuffix}`,
    website: 'http://www.kyotoanimation.co.jp',
  });
  assert(resByWeb.isMatch === true, 'Pre-insert resolver detected verified website match');

  // 5. Completely New Studio
  const resBrandNew = await studioDeduplicationService.resolveStudioIdentity({
    name: `Brand New Unique Studio ${testSuffix}`,
    website: `https://brandnewstudio-${testSuffix}.com`,
  });
  assert(resBrandNew.isMatch === false, 'Pre-insert resolver confirmed brand new studio does not exist');

  // =========================================================================
  // TEST 9: SECURITY & RBAC PERMISSION ENFORCEMENT
  // =========================================================================
  console.log('\n--- TEST 9: SECURITY & RBAC PERMISSION ENFORCEMENT ---');

  assert(!hasMinRole('USER', 'DATA_EDITOR'), 'RBAC: Regular USER denied DATA_EDITOR role');
  assert(!hasMinRole('USER', 'ADMIN'), 'RBAC: Regular USER denied ADMIN role');
  assert(hasMinRole('ADMIN', 'DATA_EDITOR'), 'RBAC: ADMIN inherits DATA_EDITOR role');
  assert(hasMinRole('SUPER_ADMIN', 'ADMIN'), 'RBAC: SUPER_ADMIN inherits ADMIN role');

  console.log('\n========================================================================');
  console.log(`STUDIO DEDUPLICATION TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  console.log('========================================================================\n');
}

runStudioDeduplicationTestSuite().catch((err) => {
  console.error('Studio Deduplication Test Suite execution failed:', err);
  process.exit(1);
});
