/**
 * OTAKUVA — FULL CATALOG CRAWL (Jikan, by MAL id)
 * Usage:
 *   npx tsx scripts/full_catalog_sync.ts [endId]                  # forward crawl from id 1
 *   PRIORITY_RECENT=1 npx tsx scripts/full_catalog_sync.ts [endId] # crawl from id 50,000 first
 *   RETRY_FAILED=1 npx tsx scripts/full_catalog_sync.ts            # sweep DeadLetterQueue instead
 *
 * Crawls MAL ids via syncEngine.syncFullCatalogById, which pulls each
 * anime's canonical record, episodes, characters/staff, relations, and
 * best-effort studio detail (see src/lib/syncEngine.ts for why this crawls
 * by id rather than paging Jikan's `/anime` search — the search/listing
 * endpoints proxy a live MAL search and are far less reliable under load).
 *
 * Two independent crawls, two independent checkpoints: the default mode
 * works forward from id 1, so it reaches decades of old finished anime long
 * before it reaches anything currently airing or newly announced (MAL ids
 * roughly track when an entry was added, so recent/upcoming shows sit in
 * the highest ids). PRIORITY_RECENT=1 crawls id 50,000 onward instead,
 * under its own checkpoint (jobType='RECENT_PRIORITY_PASS') — run this
 * first if what you actually want soon is real premiere dates and
 * currently-airing schedules rather than a complete historical catalog.
 * Only run one crawl process at a time regardless of mode — two processes
 * hitting Jikan concurrently doubles the real request rate and makes the
 * rate-limiting worse for both (the in-process lock only stops two calls
 * within the same process, not two separate `npx tsx` runs).
 *
 * Resumable: progress is checkpointed in SyncCheckpoint after every id, so
 * killing this process (Ctrl+C, a crash, a reboot) and re-running the same
 * command later picks up exactly where it left off — nothing here needs to
 * run in one sitting.
 *
 * Ids that come back empty (real 404s and transient provider failures
 * alike — Jikan doesn't let us tell them apart from outside) are queued to
 * DeadLetterQueue rather than silently dropped; run with RETRY_FAILED=1 to
 * sweep that queue instead of continuing the forward crawl.
 */

import { prisma } from '../src/lib/prisma';
import { syncEngine } from '../src/lib/syncEngine';
import { ScheduleEngine } from '../src/lib/engine/schedule/scheduleEngine';

const DEFAULT_END_ID = 65000; // generous ceiling past MAL's current highest id; gaps/overshoot are cheap (fast 404s)
const BATCH_SIZE = 25; // ids processed between progress log lines / checkpoint reads

// A plain forward crawl from id 1 hits decades of old, finished anime long
// before it ever reaches what's currently airing or newly announced —
// those cluster in the *newest* ids (MAL assigns ids roughly in the order
// entries get added). PRIORITY_RECENT=1 runs a second, independent crawl
// over just that high range first — under its own checkpoint, so it never
// disturbs the main id-1-onward crawl's progress — to get real premiere
// dates and currently-airing schedules populated fast instead of waiting
// for the full chronological crawl to work its way up there naturally.
const PRIORITY_START_ID = 50000;
const PRIORITY_JOB_TYPE = 'RECENT_PRIORITY_PASS';

