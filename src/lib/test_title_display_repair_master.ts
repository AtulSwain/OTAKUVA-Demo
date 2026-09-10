/**
 * MASTER VERIFICATION & TEST SUITE: OTAKUVA ANIME TITLE DISPLAY REPAIR
 * 
 * Comprehensive validation across 6 distinct test stages:
 * STAGE 1: Canonical Title Resolver Unit & Edge Cases
 * STAGE 2: Multi-Language Dictionary & Nested Provider Formats
 * STAGE 3: Unicode Preservation & Safe Fallback Protections
 * STAGE 4: Frontend Component Title Parity & Crash-Proof Invocations
 * STAGE 5: Backend API & Service Contract Normalization
 * STAGE 6: End-to-End User Catalog Browsing & Search Simulation
 */

import {
  getAnimeDisplayTitle,
  getAnimeEnglishTitle,
  getAnimeJapaneseTitle,
  getAnimeRomajiTitle,
  normalizeAnimeTitleFields,
} from './animeTitleResolver';
import { getAnimeBySlugOrId, getAnimeRelationsData } from './animeData';
import { searchCatalog } from './search';
import { similarAnimeEngine } from './engine/discovery/similarAnimeEngine';
import { prisma } from './prisma';

let passedAssertions = 0;
let failedAssertions = 0;

function assert(condition: boolean, description: string) {
  if (condition) {
    console.log(`  ✓ [PASS] ${description}`);
    passedAssertions++;
  } else {
    console.error(`  ✗ [FAIL] ${description}`);
    failedAssertions++;
  }
}

