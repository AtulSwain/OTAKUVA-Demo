/**
 * OTAKUVA — background job queue consumer.
 *
 * Usage:
 *   npx tsx scripts/worker.ts
 *
 * This is a second, standalone process alongside `next start` (or
 * `next dev`) — see docs/production/RUNBOOK.md §6 for how to run it (pm2 /
 * systemd / a second container, plus the Redis dependency it needs).
 * Nothing in the Next.js process runs sync/import/news/schedule work
 * inline anymore: `POST /api/admin/sync`, `POST /api/admin/anime/import`,
 * and the BullMQ repeatable jobs registered below (replacing
 * scripts/news_poller.ts and scripts/sync_broadcast_schedule.ts /
 * scripts/sync_real_world_schedule.ts as always-on loops) all just enqueue
 * onto the `otakuva-sync` queue (Redis) and return. If this process isn't
 * running, jobs pile up PENDING in both BullMQ and the SyncJob table —
 * nothing is lost, but nothing progresses either.
 *
 * Retry policy (src/lib/queue/queue.ts): 5 attempts, exponential backoff.
 * A job only reaches DeadLetterQueue once every attempt is exhausted (the
 * 'failed' listener below checks `job.attemptsMade >= job.opts.attempts`);
 * every attempt before that just records the error on the job's SyncJob
 * row and lets BullMQ retry.
 *
 * Concurrency is intentionally 1: every job kind here does a checkpointed,
 * rate-limited crawl of an external provider (Jikan/AniList/news RSS) or a
 * bulk DB pass — running two at once mostly just doubles provider request
 * pressure for no throughput gain, and syncEngine's in-process locks
 * (acquireLock/releaseLock) only protect against overlap within *this*
 * process anyway. Raise WORKER_CONCURRENCY if that stops being true for a
 * given job mix.
 */

import { Worker } from 'bullmq';
import type { Job } from 'bullmq';
import { getWorkerRedisConnection } from '../src/lib/queue/connection';
import { QUEUE_NAME } from '../src/lib/queue/queue';
import { processSyncJob, describeJobForDeadLetter } from '../src/lib/queue/handlers';
import { registerRecurringJobs } from '../src/lib/queue/recurring';
import { recordSyncJobAttemptFailure, markSyncJobFailedPermanently } from '../src/lib/queue/syncJob';
import { routeExhaustedJobToDeadLetter } from '../src/lib/queue/deadLetterRouting';
import { prisma } from '../src/lib/prisma';

const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '', 10) || 1;
const STARTUP_RETRY_ATTEMPTS = 5;

/**
 * registerRecurringJobs() goes through the same producer connection as an
 * HTTP route's enqueue call (see src/lib/queue/connection.ts) — fail-fast
 * on purpose there, so a request never hangs forever. That's the wrong
 * behavior for this process's own startup, though: in a typical container/
 * compose startup, Redis and the worker can come up within moments of
 * each other in either order. Retry a few times with backoff before
 * actually giving up, instead of crash-looping on the very first blip.
 */
async function registerRecurringJobsWithRetry() {
  for (let attempt = 1; attempt <= STARTUP_RETRY_ATTEMPTS; attempt++) {
    try {
      await registerRecurringJobs();
      return;
    } catch (err: any) {
      if (attempt === STARTUP_RETRY_ATTEMPTS) throw err;
      const delayMs = attempt * 2000;
      console.warn(`[worker] couldn't reach Redis to register recurring jobs (attempt ${attempt}/${STARTUP_RETRY_ATTEMPTS}): ${err?.message || err} — retrying in ${delayMs}ms`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function main() {
  console.log('========================================================================');
  console.log(`  OTAKUVA — QUEUE WORKER (queue="${QUEUE_NAME}", concurrency=${CONCURRENCY})`);
  console.log('========================================================================\n');

  await registerRecurringJobsWithRetry();

  const worker = new Worker(QUEUE_NAME, processSyncJob, {
    connection: getWorkerRedisConnection(),
    concurrency: CONCURRENCY,
  });

  worker.on('active', (job: Job) => {
    console.log(`[worker] ${job.name} (${job.id}) started — attempt ${job.attemptsMade + 1}/${job.opts.attempts ?? 1}`);
  });

  worker.on('completed', (job: Job) => {
    console.log(`[worker] ${job.name} (${job.id}) completed.`);
  });

  worker.on('failed', async (job: Job | undefined, err: Error) => {
    if (!job) {
      console.error('[worker] a job failed with no job reference:', err);
      return;
    }

    const attemptsMade = job.attemptsMade;
    const maxAttempts = job.opts.attempts ?? 1;
    const syncJobId: string | undefined = job.data?.syncJobId;

    console.error(`[worker] ${job.name} (${job.id}) failed attempt ${attemptsMade}/${maxAttempts}: ${err.message}`);

    if (attemptsMade < maxAttempts) {
      // BullMQ will retry this one (exponential backoff already scheduled)
      // — record the error for visibility, but the SyncJob row stays
      // RUNNING; it isn't failed yet.
      if (syncJobId) await recordSyncJobAttemptFailure(syncJobId, attemptsMade, err.message);
      return;
    }

    // Every attempt exhausted — this is permanent. Mark the SyncJob row
    // FAILED and route to DeadLetterQueue (never before this point — see
    // the charter's rule that a transient failure must never be treated
    // as permanent).
    if (syncJobId) await markSyncJobFailedPermanently(syncJobId, err.message);
    const dlqInfo = describeJobForDeadLetter(job);
    await routeExhaustedJobToDeadLetter({ ...dlqInfo, error: err.message });
    console.error(`[worker] ${job.name} (${job.id}) exhausted all ${maxAttempts} attempts -> DeadLetterQueue (${dlqInfo.provider}/${dlqInfo.entityType}/${dlqInfo.externalId})`);
  });

  worker.on('error', (err: Error) => {
    console.error('[worker] worker-level error:', err);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[worker] ${signal} received — finishing active job(s), then exiting...`);
    await worker.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  console.log('[worker] ready — waiting for jobs. Ctrl+C to stop.\n');
}

main().catch((err) => {
  console.error('[worker] fatal error during startup:', err);
  process.exit(1);
});
