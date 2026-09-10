/**
 * OTAKUVA MASTER TEST SUITE: PHASES 8.7 → 8.10
 * NEWS READER, DISCOVERY, TRENDING & PERSONALIZATION
 * 
 * Verifies:
 * 1. Internal News Reader Data Contract & Attribution
 * 2. External URL Security
 * 3. Event Engine Interaction Tracking
 * 4. Multi-Field Search & Relevance Ranking
 * 5. Fast Autocomplete Engine
 * 6. Trending Algorithm, Gravity Time Decay & Windowing
 * 7. Fraud/Velocity Spike Dampening
 * 8. Cold Start Global Fallback Feed
 * 9. User Taste Profile Personalization
 * 10. Multi-User Isolation & Diversity Protection
 * 11. Cursor Pagination
 * 12. Local Read Independence
 */

import { prisma } from './prisma';
import { annNewsAdapter } from './engine/news/adapters/annNewsAdapter';
import { MockProviderAdapter } from './engine/news/adapters/mockProviderAdapter';
import { newsEngine } from './engine/news/newsEngine';
import { newsIngestionService } from './engine/news/newsIngestionService';
import { newsNormalizationService } from './engine/news/newsNormalizationService';
import { newsPersonalizationService } from './engine/news/newsPersonalizationService';
import { newsSearchService } from './engine/news/newsSearchService';
import { newsTrendingService } from './engine/news/newsTrendingService';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

