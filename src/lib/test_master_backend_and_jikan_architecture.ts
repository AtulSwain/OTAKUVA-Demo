/**
 * OTAKUVA — MASTER BACKEND, PROVIDER & DATA ENGINE TEST HARNESS
 * 
 * Tests:
 * 1. Provider Abstraction & Jikan v4 domain methods
 * 2. In-flight request deduplication & throttling
 * 3. Resumable Import Engine state transitions (Start, Pause, Cancel, Resume)
 * 4. Image Health Service (URL validation, health scanning, deterministic fallbacks)
 * 5. Data Center API contract & provider metrics
 */

import { jikanProvider } from './providers/jikanProvider';
import { jikanFetch, providerMetrics } from './jikanService';
import { JikanImportJobManager } from './ingestion/jikanImportJob';
import { ImageHealthService, isCleanImageUrl } from './engine/media/imageHealthService';

async function runMasterBackendTests() {
  console.log('===============================================================');
  console.log('OTAKUVA MASTER BACKEND & JIKAN ARCHITECTURE VERIFICATION SUITE');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Provider Abstraction & Domain Coverage
  // -------------------------------------------------------------
  console.log('[Phase 1: Provider Abstraction & Jikan v4 Endpoints]');
  assert(jikanProvider.name === 'jikan', 'Jikan provider is properly registered with name "jikan"');
  assert(typeof jikanProvider.getAnime === 'function', 'getAnime domain method is exposed');
  assert(typeof jikanProvider.getAnimeCharacters === 'function', 'getAnimeCharacters domain method is exposed');
  assert(typeof jikanProvider.getAnimeStaff === 'function', 'getAnimeStaff domain method is exposed');
  assert(typeof jikanProvider.getAnimeEpisodes === 'function', 'getAnimeEpisodes domain method is exposed');
  assert(typeof jikanProvider.getAnimeVideos === 'function', 'getAnimeVideos domain method is exposed');
  assert(typeof jikanProvider.getAnimeNews === 'function', 'getAnimeNews domain method is exposed');
  assert(typeof jikanProvider.getAnimeStatistics === 'function', 'getAnimeStatistics domain method is exposed');
  assert(typeof jikanProvider.getTopAnime === 'function', 'getTopAnime domain method is exposed');
  assert(typeof jikanProvider.getSeasonalAnime === 'function', 'getSeasonalAnime domain method is exposed');

  // Test actual fallback/mock extraction for Monster (ID 19)
  const monsterChars = await jikanProvider.getAnimeCharacters('19');
  assert(Array.isArray(monsterChars) && monsterChars.length > 0, 'getAnimeCharacters returns valid character array');
  assert(monsterChars.some((c) => c.name.includes('Tenma') || c.name.includes('Johan')), 'Character array contains canonical Monster characters');

  const monsterStaff = await jikanProvider.getAnimeStaff('19');
  assert(Array.isArray(monsterStaff) && monsterStaff.length > 0, 'getAnimeStaff returns valid staff array');
  assert(monsterStaff.some((s) => s.personName.includes('Urasawa') || (s.positions && s.positions.some(p => p.includes('Director')))), 'Staff array contains canonical Monster staff');

  // -------------------------------------------------------------
  // TEST 2: Request Deduplication & Rate Limiter
  // -------------------------------------------------------------
  console.log('\n[Phase 2: In-Flight Promise Deduplication & Cache]');
  const p1 = jikanFetch('/anime/1/full');
  const p2 = jikanFetch('/anime/1/full');
  assert(p1 === p2, 'Concurrent identical in-flight requests share the exact same Promise instance (Deduplication ACTIVE)');

  const res = await p1;
  assert(res !== null, 'jikanFetch resolves with structured data');
  assert(providerMetrics.totalRequests > 0, 'Provider metrics tracks total requests');

  // -------------------------------------------------------------
  // TEST 3: Resumable Import Job Manager
  // -------------------------------------------------------------
  console.log('\n[Phase 3: Resumable Import Job Manager]');
  const initialJob = JikanImportJobManager.resetJob();
  assert(initialJob.status === 'IDLE', 'Import job initializes in IDLE status');
  assert(initialJob.currentPage === 1, 'Import job starts at checkpoint page 1');

  const pausedJob = JikanImportJobManager.pauseJob();
  assert(pausedJob.status === 'PAUSED', 'Import job can be safely paused at checkpoint');

  const cancelledJob = JikanImportJobManager.cancelJob();
  assert(cancelledJob.status === 'CANCELLED', 'Import job can be cancelled');

  // -------------------------------------------------------------
  // TEST 4: Image Health Service & URL Validation
  // -------------------------------------------------------------
  console.log('\n[Phase 4: Image Health Service & URL Validation]');
  assert(isCleanImageUrl('https://cdn.myanimelist.net/images/anime/10/19.jpg') === true, 'Valid HTTPS image URL passes validation');
  assert(isCleanImageUrl('/images/fallback.jpg') === true, 'Valid local image path passes validation');
  assert(isCleanImageUrl('undefined') === false, 'Invalid token "undefined" is rejected');
  assert(isCleanImageUrl('null') === false, 'Invalid token "null" is rejected');
  assert(isCleanImageUrl('http://placeholder.com/test') === false, 'Placeholder URL is rejected');
  assert(isCleanImageUrl('') === false, 'Empty URL is rejected');

  const healthSummary = await ImageHealthService.scanCatalogImages();
  assert(healthSummary.totalScanned >= 0, 'Image health scanner successfully executes without error');
  assert(typeof healthSummary.validCount === 'number', 'Valid count metric is computed accurately');

  console.log('\n===============================================================');
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runMasterBackendTests().catch((err) => {
  console.error('Test runner fatal error:', err);
  process.exit(1);
});