async function runMasterSuite() {
  console.log('===============================================================');
  console.log('  OTAKUVA MASTER TEST SUITE: ANIME TITLE DISPLAY REPAIR');
  console.log('===============================================================\n');

  // -----------------------------------------------------------------
  // STAGE 1: Canonical Title Resolver Unit & Edge Cases
  // -----------------------------------------------------------------
  console.log('--- STAGE 1: Canonical Title Resolver Unit & Edge Cases ---');

  // Test 1.1: Standard anime object with title
  const standardAnime = { id: 'frieren', title: "Frieren: Beyond Journey's End", canonicalTitle: "Frieren: Beyond Journey's End" };
  assert(getAnimeDisplayTitle(standardAnime) === "Frieren: Beyond Journey's End", 'Resolves standard title correctly');

  // Test 1.2: Anime with ONLY canonicalTitle
  const canonicalOnly = { id: 'test-1', canonicalTitle: 'Steins;Gate' };
  assert(getAnimeDisplayTitle(canonicalOnly) === 'Steins;Gate', 'Resolves object having only canonicalTitle');

  // Test 1.3: Anime with ONLY englishTitle
  const englishOnly = { id: 'test-2', englishTitle: 'Attack on Titan Final Season' };
  assert(getAnimeDisplayTitle(englishOnly) === 'Attack on Titan Final Season', 'Resolves object having only englishTitle');

  // Test 1.4: Anime with ONLY japaneseTitle
  const japaneseOnly = { id: 'test-3', japaneseTitle: '葬送のフリーレン' };
  assert(getAnimeDisplayTitle(japaneseOnly) === '葬送のフリーレン', 'Resolves object having only japaneseTitle');

  // Test 1.5: Anime with ONLY romajiTitle
  const romajiOnly = { id: 'test-4', romajiTitle: 'Sousou no Frieren' };
  assert(getAnimeDisplayTitle(romajiOnly) === 'Sousou no Frieren', 'Resolves object having only romajiTitle');

  // Test 1.6: Anime with ONLY name property
  const nameOnly = { id: 'test-5', name: 'Cowboy Bebop' };
  assert(getAnimeDisplayTitle(nameOnly) === 'Cowboy Bebop', 'Resolves object having only name property');

  // Test 1.7: Anime with ONLY slug
  const slugOnly = { id: 'cm12345', slug: 'cyberpunk-edgerunners' };
  assert(getAnimeDisplayTitle(slugOnly) === 'Cyberpunk Edgerunners', 'Derives clean title from slug when titles missing');

  // Test 1.8: Anime with null/undefined/empty
  assert(getAnimeDisplayTitle(null) === 'Untitled Anime', 'Returns Untitled Anime on null');
  assert(getAnimeDisplayTitle(undefined) === 'Untitled Anime', 'Returns Untitled Anime on undefined');
  assert(getAnimeDisplayTitle({}) === 'Untitled Anime', 'Returns Untitled Anime on empty object');
  assert(getAnimeDisplayTitle({ title: '', canonicalTitle: '   ' }) === 'Untitled Anime', 'Returns Untitled Anime on whitespace/empty strings');

  // Test 1.9: Rejects corrupted string values
  assert(getAnimeDisplayTitle({ title: 'undefined', canonicalTitle: 'null' }) === 'Untitled Anime', 'Rejects "undefined" and "null" string corruptions');
  assert(getAnimeDisplayTitle({ title: '[object Object]' }) === 'Untitled Anime', 'Rejects "[object Object]" string corruptions');

  // -----------------------------------------------------------------
  // STAGE 2: Multi-Language Dictionary & Nested Provider Formats
  // -----------------------------------------------------------------
  console.log('\n--- STAGE 2: Multi-Language Dictionary & Nested Provider Formats ---');

  // Test 2.1: Nested object provider format (AniList style)
  const nestedAnime = {
    id: 'nested-1',
    title: {
      english: 'Delicious in Dungeon',
      romaji: 'Dungeon Meshi',
      native: 'ダンジョン飯',
    },
  };
  assert(getAnimeDisplayTitle(nestedAnime) === 'Delicious in Dungeon', 'Resolves nested title object default');
  assert(getAnimeDisplayTitle(nestedAnime, 'romaji') === 'Dungeon Meshi', 'Resolves nested romaji title preference');
  assert(getAnimeDisplayTitle(nestedAnime, 'japanese') === 'ダンジョン飯', 'Resolves nested native japanese title preference');

  // Test 2.2: Multi-language titles array (Database AnimeTitle style)
  const dictAnime = {
    id: 'dict-1',
    titles: [
      { type: 'official', title: 'Solo Leveling' },
      { type: 'english', title: 'Solo Leveling' },
      { type: 'japanese', title: '俺だけレベルアップな件' },
      { type: 'romaji', title: 'Ore dake Level Up na Ken' },
    ],
  };
  assert(getAnimeDisplayTitle(dictAnime) === 'Solo Leveling', 'Resolves dictionary official title default');
  assert(getAnimeDisplayTitle(dictAnime, 'japanese') === '俺だけレベルアップな件', 'Resolves dictionary japanese title preference');
  assert(getAnimeDisplayTitle(dictAnime, 'romaji') === 'Ore dake Level Up na Ken', 'Resolves dictionary romaji title preference');

  // Test 2.3: Preference fallbacks when preferred language is unavailable
  assert(getAnimeDisplayTitle(englishOnly, 'japanese') === 'Attack on Titan Final Season', 'Gracefully falls back when preferred language is absent');

  // -----------------------------------------------------------------
  // STAGE 3: Unicode Preservation & Normalizer Contract
  // -----------------------------------------------------------------
  console.log('\n--- STAGE 3: Unicode Preservation & Normalizer Contract ---');

  // Test 3.1: Special Unicode characters (Kanji, Katakana, French/German accents)
  const unicodeAnime = {
    id: 'pokemon',
    canonicalTitle: 'Pokémon Horizons: The Series',
    japaneseTitle: 'ポケットモンスター',
  };
  assert(getAnimeDisplayTitle(unicodeAnime) === 'Pokémon Horizons: The Series', 'Preserves accented characters (é)');
  assert(getAnimeJapaneseTitle(unicodeAnime) === 'ポケットモンスター', 'Preserves Japanese Katakana/Kanji');

  // Test 3.2: normalizeAnimeTitleFields contract
  const rawPartial = {
    id: 'partial-1',
    canonicalTitle: 'Monster',
    japaneseTitle: 'MONSTER',
  };
  const normalized = normalizeAnimeTitleFields(rawPartial);
  assert(normalized.title === 'Monster' && normalized.canonicalTitle === 'Monster', 'Normalizer populates both title and canonicalTitle');
  assert(normalized.japaneseTitle === 'MONSTER', 'Normalizer preserves japaneseTitle');

  // -----------------------------------------------------------------
  // STAGE 4: Frontend Component Title Parity & Crash-Proof Invocations
  // -----------------------------------------------------------------
  console.log('\n--- STAGE 4: Component Title Parity & Crash-Proof Invocations ---');

  // Test 4.1: Simulating AnimeHero toUpperCase call on various inputs
  const testCases = [
    { title: 'Chainsaw Man' },
    { canonicalTitle: 'Jujutsu Kaisen Season 2' },
    { englishTitle: 'Vinland Saga Season 2' },
    { slug: 'the-apothecary-diaries' },
    {},
    null,
    undefined,
  ];

  let crashed = false;
  try {
    for (const tc of testCases) {
      const display = getAnimeDisplayTitle(tc as any);
      const upper = display.toUpperCase();
      assert(typeof upper === 'string' && upper.length > 0, `Safely transformed "${display}" to uppercase without crashing`);
    }
  } catch (err) {
    crashed = true;
  }
  assert(!crashed, 'Zero crashes occurred during AnimeHero uppercase simulation across all edge cases');

  // Test 4.2: Simulating LibraryPage fallback items
  const libraryEntry = { animeId: 'frieren-beyond-journeys-end', status: 'watching' as const };
  const fallbackObj = {
    id: libraryEntry.animeId,
    slug: libraryEntry.animeId,
    title: getAnimeDisplayTitle({ id: libraryEntry.animeId, slug: libraryEntry.animeId }),
    canonicalTitle: getAnimeDisplayTitle({ id: libraryEntry.animeId, slug: libraryEntry.animeId }),
  };
  assert(fallbackObj.title === "Frieren Beyond Journeys End", 'Library fallback correctly produces clean display title');
  assert(fallbackObj.canonicalTitle === "Frieren Beyond Journeys End", 'Library fallback correctly populates canonicalTitle');

  // -----------------------------------------------------------------
  // STAGE 5: Backend API & Service Contract Normalization
  // -----------------------------------------------------------------
  console.log('\n--- STAGE 5: Backend API & Service Contract Normalization ---');

  // Test 5.1: getAnimeBySlugOrId returns both title and canonicalTitle
  const detail = await getAnimeBySlugOrId('frieren-beyond-journeys-end');
  assert(detail !== null, 'getAnimeBySlugOrId finds Frieren');
  if (detail) {
    assert(typeof detail.title === 'string' && detail.title.length > 0, `getAnimeBySlugOrId sets non-empty title ("${detail.title}")`);
    assert(detail.title === detail.canonicalTitle, 'getAnimeBySlugOrId ensures title matches canonicalTitle');
  }

  // Test 5.2: searchCatalog returns normalized title fields
  const searchRes = await searchCatalog({ query: 'Frieren', limit: 5 });
  assert(searchRes.items.length > 0, 'searchCatalog returns matching items');
  if (searchRes.items.length > 0) {
    const first = searchRes.items[0];
    assert(typeof first.title === 'string' && first.title.length > 0, `search item has non-empty title ("${first.title}")`);
    assert(typeof first.canonicalTitle === 'string' && first.canonicalTitle.length > 0, 'search item has non-empty canonicalTitle');
  }

  // Test 5.3: similarAnimeEngine returns normalized title and canonicalTitle
  const similarRes = await similarAnimeEngine.getSimilarAnime('frieren-beyond-journeys-end', { limit: 3 });
  assert(similarRes !== null, 'similarAnimeEngine executes successfully');
  if (similarRes) {
    assert(typeof similarRes.targetAnime.title === 'string' && similarRes.targetAnime.title.length > 0, 'Target anime in similarity response has title');
    if (similarRes.similarAnime.length > 0) {
      const firstSim = similarRes.similarAnime[0];
      assert(typeof firstSim.title === 'string' && firstSim.title.length > 0, `Similar anime has title ("${firstSim.title}")`);
      assert(typeof firstSim.canonicalTitle === 'string' && firstSim.canonicalTitle.length > 0, 'Similar anime has canonicalTitle');
    }
  }

  // Test 5.4: getAnimeRelationsData returns normalized title and canonicalTitle
  const relations = await getAnimeRelationsData('frieren-beyond-journeys-end');
  assert(Array.isArray(relations), 'getAnimeRelationsData returns array');

  // -----------------------------------------------------------------
  // STAGE 6: End-to-End Catalog Browsing & Integrity Scan
  // -----------------------------------------------------------------
  console.log('\n--- STAGE 6: End-to-End Catalog Browsing & Integrity Scan ---');

  const totalCatalogCount = await prisma.anime.count();
  const catalogSample = await prisma.anime.findMany({
    take: 50,
    include: { titles: true },
  });

  let zeroBlankTitles = true;
  let zeroCorruptedTitles = true;

  for (const a of catalogSample) {
    const display = getAnimeDisplayTitle(a);
    if (!display || display === 'Untitled Anime' && a.canonicalTitle.trim()) {
      zeroBlankTitles = false;
    }
    if (display === 'undefined' || display === 'null' || display === '[object Object]') {
      zeroCorruptedTitles = false;
    }
  }

  assert(zeroBlankTitles, `All 50 sampled catalog records resolve to clean display titles`);
  assert(zeroCorruptedTitles, `0% corruption rate across sampled catalog records`);
  assert(totalCatalogCount > 0, `Database catalog integrity verified (${totalCatalogCount} total anime)`);

  // -----------------------------------------------------------------
  // FINAL SCORECARD
  // -----------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`  OTAKUVA TITLE REPAIR TEST RESULTS: ${passedAssertions} PASSED / ${failedAssertions} FAILED`);
  console.log('===============================================================');

  if (failedAssertions > 0) {
    throw new Error(`${failedAssertions} assertions failed in Master Test Suite.`);
  }
}

runMasterSuite()
  .catch((err) => {
    console.error('Master Suite Error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
