/**
 * OTAKUVA — CONTINUOUS NEWS POLLER
 * Usage:
 *   npx tsx scripts/news_poller.ts [intervalSeconds]   # default 60s
 *
 * Runs newsEngine.syncAllProviders() on a loop against every registered
 * real-world source (Anime News Network RSS, Crunchyroll News RSS, and
 * whatever "official studio press" feeds get configured later — see
 * src/lib/engine/news/newsEngine.ts's constructor for the registry).
 *
 * Safe to run indefinitely: each cycle is one lightweight RSS GET per
 * source (already throttled/retried in newsProviderClient.ts), and
 * newsIngestionService's dedup stage means re-fetching the same feed
 * every cycle only ever adds genuinely *new* articles — nothing is
 * duplicated, and nothing already stored is removed or overwritten
 * beyond the fields RSS actually re-supplies (title/summary/image/url).
 *
 * There's no background job scheduler in this app yet (tracked as a
 * Phase 10 gap in CLAUDE.md), so until one exists this script — left
 * running in a terminal or via a process manager — is what keeps the
 * News section current. Ctrl+C to stop; every cycle's writes are already
 * committed, so stopping/restarting loses nothing.
 */

import { prisma } from '../src/lib/prisma';
import { newsEngine } from '../src/lib/engine/news/newsEngine';

const DEFAULT_INTERVAL_SEC = 60;

async function runCycle() {
  const results = await newsEngine.syncAllProviders(30);
  const totalNew = results.reduce((sum, r) => sum + r.createdCount, 0);
  const totalUpdated = results.reduce((sum, r) => sum + r.updatedCount, 0);
  const failed = results.filter((r) => r.status === 'FAILED');

  const perProvider = results
    .map((r) => `${r.provider}: +${r.createdCount} new, ${r.updatedCount} updated${r.status === 'FAILED' ? ` (FAILED: ${r.errors[0] || 'unknown'})` : ''}`)
    .join(' | ');

  const stamp = new Date().toISOString();
  if (totalNew > 0 || totalUpdated > 0 || failed.length > 0) {
    console.log(`[${stamp}] ${perProvider}`);
  } else {
    console.log(`[${stamp}] no changes (${perProvider})`);
  }
}

async function main() {
  const intervalSec = parseInt(process.argv[2], 10) || DEFAULT_INTERVAL_SEC;
  console.log('========================================================================');
  console.log(`  OTAKUVA — NEWS POLLER (every ${intervalSec}s, Ctrl+C to stop)`);
  console.log('========================================================================\n');

  let stopRequested = false;
  process.on('SIGINT', () => { console.log('\n[news_poller] Stopping after this cycle...'); stopRequested = true; });
  process.on('SIGTERM', () => { stopRequested = true; });

  while (!stopRequested) {
    try {
      await runCycle();
    } catch (err: any) {
      console.error(`[news_poller] Cycle failed (will retry next interval):`, err?.message || err);
    }

    for (let waited = 0; waited < intervalSec && !stopRequested; waited++) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

main()
  .catch((err) => {
    console.error('[news_poller] Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
