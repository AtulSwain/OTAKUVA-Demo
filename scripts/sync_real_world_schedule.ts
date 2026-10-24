/**
 * OTAKUVA — AniList-backed weekly schedule sync (manual trigger)
 * Usage: npx tsx scripts/sync_real_world_schedule.ts
 *
 * Enqueues one 'sync:airing' job onto the `otakuva-sync` queue and exits —
 * scripts/worker.ts (which must be running; see
 * docs/production/RUNBOOK.md §6) picks it up and runs
 * syncEngine.syncWeeklySchedule(), same as
 * POST /api/admin/sync {"action":"SYNC_AIRING"}.
 *
 * Also runs on its own schedule now (every 6h — AniList health has been
 * uncertain, see CLAUDE.md, hence the longer interval than the broadcast
 * schedule's 30min) via src/lib/queue/recurring.ts, registered once by the
 * worker on startup. This script is for an on-demand run in between.
 */

import { prisma } from '../src/lib/prisma';
import { enqueueSyncJob } from '../src/lib/queue/enqueue';
import { JOB_TYPES } from '../src/lib/queue/jobTypes';

async function main() {
  const { syncJob, bullJobId } = await enqueueSyncJob({
    name: 'sync:airing',
    provider: 'anilist',
    jobType: JOB_TYPES.AIRING,
  });
  console.log(`Enqueued sync:airing — syncJobId=${syncJob.id} bullJobId=${bullJobId}`);
  console.log('Watch progress: GET /api/admin/datacenter, or SyncJob.id === syncJobId in the DB.');
}

main().catch((error) => {
  console.error('Failed to enqueue schedule sync:', error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
