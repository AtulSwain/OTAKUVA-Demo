/**
 * OTAKUVA — JIKAN V4 API INTEGRATION & CATALOG MASTER TEST SUITE
 * Execution: npx tsx src/lib/test_jikan_api_integration_master.ts
 */

import {
  getJikanAnimeFull,
  getJikanAnimeCharacters,
  getJikanAnimeStaff,
  getJikanAnimeEpisodes,
  getJikanAnimeNews,
  getJikanAnimeRelations,
  searchJikanAnime,
  getJikanTopAnime,
  getJikanCurrentSeason,
  getJikanProducers,
} from './jikanService';
import { getAnimeCharactersData, getAnimeStaffData, getAnimeBySlugOrId } from './animeData';

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

async function runJikanTestSuite() {
  console.log('========================================================================');
  console.log('  OTAKUVA — JIKAN V4 API INTEGRATION MASTER TEST SUITE');
  console.log('  API Reference: https://docs.api.jikan.moe/'); // provider-call-check-ignore: docs link, not a call
  console.log('========================================================================\n');

  // STAGE 1: TOP & SEASONAL ANIME APIs
  console.log('--- STAGE 1: TOP & SEASONAL ANIME APIS ---');
  try {
    const top = await getJikanTopAnime(1, 5);
    assert(Array.isArray(top.animes) && top.animes.length > 0, 'getJikanTopAnime returns non-empty anime list');
    assert(Boolean(top.animes[0]?.mal_id), `Top anime mal_id exists: ${top.animes[0]?.mal_id}`);
    assert(Boolean(top.animes[0]?.title), `Top anime title exists: "${top.animes[0]?.title}"`);

    const season = await getJikanCurrentSeason(1, 5);
    assert(Array.isArray(season.animes), 'getJikanCurrentSeason returns anime list');
  } catch (err: any) {
    console.error('Stage 1 error:', err);
  }

  // STAGE 2: ANIME DETAIL & FULL RESOURCE API
  console.log('\n--- STAGE 2: ANIME FULL RESOURCE API (MAL ID 1: Cowboy Bebop) ---');
  try {
    const full = await getJikanAnimeFull(1);
    assert(Boolean(full), 'getJikanAnimeFull returns anime resource');
    assert(full?.mal_id === 1, 'MAL ID matches 1');
    assert(Boolean(full?.title), `Canonical title resolved: "${full?.title}"`);
    assert(Array.isArray(full?.studios) && full.studios.length > 0, `Studio resolved: "${full?.studios?.[0]?.name}"`);
    assert(Array.isArray(full?.genres) && full.genres.length > 0, 'Genres array resolved');
  } catch (err: any) {
    console.error('Stage 2 error:', err);
  }

  // STAGE 3: CHARACTERS & VOICE ACTORS API
  console.log('\n--- STAGE 3: CHARACTERS & VOICE ACTORS API ---');
  try {
    const chars = await getJikanAnimeCharacters(1);
    assert(Array.isArray(chars) && chars.length > 0, `Characters fetched (count: ${chars.length})`);
    const spike = chars.find((c) => c.name.toLowerCase().includes('spike'));
    assert(Boolean(spike), 'Spike Spiegel found in characters');
    assert(Boolean(spike?.imageUrl), 'Character image URL present');
    assert(Array.isArray(spike?.voiceActors), 'Voice actors array present on character');
    assert(spike?.role === 'Main' || spike?.role === 'Supporting', `Character role formatted: "${spike?.role}"`);
  } catch (err: any) {
    console.error('Stage 3 error:', err);
  }

  // STAGE 4: STAFF & CREATORS API
  console.log('\n--- STAGE 4: STAFF & CREATORS API ---');
  try {
    const staff = await getJikanAnimeStaff(1);
    assert(Array.isArray(staff) && staff.length > 0, `Staff fetched (count: ${staff.length})`);
    assert(Boolean(staff[0]?.person?.name), `Staff member name: "${staff[0]?.person?.name}"`);
    assert(Boolean(staff[0]?.role), `Staff position/role: "${staff[0]?.role}"`);
  } catch (err: any) {
    console.error('Stage 4 error:', err);
  }

  // STAGE 5: EPISODES & NEWS APIS
  console.log('\n--- STAGE 5: EPISODES & INDUSTRY NEWS APIS ---');
  try {
    const epResult = await getJikanAnimeEpisodes(1, 1);
    assert(Array.isArray(epResult.episodes) && epResult.episodes.length > 0, `Episodes fetched (count: ${epResult.episodes.length})`);
    assert(epResult.episodes[0].number === 1, 'First episode number is 1');
    assert(Boolean(epResult.episodes[0].title), `First episode title: "${epResult.episodes[0].title}"`);

    const news = await getJikanAnimeNews(1);
    assert(Array.isArray(news), `News articles fetched (count: ${news.length})`);
  } catch (err: any) {
    console.error('Stage 5 error:', err);
  }

  // STAGE 6: SEARCH & PRODUCERS / STUDIOS
  console.log('\n--- STAGE 6: SEARCH & STUDIOS / PRODUCERS APIS ---');
  try {
    const search = await searchJikanAnime('Frieren', 5, 1);
    assert(Array.isArray(search.animes) && search.animes.length > 0, 'searchJikanAnime returned results for "Frieren"');
    assert(search.animes[0].title.toLowerCase().includes('frieren'), 'Search result matches query');

    const producers = await getJikanProducers(1, 5);
    assert(Array.isArray(producers.studios) && producers.studios.length > 0, `Producers/Studios fetched (count: ${producers.studios.length})`);
    assert(Boolean(producers.studios[0]?.titles?.[0]?.title || producers.studios[0]?.name), 'Studio name present');
  } catch (err: any) {
    console.error('Stage 6 error:', err);
  }

  // STAGE 7: SEAMLESS DATA GETTERS WITH JIKAN FALLBACK
  console.log('\n--- STAGE 7: SEAMLESS DATA GETTERS WITH JIKAN FALLBACK ---');
  try {
    const anime = await getAnimeBySlugOrId('monster');
    assert(Boolean(anime), 'Found canonical anime "monster" in database');

    const chars = await getAnimeCharactersData(anime!.id);
    assert(Array.isArray(chars) && chars.length > 0, `getAnimeCharactersData returned characters (count: ${chars.length})`);

    const staff = await getAnimeStaffData(anime!.id);
    assert(Array.isArray(staff) && staff.length > 0, `getAnimeStaffData returned staff (count: ${staff.length})`);
  } catch (err: any) {
    console.error('Stage 7 error:', err);
  }

  console.log('\n========================================================================');
  console.log(`  JIKAN V4 API TEST RESULTS: ${passedAssertions} PASSED / ${failedAssertions} FAILED`);
  console.log('========================================================================\n');

  if (failedAssertions > 0) {
    process.exit(1);
  }
}

runJikanTestSuite();
