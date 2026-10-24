/**
 * OTAKUVA — NEWS SYNC (manual trigger)
 * Usage:
 *   npx tsx scripts/news_poller.ts             # enqueue one 'news-sync' job, exit
 *   npx tsx scripts/news_poller.ts --loop [s]   # enqueue one every [s] seconds (default 60), Ctrl+C to stop
 *
 * Enqueues onto the `otakuva-sync` queue instead of calling
 * newsEngine.syncAllProviders() directly — scripts/worker.ts (which must
 * be running; see docs/production/RUNBOOK.md §6) picks the job up and
 * does the actual RSS fetch/ingest, tracked on a SyncJob row like every
 * other queued job.
 *
 * News sync also now runs on a real, Redis-backed schedule on its own —
 * every 60s, registered once by the worker on startup, see
 * src/lib/queue/recurring.ts — which is what actually keeps the News
 * section current in production; you shouldn't need --loop unless the
 * worker's scheduler is unavailable for some reason. Before the queue
 * existed, this script's own while-loop (calling syncAllProviders
 * in-process) was the only thing that did — see this file's git history
 * for that version.
 */

import { prisma } from '../src/lib/prisma';
import { enqueueSyncJob } from '../src/lib/queue/enqueue';
import { JOB_TYPES } from '../src/lib/queue/jobTypes';

async function enqueueOnce() {
  const { syncJob, bullJobId } = await enqueueSyncJob({
    name: 'news-sync',
    provider: 'multiple',
    jobType: JOB_TYPES.NEWS_SYNC,
  });
  const stamp = new Date().toISOString();
  console.log(`[${stamp}] enqueued news-sync — syncJobId=${syncJob.id} bullJobId=${bullJobId}`);
}

async function main() {
  const loop = process.argv.includes('--loop');
  if (!loop) {
    await enqueueOnce();
    return;
  }

  const loopArgIndex = process.argv.indexOf('--loop');
  const intervalSec = parseInt(process.argv[loopArgIndex + 1], 10) || 60;

  console.log('========================================================================');
  console.log(`  OTAKUVA — NEWS SYNC TRIGGER LOOP (enqueue every ${intervalSec}s, Ctrl+C to stop)`);
  console.log("  (prefer letting the worker's own recurring schedule do this — see the");
  console.log('   header comment in this file; --loop is a fallback.)');
  console.log('========================================================================\n');

  let stopRequested = false;
  process.on('SIGINT', () => { console.log('\n[news_poller] Stopping after this cycle...'); stopRequested = true; });
  process.on('SIGTERM', () => { stopRequested = true; });

  while (!stopRequested) {
    try {
      await enqueueOnce();
    } catch (err: any) {
      console.error('[news_poller] Failed to enqueue (will retry next interval):', err?.message || err);
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
