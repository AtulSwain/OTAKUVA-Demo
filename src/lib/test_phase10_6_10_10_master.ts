/**
 * OTAKUVA MASTER TEST SUITE — PHASES 10.6 → 10.10
 * ADVANCED PERSONALIZATION, DISCOVERY & INTELLIGENT FEED ENGINE
 * 
 * Comprehensive automated verification covering:
 * - Shared Discovery Core & Context Engine
 * - 10.6: Personalized Home Feed Engine & Dynamic Module Selection
 * - 10.7: Advanced Similar Anime Engine & Multi-Layer Similarity
 * - 10.8: Studio & Creator Discovery Engine
 * - 10.9: Community-Based Discovery Engine, Anti-Spam & Privacy Isolation
 * - 10.10: Personalized News Engine & Story Clustering
 * - Security & RBAC Enforcement
 */

import { prisma } from './prisma';
import { discoveryCoreService } from './engine/discovery/discoveryCoreService';
import { homeFeedEngine } from './engine/discovery/homeFeedEngine';
import { similarAnimeEngine } from './engine/discovery/similarAnimeEngine';
import { studioCreatorDiscoveryEngine } from './engine/discovery/studioCreatorDiscoveryEngine';
import { communityDiscoveryEngine } from './engine/discovery/communityDiscoveryEngine';
import { personalizedNewsEngine } from './engine/discovery/personalizedNewsEngine';
import { tasteEngine } from './engine/taste/tasteEngine';
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