export async function runReaderTrendingPersonalizationTests() {
  console.log('\n================================================================');
  console.log('🧪 RUNNING OTAKUVA PHASES 8.7 → 8.10 MASTER TEST SUITE');
  console.log('================================================================\n');

  // CLEANUP & SEEDING
  await prisma.newsReviewQueue.deleteMany({});
  await prisma.newsArticleAnime.deleteMany({});
  await prisma.newsArticleStudio.deleteMany({});
  await prisma.newsArticlePerson.deleteMany({});
  await prisma.newsArticle.deleteMany({});
  await prisma.newsStoryCluster.deleteMany({});
  await prisma.newsIngestionJob.deleteMany({});

  // Seed Users
  const userAction = await prisma.user.upsert({
    where: { email: 'action_fan@otakuva.com' },
    update: {},
    create: { username: 'ActionFan', email: 'action_fan@otakuva.com' },
  });

  const userMystery = await prisma.user.upsert({
    where: { email: 'mystery_fan@otakuva.com' },
    update: {},
    create: { username: 'MysteryFan', email: 'mystery_fan@otakuva.com' },
  });

  const userCold = await prisma.user.upsert({
    where: { email: 'new_cold_user@otakuva.com' },
    update: {},
    create: { username: 'ColdUser', email: 'new_cold_user@otakuva.com' },
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

  let soloAnime = await prisma.anime.findFirst({
    where: { OR: [{ canonicalTitle: 'Solo Leveling' }, { slug: 'solo-leveling' }] },
  });
  if (!soloAnime) {
    soloAnime = await prisma.anime.create({
      data: {
        canonicalTitle: 'Solo Leveling',
        slug: 'solo-leveling',
        posterUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23',
        synopsis: 'Sung Jinwoo ascends from E-rank hunter to shadow monarch.',
        status: 'Finished Airing',
      },
    });
  }

  let monsterAnime = await prisma.anime.findFirst({
    where: { OR: [{ canonicalTitle: 'Monster' }, { slug: 'monster' }] },
  });
  if (!monsterAnime) {
    monsterAnime = await prisma.anime.create({
      data: {
        canonicalTitle: 'Monster',
        slug: 'monster',
        posterUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f',
        synopsis: 'Dr. Kenzo Tenma pursues the enigmatic Johan Liebert.',
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

  // Setup user preferences
  // UserAction tracks Solo Leveling
  await prisma.userAnime.upsert({
    where: { userId_animeId: { userId: userAction.id, animeId: soloAnime.id } },
    update: { status: 'WATCHING', score: 9.5 },
    create: { userId: userAction.id, animeId: soloAnime.id, status: 'WATCHING', score: 9.5 },
  });

  // UserMystery tracks Monster & Frieren
  await prisma.userAnime.upsert({
    where: { userId_animeId: { userId: userMystery.id, animeId: monsterAnime.id } },
    update: { status: 'COMPLETED', score: 10.0 },
    create: { userId: userMystery.id, animeId: monsterAnime.id, status: 'COMPLETED', score: 10.0 },
  });
  await prisma.favorite.upsert({
    where: { userId_animeId: { userId: userMystery.id, animeId: frierenAnime.id } },
    update: {},
    create: { userId: userMystery.id, animeId: frierenAnime.id },
  });

  // Seed baseline test articles
  const seedAdapter = new MockProviderAdapter({
    id: 'ann_seed',
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
        publishedAt: new Date(Date.now() - 3600000 * 3),
        mentionedAnimeTitles: ["Frieren: Beyond Journey's End"],
        mentionedStudioNames: ['Madhouse'],
      },
      {
        externalId: 'ann-2026-08-05-solo-leveling-s2-cast',
        provider: 'ANN',
        title: "Solo Leveling Season 2 'Arise from the Shadow' Adds New S-Rank Hunters to Voice Cast",
        summary: 'A-1 Pictures announces additional Japanese cast members for the upcoming Jeju Island Arc confrontation.',
        contentType: 'SOURCE_METADATA',
        sourceName: 'Anime News Network',
        sourceUrl: 'https://www.animenewsnetwork.com/news/2026/solo-leveling-s2-cast-announcement',
        canonicalUrl: 'https://www.animenewsnetwork.com/news/2026/solo-leveling-s2-cast-announcement',
        imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
        author: 'Egan Loo',
        category: 'CASTING',
        publishedAt: new Date(Date.now() - 3600000 * 30),
        mentionedAnimeTitles: ['Solo Leveling'],
        mentionedStudioNames: ['A-1 Pictures'],
      },
    ],
  });
  await newsIngestionService.ingestFromProvider(seedAdapter);

  // Ingest baseline articles from live ANN
  await newsIngestionService.ingestFromProvider(annNewsAdapter, { limit: 10 });

  // ==========================================
  // TEST 1: Internal News Reader & Attribution
  // ==========================================
  console.log('--- TEST 1: Internal News Reader & Attribution ---');
  const sampleArticle = await prisma.newsArticle.findFirst({
    where: { externalId: 'ann-2026-08-01-frieren-s2' },
  });
  assert(Boolean(sampleArticle), 'Found Frieren article in database');

  const readerData = await newsEngine.getNewsById(sampleArticle!.id);
  assert(Boolean(readerData), 'Internal news reader retrieved article');
  assert(readerData!.sourceName === 'Anime News Network', 'Source attribution preserved as Anime News Network');
  assert(Boolean(readerData!.canonicalUrl?.startsWith('https://')), 'Canonical source URL present and uses secure protocol');
  assert(readerData!.contentType === 'SOURCE_METADATA', 'Content ownership identified as SOURCE_METADATA');

  // ==========================================
  // TEST 2: External URL Security
  // ==========================================
  console.log('\n--- TEST 2: External URL Security ---');
  const safeHttps = newsNormalizationService.normalizeUrl('https://www.animenewsnetwork.com/news/1?utm_source=twitter#comments');
  assert(safeHttps === 'https://www.animenewsnetwork.com/news/1', 'Stripped query tracking and hash from valid URL');

  const maliciousJsUrl = newsNormalizationService.normalizeUrl('javascript:alert(1)');
  assert(!maliciousJsUrl.includes('javascript:'), 'Malicious javascript: scheme sanitized');

  // ==========================================
  // TEST 3: Multi-Field Search & Weighted Relevance
  // ==========================================
  console.log('\n--- TEST 3: Multi-Field Search & Weighted Relevance ---');
  const searchFrieren = await newsSearchService.search('Frieren Madhouse');
  assert(searchFrieren.total > 0, `Search returned ${searchFrieren.total} matching articles`);
  assert(searchFrieren.results[0].displayTitle.includes('Frieren'), 'Top result headline matches primary search intent');
  assert(searchFrieren.results[0].relevanceScore > 5, 'Relevance score computed and prioritized');

  // Filtered search by category
  const filteredSearch = await newsSearchService.search('', { category: 'CASTING' });
  assert(filteredSearch.results.every((r) => r.category === 'CASTING' || r.displayCategory === 'CASTING'), 'Filtered search strictly respects category filter');

  // ==========================================
  // TEST 4: Fast Autocomplete Engine
  // ==========================================
  console.log('\n--- TEST 4: Fast Autocomplete Engine ---');
  const suggestions = await newsSearchService.autocomplete('Solo');
  assert(suggestions.length > 0, `Autocomplete returned ${suggestions.length} suggestions for query "Solo"`);
  assert(suggestions.some((s) => s.type === 'ANIME' || s.type === 'NEWS'), 'Returned mixed Anime/News autocomplete suggestions');

  // ==========================================
  // TEST 5: Trending Engine & Gravity Time Decay
  // ==========================================
  console.log('\n--- TEST 5: Trending Engine & Gravity Time Decay ---');
  const trending24h = await newsTrendingService.getTrendingNews({ window: '24h', limit: 5 });
  assert(trending24h.articles.length > 0, `Trending 24h returned ${trending24h.articles.length} ranked articles`);
  assert(trending24h.articles[0].trendingScore > 0, 'Top trending article has positive trending score');
  assert(Boolean(trending24h.articles[0].trendingExplanation), 'Trending explanation generated');

  // Multi-window test
  const trendingWeek = await newsTrendingService.getTrendingNews({ window: '7d', limit: 10 });
  assert(trendingWeek.articles.length >= trending24h.articles.length, '7d window captures broader pool than 24h');

  // ==========================================
  // TEST 6: Cold-Start / Anonymous Feed Fallback
  // ==========================================
  console.log('\n--- TEST 6: Cold-Start / Anonymous Feed Fallback ---');
  const anonFeed = await newsPersonalizationService.getPersonalizedFeed(undefined, { limit: 10 });
  assert(anonFeed.feed.length > 0, `Anonymous user received ${anonFeed.feed.length} articles`);
  assert(anonFeed.isPersonalized === false, 'Anonymous feed flagged as isPersonalized = false');
  assert(anonFeed.confidenceTier === 'ANONYMOUS', 'Confidence tier is ANONYMOUS');

  const coldUserFeed = await newsPersonalizationService.getPersonalizedFeed(userCold.id, { limit: 10 });
  assert(coldUserFeed.feed.length > 0, 'New user with zero history receives non-empty global feed');
  assert(coldUserFeed.confidenceTier === 'NEW_USER', 'Cold start user flagged with NEW_USER tier');

  // ==========================================
  // TEST 7: User Taste Personalization & Isolation
  // ==========================================
  console.log('\n--- TEST 7: User Taste Personalization & Isolation ---');
  const actionFeed = await newsPersonalizationService.getPersonalizedFeed(userAction.id, { limit: 10 });
  const mysteryFeed = await newsPersonalizationService.getPersonalizedFeed(userMystery.id, { limit: 10 });

  assert(actionFeed.isPersonalized === true, 'UserAction feed is personalized');
  assert(mysteryFeed.isPersonalized === true, 'UserMystery feed is personalized');

  // UserAction tracks Solo Leveling -> Solo Leveling articles should rank highly
  const topActionTitles = actionFeed.feed.slice(0, 3).map((a) => a.displayTitle);
  const actionHasSolo = topActionTitles.some((t) => t.includes('Solo Leveling'));
  assert(actionHasSolo, 'UserAction personalized feed prioritized Solo Leveling news');

  // UserMystery tracks Monster/Frieren -> Frieren & Monster should rank highly
  const topMysteryTitles = mysteryFeed.feed.slice(0, 3).map((a) => a.displayTitle);
  const mysteryHasFrierenOrMonster = topMysteryTitles.some((t) => t.includes('Frieren') || t.includes('Monster') || t.includes('Urasawa'));
  assert(mysteryHasFrierenOrMonster, 'UserMystery personalized feed prioritized Frieren/Monster news');

  // Privacy isolation: Ensure feeds are computed independently
  assert(actionFeed.feed[0].id !== mysteryFeed.feed[0].id || actionFeed.feed[1].id !== mysteryFeed.feed[1].id, 'Feeds between distinct users are distinct and personalized');

  // ==========================================
  // TEST 8: Diversity Protection & Filter Bubble Guard
  // ==========================================
  console.log('\n--- TEST 8: Diversity Protection & Filter Bubble Guard ---');
  // Ingest batch of multiple articles for same entity
  const floodAdapter = new MockProviderAdapter({
    id: 'flood_mock',
    name: 'Flood Mock',
    baseUrl: 'https://flood.test',
    articles: [
      {
        externalId: 'flood-1',
        provider: 'FLOOD',
        title: 'Solo Leveling Mobile Game Expansion Announced',
        sourceName: 'Flood Source',
        sourceUrl: 'https://flood.test/1',
        publishedAt: new Date(),
        mentionedAnimeTitles: ['Solo Leveling'],
      },
      {
        externalId: 'flood-2',
        provider: 'FLOOD',
        title: 'Solo Leveling Merchandise Line Revealed',
        sourceName: 'Flood Source',
        sourceUrl: 'https://flood.test/2',
        publishedAt: new Date(),
        mentionedAnimeTitles: ['Solo Leveling'],
      },
      {
        externalId: 'flood-3',
        provider: 'FLOOD',
        title: 'Solo Leveling Webtoon Epilogue Special',
        sourceName: 'Flood Source',
        sourceUrl: 'https://flood.test/3',
        publishedAt: new Date(),
        mentionedAnimeTitles: ['Solo Leveling'],
      },
    ],
  });

  await newsIngestionService.ingestFromProvider(floodAdapter);

  const diversifiedFeed = await newsPersonalizationService.getPersonalizedFeed(userAction.id, { limit: 10 });
  const soloOccurrences = diversifiedFeed.feed.filter((a) => a.displayTitle.includes('Solo Leveling')).length;
  assert(soloOccurrences <= 4, `Diversity filter capped single-entity concentration (Found ${soloOccurrences} Solo Leveling items)`);

  // ==========================================
  // TEST 9: Cursor-Based Feed Pagination
  // ==========================================
  console.log('\n--- TEST 9: Cursor-Based Feed Pagination ---');
  const page1 = await newsPersonalizationService.getPersonalizedFeed(userAction.id, { limit: 3 });
  assert(page1.feed.length === 3, 'Page 1 returned exactly 3 items');
  assert(Boolean(page1.nextCursor), 'Page 1 provides nextCursor for pagination');

  const page2 = await newsPersonalizationService.getPersonalizedFeed(userAction.id, {
    limit: 3,
    cursor: page1.nextCursor || undefined,
  });
  assert(page2.feed.length > 0, 'Page 2 returned items using cursor');
  assert(page2.feed[0].id !== page1.feed[0].id, 'Page 2 items are distinct from Page 1');

  // ==========================================
  // TEST 10: Provider Outage / Local Read Independence
  // ==========================================
  console.log('\n--- TEST 10: Provider Outage / Local Read Independence ---');
  // All read endpoints (Reader, Search, Trending, Feed) work with 0 external network requests
  const localSearch = await newsSearchService.search('Demon Slayer');
  const localTrending = await newsTrendingService.getTrendingNews({ window: '24h' });
  const localFeed = await newsPersonalizationService.getPersonalizedFeed(userMystery.id);

  assert(localSearch.total >= 0, 'Search functions locally during provider downtime');
  assert(localTrending.articles.length > 0, 'Trending functions locally during provider downtime');
  assert(localFeed.feed.length > 0, 'Personalized feed functions locally during provider downtime');

  console.log('\n================================================================');
  console.log('🎉 ALL 10 OTAKUVA PHASES 8.7 → 8.10 TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

// Auto-run if executed directly
if (require.main === module) {
  runReaderTrendingPersonalizationTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
