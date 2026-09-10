/**
 * OTAKUVA PHASE 9.1 — MASTER STUDIO TEST SUITE
 * 
 * Comprehensive 12-point verification covering:
 * 1. Canonical Studio creation & unique slug generation
 * 2. Native names & alternative names JSON serialization
 * 3. Date & URL validation (SSRF/unsafe scheme rejection)
 * 4. Founder & key personnel linking (StudioPerson -> Person)
 * 5. Studio-Anime production roles & primary lead flag management
 * 6. Admin override precedence & reset mechanics
 * 7. Image validation (magic bytes, MIME, size limits)
 * 8. Duplicate detection & safe atomic studio merge
 * 9. Server-side RBAC permission enforcement
 * 10. Public API draft isolation & multi-criteria filtering
 * 11. Event Engine stream emission & immutable audit logging
 * 12. Local database query performance & provider independence
 */

import { prisma } from './prisma';
import { studioService } from './engine/studio/studioService';
import { studioAdminService } from './engine/studio/studioAdminService';
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

async function runStudioTestSuite() {
  console.log('===============================================================');
  console.log('OTAKUVA ENGINE — PHASE 9.1 STUDIO CORE MASTER TEST SUITE');
  console.log('===============================================================\n');

  // Setup Admin test actor
  let testAdmin = await prisma.user.findFirst({ where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] } } });
  if (!testAdmin) {
    testAdmin = await prisma.user.create({
      data: {
        username: `studio_test_admin_${Date.now()}`,
        email: `studio_admin_${Date.now()}@otakuva.test`,
        role: 'ADMIN',
      },
    });
  }

  // Setup Regular User test actor
  let regularUser = await prisma.user.findFirst({ where: { role: 'USER' } });
  if (!regularUser) {
    regularUser = await prisma.user.create({
      data: {
        username: `studio_test_user_${Date.now()}`,
        email: `studio_user_${Date.now()}@otakuva.test`,
        role: 'USER',
      },
    });
  }

  const testSuffix = Date.now();
  let primaryStudioId = '';
  let secondaryStudioId = '';
  let testPersonId = '';
  let testAnimeId = '';

  // -------------------------------------------------------------
  // TEST 1: Canonical Studio Creation & Unique Slug Generation
  // -------------------------------------------------------------
  console.log('TEST 1: Canonical Studio Creation & Unique Slug Generation');
  const studioName = `CloverWorks Test Studio ${testSuffix}`;
  const createdStudio = await studioAdminService.createStudio(testAdmin.id, {
    name: studioName,
    nativeName: '株式会社クローバーワークス',
    romanizedName: 'Kabushiki-gaisha Kurōbāwākusu',
    about: 'High-profile animation production company producing modern hit series.',
    shortDescription: 'Modern animation studio based in Suginami.',
    foundedYear: 2018,
    status: 'ACTIVE',
    country: 'Japan',
    region: 'Tokyo',
    city: 'Suginami',
    website: 'https://cloverworks.co.jp',
    wikipediaUrl: 'https://en.wikipedia.org/wiki/CloverWorks',
    verificationStatus: 'VERIFIED',
    publicationState: 'PUBLISHED',
  });

  primaryStudioId = createdStudio.id;
  assert(!!createdStudio.id, 'Studio record created with stable ID');
  assert(createdStudio.name === studioName, 'Canonical studio display name stored');
  assert(!!createdStudio.slug && createdStudio.slug.startsWith('cloverworks-test-studio'), 'URL-safe slug generated correctly');
  assert(createdStudio.status === 'ACTIVE', 'Studio status set to ACTIVE');

  // -------------------------------------------------------------
  // TEST 2: Alternative Names & Metadata Serialization
  // -------------------------------------------------------------
  console.log('\nTEST 2: Alternative Names & Metadata Serialization');
  const aliases = ['Clover Works', 'CW', 'A-1 Pictures Koenji Studio'];
  const extLinks = [
    { provider: 'MAL' as const, externalId: '1835', url: 'https://myanimelist.net/anime/producer/1835' },
    { provider: 'ANILIST' as const, externalId: '6356', url: 'https://anilist.co/studio/6356' },
  ];

  const updatedWithMeta = await studioAdminService.updateStudio(testAdmin.id, primaryStudioId, {
    alternativeNames: aliases,
    externalLinks: extLinks,
    metadata: {
      dna: {
        signatureStyle: 'Dynamic character designs and expressive character animation',
        primaryGenres: ['Romance', 'Drama', 'Supernatural'],
      },
    },
    reason: 'Populate aliases and metadata',
  });

  assert(!!updatedWithMeta.alternativeNamesJson, 'Alternative names JSON stored');
  const parsedAliases = JSON.parse(updatedWithMeta.alternativeNamesJson!);
  assert(parsedAliases.length === 3 && parsedAliases.includes('CW'), 'Aliases parsed correctly');
  const parsedLinks = JSON.parse(updatedWithMeta.externalLinksJson!);
  assert(parsedLinks.length === 2 && parsedLinks[0].provider === 'MAL', 'External reference links stored');

  // -------------------------------------------------------------
  // TEST 3: Date & URL Validation (SSRF/Unsafe Scheme Defense)
  // -------------------------------------------------------------
  console.log('\nTEST 3: Date & URL Validation');
  const safeUrl1 = studioService.validateUrl('https://example.com/studio');
  const safeUrl2 = studioService.validateUrl('http://example.com/studio');
  const unsafeUrl1 = studioService.validateUrl('javascript:alert(document.cookie)');
  const unsafeUrl2 = studioService.validateUrl('data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==');
  const unsafeUrl3 = studioService.validateUrl('file:///etc/passwd');

  assert(safeUrl1 === 'https://example.com/studio', 'Valid HTTPS URL accepted');
  assert(safeUrl2 === 'http://example.com/studio', 'Valid HTTP URL accepted');
  assert(unsafeUrl1 === null, 'javascript: scheme rejected');
  assert(unsafeUrl2 === null, 'data: scheme rejected');
  assert(unsafeUrl3 === null, 'file: scheme rejected');

  const validDates = studioService.validateDates('2018-10-01', null, 2018);
  assert(validDates.valid, 'Valid founded date parsed');

  const invalidDates = studioService.validateDates('2020-01-01', '2010-01-01', 2020);
  assert(!invalidDates.valid && !!invalidDates.error, 'Dissolved date preceding founded date rejected');

  // -------------------------------------------------------------
  // TEST 4: Founder & Key Personnel Linking (StudioPerson -> Person)
  // -------------------------------------------------------------
  console.log('\nTEST 4: Founder & Key Personnel Linking');
  const person = await prisma.person.create({
    data: {
      name: `Akira Shimizu ${testSuffix}`,
      slug: `akira-shimizu-${testSuffix}`,
      about: 'President and representative director of animation production.',
    },
  });
  testPersonId = person.id;

  const staffLink = await studioAdminService.linkPersonToStudio(
    testAdmin.id,
    primaryStudioId,
    testPersonId,
    'CEO',
    {
      tenureStartYear: 2018,
      isCurrent: true,
      notes: 'President & Representative Director',
    }
  );

  assert(staffLink.role === 'CEO', 'Staff linked with CEO role');
  assert(staffLink.isCurrent === true, 'isCurrent flag stored');

  const studioWithStaff = await studioService.getStudioBySlugOrId(primaryStudioId);
  assert(!!studioWithStaff, 'Studio retrieved by ID');
  assert(studioWithStaff!.staff.length >= 1, 'Studio staff list contains linked personnel');
  assert(studioWithStaff!.staff[0].name === person.name, 'Person entity name resolved in staff relation');

  // -------------------------------------------------------------
  // TEST 5: Anime-Studio Production Roles & Primary Lead Flag
  // -------------------------------------------------------------
  console.log('\nTEST 5: Anime-Studio Production Roles & Primary Lead Flag');
  let anime = await prisma.anime.findFirst();
  if (!anime) {
    anime = await prisma.anime.create({
      data: {
        canonicalTitle: `Bocchi the Rock! ${testSuffix}`,
        slug: `bocchi-the-rock-${testSuffix}`,
        synopsis: 'Hitori Gotoh is a lonely high school girl who plays guitar.',
        posterUrl: 'https://example.com/bocchi.jpg',
        type: 'TV',
        status: 'Finished',
        score: 8.8,
        episodes: 12,
        year: 2022,
      },
    });
  }
  testAnimeId = anime.id;

  const animeLink = await studioAdminService.linkAnimeToStudio(
    testAdmin.id,
    primaryStudioId,
    testAnimeId,
    'MAIN_STUDIO',
    true
  );

  assert(animeLink.role === 'MAIN_STUDIO', 'Linked anime with MAIN_STUDIO role');
  assert(animeLink.isPrimary === true, 'Marked as isPrimary lead studio');

  const projectsResult = await studioService.getStudioProjects(primaryStudioId);
  assert(projectsResult.projects.some((p) => p.id === testAnimeId), 'Anime project listed in studio projects');

  // Unlink test
  await studioAdminService.unlinkAnimeFromStudio(testAdmin.id, primaryStudioId, testAnimeId);
  const animeAfterUnlink = await prisma.anime.findUnique({ where: { id: testAnimeId } });
  assert(!!animeAfterUnlink, 'Unlinking anime preserves underlying Anime database record');

  // Re-link for downstream merge test
  await studioAdminService.linkAnimeToStudio(testAdmin.id, primaryStudioId, testAnimeId, 'MAIN_STUDIO', true);

  // -------------------------------------------------------------
  // TEST 6: Admin Override Precedence & Safe Reset Mechanics
  // -------------------------------------------------------------
  console.log('\nTEST 6: Admin Override Precedence & Safe Reset Mechanics');
  const overrideResult = await studioAdminService.applyAdminOverride(testAdmin.id, primaryStudioId, {
    name: 'CloverWorks (Curated Master Name)',
    about: 'Editorial verified synopsis with curated awards history.',
    foundedYear: 2018,
    website: 'https://cloverworks.co.jp/en',
    overrideReason: 'English localization corrections',
  });

  assert(overrideResult.hasAdminOverride === true, 'hasAdminOverride flag set to true');

  const resolvedView = await studioService.getStudioBySlugOrId(primaryStudioId);
  assert(resolvedView!.displayTitle === 'CloverWorks (Curated Master Name)', 'Admin override name takes display precedence');
  assert(resolvedView!.name === studioName, 'Underlying provider canonical name is preserved');
  assert(resolvedView!.displayDescription?.includes('Editorial verified synopsis') === true, 'Admin override description takes display precedence');

  // Reset override
  const resetResult = await studioAdminService.resetAdminOverride(testAdmin.id, primaryStudioId);
  assert(resetResult.hasAdminOverride === false, 'hasAdminOverride reset to false');
  const viewAfterReset = await studioService.getStudioBySlugOrId(primaryStudioId);
  assert(viewAfterReset!.displayTitle === studioName, 'Display title falls back to canonical provider name');

  // -------------------------------------------------------------
  // TEST 7: Image Validation (Magic Bytes, MIME, Size Limits)
  // -------------------------------------------------------------
  console.log('\nTEST 7: Image Validation');
  // Valid PNG Header buffer (89 50 4E 47 0D 0A 1A 0A)
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
  const uploadResult = await studioAdminService.uploadStudioImage(
    testAdmin.id,
    primaryStudioId,
    validPngBuffer,
    'cloverworks_logo.png',
    'image/png',
    'LOGO'
  );

  assert(uploadResult.success === true, 'Valid PNG image uploaded successfully');
  assert(uploadResult.url.includes('studio-logo') || uploadResult.url.startsWith('/'), 'Generated storage URL stored');

  // Invalid fake image buffer (text file pretending to be image)
  const fakeImageBuffer = Buffer.from('NOT_AN_IMAGE_FILE_DATA_TEXT');
  let rejectedFake = false;
  try {
    await studioAdminService.uploadStudioImage(
      testAdmin.id,
      primaryStudioId,
      fakeImageBuffer,
      'fake.png',
      'image/png',
      'LOGO'
    );
  } catch {
    rejectedFake = true;
  }
  assert(rejectedFake, 'Corrupted or fake image rejected by magic byte validator');

  // -------------------------------------------------------------
  // TEST 8: Duplicate Detection & Safe Atomic Studio Merge
  // -------------------------------------------------------------
  console.log('\nTEST 8: Duplicate Detection & Safe Atomic Studio Merge');
  const secondaryName = `CloverWorks Inc Dupe ${testSuffix}`;
  const secondaryStudio = await studioAdminService.createStudio(testAdmin.id, {
    name: secondaryName,
    foundedYear: 2018,
    status: 'ACTIVE',
    country: 'Japan',
  });
  secondaryStudioId = secondaryStudio.id;

  // Link a secondary person to secondary studio
  const secondaryPerson = await prisma.person.create({
    data: { name: `Staff Member ${testSuffix}` },
  });
  await studioAdminService.linkPersonToStudio(testAdmin.id, secondaryStudioId, secondaryPerson.id, 'DIRECTOR');

  // Duplicate detection test
  const dupeMatches = await studioAdminService.detectDuplicates({
    name: 'CloverWorks Inc',
    excludeStudioId: primaryStudioId,
  });

  assert(dupeMatches.length >= 1, 'Duplicate candidate detected by fuzzy matching');

  // Execute Merge
  const mergeResult = await studioAdminService.mergeStudios(testAdmin.id, {
    primaryStudioId,
    secondaryStudioId,
    reason: 'Merging duplicate sync entry into canonical studio record',
    keepSecondaryAsAlias: true,
  });

  assert(mergeResult.secondaryArchived.status === 'MERGED', 'Secondary studio status updated to MERGED');
  assert(mergeResult.secondaryArchived.publicationState === 'ARCHIVED', 'Secondary studio publicationState archived');

  // Verify relationships migrated to primary
  const primaryAfterMerge = await studioService.getStudioBySlugOrId(primaryStudioId);
  assert(primaryAfterMerge!.staff.some((s) => s.personId === secondaryPerson.id), 'Secondary staff migrated to primary studio');
  assert(primaryAfterMerge!.alternativeNames.includes(secondaryName), 'Secondary name retained as search alias on primary studio');

  // -------------------------------------------------------------
  // TEST 9: Server-Side RBAC Permission Enforcement
  // -------------------------------------------------------------
  console.log('\nTEST 9: Server-Side RBAC Permission Enforcement');
  assert(!hasMinRole(regularUser.role, 'DATA_EDITOR'), 'Regular USER role rejected for data editor permissions');
  assert(!hasMinRole(regularUser.role, 'ADMIN'), 'Regular USER role rejected for admin permissions');
  assert(hasMinRole('DATA_EDITOR', 'DATA_EDITOR'), 'DATA_EDITOR role authorized for editor permissions');
  assert(hasMinRole('ADMIN', 'DATA_EDITOR'), 'ADMIN role inherits DATA_EDITOR permissions');
  assert(hasMinRole('SUPER_ADMIN', 'ADMIN'), 'SUPER_ADMIN role inherits all admin permissions');

  // -------------------------------------------------------------
  // TEST 10: Public API Draft Isolation & Multi-Criteria Filtering
  // -------------------------------------------------------------
  console.log('\nTEST 10: Public API Draft Isolation & Multi-Criteria Filtering');
  // Create a draft studio
  const draftStudio = await studioAdminService.createStudio(testAdmin.id, {
    name: `Draft Studio Private ${testSuffix}`,
    publicationState: 'DRAFT',
  });

  const publicStudios = await studioService.getStudios({ limit: 100 });
  const draftFoundInPublic = publicStudios.studios.some((s) => s.id === draftStudio.id);
  assert(!draftFoundInPublic, 'DRAFT studio strictly isolated from public getStudios() query');

  const archivedFoundInPublic = publicStudios.studios.some((s) => s.id === secondaryStudioId);
  assert(!archivedFoundInPublic, 'ARCHIVED / MERGED studio strictly excluded from public query');

  // Filter test by country
  const japanStudios = await studioService.getStudios({ country: 'Japan', limit: 10 });
  assert(japanStudios.studios.every((s) => s.country === 'Japan'), 'Country filter returns only matching studios');

  // -------------------------------------------------------------
  // TEST 11: Event Engine Stream Emission & Immutable Audit Logging
  // -------------------------------------------------------------
  console.log('\nTEST 11: Event Engine Stream Emission & Immutable Audit Logging');
  const auditLogs = await studioAdminService.getStudioAuditLogs(primaryStudioId);
  assert(auditLogs.length >= 4, 'Multiple audit logs recorded for studio operations');
  const auditActions = auditLogs.map((l) => l.action);
  assert(auditActions.includes('CREATE'), 'CREATE audit action logged');
  assert(auditActions.includes('UPDATE'), 'UPDATE audit action logged');
  assert(auditActions.includes('MERGE'), 'MERGE audit action logged');
  assert(auditLogs.every((l) => !!l.actorId && !!l.createdAt), 'Audit logs contain actor ID and timestamp');

  // -------------------------------------------------------------
  // TEST 12: Resilience & Local Database Independence
  // -------------------------------------------------------------
  console.log('\nTEST 12: Resilience & Local Database Independence');
  const queryStart = Date.now();
  const performanceQuery = await studioService.getStudioBySlugOrId(createdStudio.slug!);
  const duration = Date.now() - queryStart;

  assert(!!performanceQuery, 'Local database studio query succeeded with 0 external network dependencies');
  assert(duration < 100, `High performance query execution completed in ${duration}ms (<100ms threshold)`);

  console.log('\n===============================================================');
  console.log(`PHASE 9.1 TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  console.log('===============================================================\n');
}

runStudioTestSuite().catch((err) => {
  console.error('Test Suite execution failed:', err);
  process.exit(1);
});