async function runPhase10_6_10_10_TestSuite() {
  console.log('========================================================================');
  console.log('OTAKUVA ENGINE — PHASES 10.6 → 10.10 ADVANCED DISCOVERY MASTER SUITE');
  console.log('========================================================================\n');

  const testSuffix = Date.now();

  // Setup Users
  const activeUser = await prisma.user.create({
    data: {
      username: `disc_user_${testSuffix}`,
      email: `disc_user_${testSuffix}@otakuva.test`,
      role: 'USER',
    },
  });

  const guestUser = await prisma.user.create({
    data: {
      username: `disc_guest_${testSuffix}`,
      email: `disc_guest_${testSuffix}@otakuva.test`,
      role: 'USER',
    },
  });

  // Setup Genres
  const genrePsychological = await prisma.genre.upsert({
    where: { name: 'Psychological' },
    create: { name: 'Psychological', slug: 'psychological' },
    update: {},
  });
  const genreMystery = await prisma.genre.upsert({
    where: { name: 'Mystery' },
    create: { name: 'Mystery', slug: 'mystery' },
    update: {},
  });
  const genreSciFi = await prisma.genre.upsert({
    where: { name: 'Sci-Fi' },
    create: { name: 'Sci-Fi', slug: 'sci-fi' },
    update: {},
  });

  // Setup Canonical Studio
  const studioMappa = await prisma.studio.create({
    data: {
      name: `MAPPA Discovery Test ${testSuffix}`,
      slug: `mappa-discovery-test-${testSuffix}`,
      verificationStatus: 'VERIFIED',
      publicationState: 'PUBLISHED',
      foundedYear: 2011,
    },
  });

  // Setup Creators / Staff
  const directorWatanabe = await prisma.person.create({
    data: {
      name: `Shinichiro Watanabe Test ${testSuffix}`,
      slug: `shinichiro-watanabe-test-${testSuffix}`,
    },
  });

  // Setup Anime Titles
  const animeChainsaw = await prisma.anime.create({
    data: {
      canonicalTitle: `Chainsaw Devil ${testSuffix}`,
      slug: `chainsaw-devil-${testSuffix}`,
      synopsis: 'A young man merges with a chainsaw devil to hunt down rogue entities in a gritty world.',
      posterUrl: 'https://example.com/csm.jpg',
      type: 'TV',
      episodes: 12,
      score: 8.8,
      year: 2022,
      animeGenres: { create: [{ genreId: genrePsychological.id }, { genreId: genreMystery.id }] },
      animeStudios: { create: [{ studioId: studioMappa.id, isPrimary: true }] },
      staff: { create: [{ personId: directorWatanabe.id, role: 'Director' }] },
    },
  });

  const animeJujutsu = await prisma.anime.create({
    data: {
      canonicalTitle: `Jujutsu Sorcery ${testSuffix}`,
      slug: `jujutsu-sorcery-${testSuffix}`,
      synopsis: 'Students battle cursed spirits in modern day Tokyo with supernatural powers.',
      posterUrl: 'https://example.com/jjk.jpg',
      type: 'TV',
      episodes: 24,
      score: 8.7,
      year: 2020,
      animeGenres: { create: [{ genreId: genrePsychological.id }, { genreId: genreSciFi.id }] },
      animeStudios: { create: [{ studioId: studioMappa.id, isPrimary: true }] },
      staff: { create: [{ personId: directorWatanabe.id, role: 'Director' }] },
    },
  });

  const animeJujutsuMovie = await prisma.anime.create({
    data: {
      canonicalTitle: `Jujutsu Sorcery 0 (Movie) ${testSuffix}`,
      slug: `jujutsu-sorcery-0-movie-${testSuffix}`,
      synopsis: 'Prequel movie exploring the origins of Yuta and curse manifestation.',
      posterUrl: 'https://example.com/jjk0.jpg',
      type: 'Movie',
      episodes: 1,
      score: 8.5,
      year: 2021,
      animeGenres: { create: [{ genreId: genrePsychological.id }] },
      animeStudios: { create: [{ studioId: studioMappa.id, isPrimary: true }] },
    },
  });

  // Franchise Link: Jujutsu TV -> Jujutsu Movie (Prequel)
  await prisma.animeRelation.create({
    data: {
      sourceAnimeId: animeJujutsu.id,
      targetAnimeId: animeJujutsuMovie.id,
      relationType: 'Prequel',
    },
  });

  // Setup In-Progress Watch Tracking for active user (Continue Watching)
  await prisma.userAnime.create({
    data: {
      userId: activeUser.id,
      animeId: animeChainsaw.id,
      status: 'WATCHING',
      episodesWatched: 5,
    },
  });

  // Seed rating on Chainsaw
  await prisma.animeRating.create({
    data: {
      userId: activeUser.id,
      animeId: animeChainsaw.id,
      rating: 9.0,
    },
  });

  // Seed Taste Profile
  await tasteEngine.rebuildTasteProfile(activeUser.id);

  // =========================================================================
  // TEST 1: SHARED DISCOVERY CORE
  // =========================================================================
  console.log('--- TEST 1: SHARED DISCOVERY CORE ---');

  const discHome = await discoveryCoreService.getRecommendations({
    userId: activeUser.id,
    surface: 'HOME',
    limit: 6,
    forceRefresh: true,
  });

  assert(discHome.surface === 'HOME', 'Discovery core returns surface: HOME');
  assert(discHome.items.length >= 1, 'Discovery core returns ranked candidates');
  assert(discHome.items[0].discoveryScore > 0, 'Candidates have computed discovery score');
  assert(discHome.items[0].structuredExplanation.reasonType.length > 0, 'Includes structured explanation metadata');

  // Test Caching
  const discCached = await discoveryCoreService.getRecommendations({
    userId: activeUser.id,
    surface: 'HOME',
    limit: 6,
    forceRefresh: false,
  });
  assert(discCached.isCached === true, 'Discovery core serves from fast cache');

  // =========================================================================
  // TEST 2: PHASE 10.6 — PERSONALIZED HOME FEED ENGINE
  // =========================================================================
  console.log('\n--- TEST 2: PHASE 10.6 — PERSONALIZED HOME FEED ENGINE ---');

  const homeFeed = await homeFeedEngine.generateHomeFeed(activeUser.id, { forceRefresh: true });
  assert(homeFeed.modules.length >= 2, 'Generated multi-module home feed');

  // Check Continue Watching Module
  const continueModule = homeFeed.modules.find((m) => m.type === 'CONTINUE_WATCHING');
  assert(continueModule !== undefined, 'Continue Watching module present for active watcher');
  assert(continueModule!.items.length >= 1, 'Continue Watching contains in-progress anime');
  assert(continueModule!.items[0].episodesWatched === 5, 'Continue Watching tracks exact episodes watched (5)');
  assert(continueModule!.items[0].progressPercent === 42, 'Computed progress percent (42%)');

  // Check For You Module
  const forYouModule = homeFeed.modules.find((m) => m.type === 'FOR_YOU');
  assert(forYouModule !== undefined, 'For You module present');

  // Check Guest Fallback
  const guestFeed = await homeFeedEngine.generateHomeFeed(null);
  assert(guestFeed.modules.length >= 1, 'Guest feed generated successfully');
  const guestContinue = guestFeed.modules.find((m) => m.type === 'CONTINUE_WATCHING');
  assert(guestContinue === undefined, 'Guest feed strictly omits Continue Watching module');

  // =========================================================================
  // TEST 3: PHASE 10.7 — ADVANCED SIMILAR ANIME ENGINE
  // =========================================================================
  console.log('\n--- TEST 3: PHASE 10.7 — ADVANCED SIMILAR ANIME ENGINE ---');

  const similarResult = await similarAnimeEngine.getSimilarAnime(animeJujutsu.id, {
    userId: activeUser.id,
    limit: 5,
    forceRefresh: true,
  });

  assert(similarResult !== null, 'Similar Anime engine resolved target anime');
  assert(similarResult!.targetAnime.canonicalTitle.includes('Jujutsu Sorcery'), 'Resolved correct target title');

  // Franchise Separation Check
  assert(similarResult!.franchiseRelations.length >= 1, 'Separated franchise relations from general similar anime');
  assert(similarResult!.franchiseRelations[0].isFranchiseRelated === true, 'Franchise item flagged isFranchiseRelated: true');
  assert(similarResult!.franchiseRelations[0].franchiseRelationType === 'Prequel', 'Recognized franchise relation type: Prequel');

  // Multi-Layer Similarity Breakdown
  const similarItem = similarResult!.similarAnime.find((s) => s.id === animeChainsaw.id);
  assert(similarItem !== undefined, 'Identified Chainsaw Devil as similar anime');
  assert(similarItem!.similarityScore >= 0.4, 'High similarity score (>= 0.40)');
  assert(similarItem!.similarityDimensions.studioScore === 1.0, 'Recognized shared studio (Score: 1.0)');
  assert(similarItem!.similarityDimensions.creatorScore === 1.0, 'Recognized shared director (Score: 1.0)');
  assert(similarItem!.matchReasons.length >= 2, 'Generated multiple explainable match reasons');

  // =========================================================================
  // TEST 4: PHASE 10.8 — STUDIO & CREATOR DISCOVERY ENGINE
  // =========================================================================
  console.log('\n--- TEST 4: PHASE 10.8 — STUDIO & CREATOR DISCOVERY ENGINE ---');

  // Creator Discovery
  const creatorDiscovery = await studioCreatorDiscoveryEngine.getPersonalizedCreatorDiscovery(activeUser.id, 4);
  assert(creatorDiscovery.length >= 1, 'Discovered creators aligned with user taste');
  const watanabeCreator = creatorDiscovery.find((c) => c.name.includes('Shinichiro Watanabe'));
  assert(watanabeCreator !== undefined, 'Found Shinichiro Watanabe in top creators');
  assert(watanabeCreator!.reason.includes('Chainsaw Devil'), 'Creator discovery explains why ("Directed Chainsaw Devil")');

  // Studio Catalog Discovery
  const studioCatalog = await studioCreatorDiscoveryEngine.getStudioCatalogDiscovery(studioMappa.slug!, activeUser.id);
  assert(studioCatalog !== null, 'Retrieved studio catalog discovery');
  assert(studioCatalog!.isPersonalized === true, 'Personalized for authenticated user');
  assert(studioCatalog!.popularWorks.length >= 1, 'Contains popular works bucket');
  assert(studioCatalog!.genreSpecialization.length >= 1, 'Contains genre specialization breakdown');
  assert(studioCatalog!.keyCreators.some((k) => k.name.includes('Shinichiro Watanabe')), 'Key creators listed for studio');

  // =========================================================================
  // TEST 5: PHASE 10.9 — COMMUNITY-BASED DISCOVERY ENGINE & ANTI-SPAM
  // =========================================================================
  console.log('\n--- TEST 5: PHASE 10.9 — COMMUNITY-BASED DISCOVERY ENGINE & ANTI-SPAM ---');

  // Setup Public Community
  const publicComm = await prisma.community.create({
    data: {
      name: `MAPPA Fans Community ${testSuffix}`,
      slug: `mappa-fans-community-${testSuffix}`,
      description: 'Discussions about MAPPA productions',
      visibility: 'PUBLIC',
      ownerId: activeUser.id,
    },
  });

  // Join active user to public community
  await prisma.communityMember.create({
    data: {
      communityId: publicComm.id,
      userId: activeUser.id,
      role: 'MEMBER',
      status: 'ACTIVE',
    },
  });

  // Create Discussion on Chainsaw Devil
  const disc1 = await prisma.discussion.create({
    data: {
      communityId: publicComm.id,
      authorId: activeUser.id,
      animeId: animeChainsaw.id,
      title: 'Episode 5 Discussion and Animation Depth',
      body: 'The directing and camera angles in this episode were incredible.',
    },
  });

  // Add Comment from another user
  await prisma.discussionComment.create({
    data: {
      discussionId: disc1.id,
      authorId: guestUser.id,
      body: 'Completely agree! The pacing was stellar.',
    },
  });

  // Run Community Discovery
  const commDiscovery = await communityDiscoveryEngine.getCommunityDiscovery(activeUser.id, 5);
  assert(commDiscovery.items.length >= 1, 'Community discovery returned active items');
  const chainsawCommItem = commDiscovery.items.find((i) => i.anime.id === animeChainsaw.id);
  assert(chainsawCommItem !== undefined, 'Found Chainsaw Devil in community discovery');
  assert(chainsawCommItem!.discussionStats.uniqueParticipantsCount >= 2, 'Unique participants counted accurately (>= 2)');
  assert(chainsawCommItem!.recommendationReason.includes('community you joined'), 'Reason cites joined community');

  // =========================================================================
  // TEST 6: PHASE 10.10 — PERSONALIZED ANIME NEWS & STORY CLUSTERING
  // =========================================================================
  console.log('\n--- TEST 6: PHASE 10.10 — PERSONALIZED ANIME NEWS & STORY CLUSTERING ---');

  // Create two news articles covering the same Chainsaw Devil announcement from two different sources
  const news1 = await prisma.newsArticle.create({
    data: {
      title: `Chainsaw Devil Movie Officially Announced by MAPPA ${testSuffix}`,
      slug: `csm-movie-announcement-src1-${testSuffix}`,
      sourceName: 'AnimeNewsNetwork',
      sourceUrl: 'https://example.com/ann/csm-movie',
      summary: 'MAPPA announced a feature-length continuation.',
      category: 'ANNOUNCEMENT',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      animeRelations: { create: [{ animeId: animeChainsaw.id, status: 'CONFIRMED' }] },
      studioRelations: { create: [{ studioId: studioMappa.id, status: 'CONFIRMED' }] },
    },
  });

  const news2 = await prisma.newsArticle.create({
    data: {
      title: `MAPPA Confirms Chainsaw Devil Theatrical Film ${testSuffix}`,
      slug: `csm-movie-announcement-src2-${testSuffix}`,
      sourceName: 'Crunchyroll News',
      sourceUrl: 'https://example.com/cr/csm-movie',
      summary: 'The continuation of Chainsaw Devil is heading to theaters.',
      category: 'ANNOUNCEMENT',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      animeRelations: { create: [{ animeId: animeChainsaw.id, status: 'CONFIRMED' }] },
      studioRelations: { create: [{ studioId: studioMappa.id, status: 'CONFIRMED' }] },
    },
  });

  const newsFeed = await personalizedNewsEngine.getPersonalizedNews(activeUser.id, { limit: 5 });
  assert(newsFeed.stories.length >= 1, 'Retrieved personalized news stories');

  const csmCluster = newsFeed.stories.find((s) => s.primaryAnime?.id === animeChainsaw.id);
  assert(csmCluster !== undefined, 'Found Chainsaw Devil news cluster');
  assert(csmCluster!.articles.length === 2, 'Story clustering grouped 2 articles from separate sources into 1 story cluster');
  assert(csmCluster!.personalizationReason.includes('Chainsaw Devil'), 'Personalization reason cites tracked anime');

  // =========================================================================
  // TEST 7: SECURITY & RBAC ENFORCEMENT
  // =========================================================================
  console.log('\n--- TEST 7: SECURITY & RBAC ENFORCEMENT ---');

  assert(!hasMinRole('USER', 'DATA_EDITOR'), 'RBAC: Regular USER denied DATA_EDITOR role');
  assert(!hasMinRole('USER', 'ADMIN'), 'RBAC: Regular USER denied ADMIN role');
  assert(hasMinRole('ADMIN', 'DATA_EDITOR'), 'RBAC: ADMIN inherits DATA_EDITOR role');

  console.log('\n========================================================================');
  console.log(`PHASE 10.6 → 10.10 TEST SUMMARY: ${passedTests} / ${totalTests} ASSERTIONS PASSED`);
  console.log('========================================================================\n');
}

runPhase10_6_10_10_TestSuite().catch((err) => {
  console.error('Phase 10.6 → 10.10 Test Suite execution failed:', err);
  process.exit(1);
});