async function runForwardCrawl(startId: number, endId: number, jobType: string, label: string) {
  console.log('========================================================================');
  console.log(`  OTAKUVA — ${label} (Jikan, id ${startId}..${endId})`);
  console.log('========================================================================\n');

  let totalProcessed = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalNotFound = 0;
  let totalFailed = 0;
  const startedAt = Date.now();

  let stopRequested = false;
  const onSignal = () => {
    console.log('\n[full_catalog_sync] Stop requested — finishing the current batch, then exiting cleanly (checkpoint is saved after every id, so re-running resumes from here).');
    stopRequested = true;
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  while (!stopRequested) {
    const res = await syncEngine.syncFullCatalogById(BATCH_SIZE, endId, jobType, startId);
    if (!res.success) {
      console.log('[full_catalog_sync] Another sync job holds the lock — waiting 30s before retrying.');
      await new Promise((r) => setTimeout(r, 30_000));
      continue;
    }

    totalProcessed += res.processed;
    totalCreated += res.created;
    totalUpdated += res.updated;
    totalNotFound += res.notFound;
    totalFailed += res.failed;

    const elapsedMin = ((Date.now() - startedAt) / 60_000).toFixed(1);
    console.log(
      `[full_catalog_sync] up to id ${res.doneToId}/${endId} | +${res.created} new, ${res.updated} updated, ${res.notFound} empty, ${res.failed} errored this batch | ` +
      `session totals: ${totalCreated} new / ${totalUpdated} updated / ${totalProcessed} synced | ${elapsedMin}m elapsed`
    );

    // Keep the real-world schedule current as new "Currently Airing" titles
    // turn up in the crawl. Pure DB read + timezone math, no provider calls
    // — cheap enough to run after every batch rather than on a timer.
    try {
      const scheduleRes = await ScheduleEngine.syncFromBroadcastMetadata();
      if (scheduleRes.created > 0) {
        console.log(`[full_catalog_sync] schedule: +${scheduleRes.created} newly-airing title(s) added to the broadcast schedule.`);
      }
    } catch (e: any) {
      console.warn('[full_catalog_sync] schedule sync failed for this batch (non-fatal):', e?.message || e);
    }

    if (res.reachedEnd) {
      console.log('\n========================================================================');
      console.log(`  ${label} COMPLETE — reached id ${endId}.`);
      console.log(`  Session totals: ${totalCreated} created, ${totalUpdated} updated, ${totalNotFound} not found/empty, ${totalFailed} errored.`);
      console.log('========================================================================\n');
      break;
    }
  }
}

async function runDeadLetterRetry() {
  // Superseded by scripts/retry_dead_letters.ts, which does the same
  // ingestAnimeByMalId retry plus the MAX_RETRIES/RETENTION_DAYS archival
  // policy in src/lib/deadLetter.ts (this mode never archives, so
  // repeatedly-failing rows accumulate here forever). Kept for now so
  // `RETRY_FAILED=1` doesn't silently change behavior; prefer the other
  // script going forward.
  console.log('[full_catalog_sync] RETRY_FAILED=1 — sweeping DeadLetterQueue for provider=jikan, entityType=ANIME\n');
  const pending = await prisma.deadLetterQueue.findMany({
    where: { provider: 'jikan', entityType: 'ANIME', resolvedAt: null },
    orderBy: { lastAttemptAt: 'asc' },
    take: 2000,
  });
  console.log(`[full_catalog_sync] ${pending.length} queued ids to re-check.`);

  let recovered = 0;
  for (const row of pending) {
    const malId = parseInt(row.externalId, 10);
    if (!Number.isFinite(malId)) continue;
    try {
      const result = await syncEngine.ingestAnimeByMalId(malId);
      if (result) {
        recovered++;
        await prisma.deadLetterQueue.update({ where: { id: row.id }, data: { resolvedAt: new Date() } });
        console.log(`  ✓ recovered id ${malId} (was queued: ${row.error})`);
      } else {
        await prisma.deadLetterQueue.update({
          where: { id: row.id },
          data: { attempts: { increment: 1 }, lastAttemptAt: new Date() },
        });
      }
    } catch (err: any) {
      await prisma.deadLetterQueue.update({
        where: { id: row.id },
        data: { attempts: { increment: 1 }, lastAttemptAt: new Date(), error: err?.message || String(err) },
      });
    }
  }
  console.log(`\n[full_catalog_sync] Retry sweep done: ${recovered}/${pending.length} recovered.`);
}

async function main() {
  const endId = parseInt(process.argv[2], 10) || DEFAULT_END_ID;

  if (process.env.RETRY_FAILED === '1') {
    await runDeadLetterRetry();
    return;
  }

  if (process.env.PRIORITY_RECENT === '1') {
    await runForwardCrawl(PRIORITY_START_ID, endId, PRIORITY_JOB_TYPE, 'RECENT-PRIORITY CRAWL');
    return;
  }

  await runForwardCrawl(1, endId, 'FULL_CATALOG_BY_ID', 'FULL CATALOG CRAWL');
}

main()
  .catch((err) => {
    console.error('[full_catalog_sync] Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
