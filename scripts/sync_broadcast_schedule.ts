/**
 * OTAKUVA — REAL-WORLD BROADCAST SCHEDULE SYNC (manual trigger)
 * Usage: npx tsx scripts/sync_broadcast_schedule.ts
 *
 * Enqueues one 'sync:broadcast-schedule' job onto the `otakuva-sync` queue
 * and exits — scripts/worker.ts (which must be running; see
 * docs/production/RUNBOOK.md §6) picks it up and runs
 * ScheduleEngine.syncFromBroadcastMetadata(), same as
 * POST /api/admin/sync {"action":"SYNC_BROADCAST_SCHEDULE"}.
 *
 * This job also now runs on its own schedule automatically — see
 * src/lib/queue/recurring.ts, registered once by the worker on startup —
 * so this script is for an on-demand run in between those ticks, not the
 * only way it happens anymore. (Before the queue existed, this script or
 * the admin route were the *only* way it ran; see the git history of this
 * file for that version.)
 */

import { prisma } from '../src/lib/prisma';
import { enqueueSyncJob } from '../src/lib/queue/enqueue';
import { JOB_TYPES } from '../src/lib/queue/jobTypes';

async function main() {
  const { syncJob, bullJobId } = await enqueueSyncJob({
    name: 'sync:broadcast-schedule',
    provider: 'jikan',
    jobType: JOB_TYPES.BROADCAST_SCHEDULE,
  });
  console.log(`Enqueued sync:broadcast-schedule — syncJobId=${syncJob.id} bullJobId=${bullJobId}`);
  console.log('Watch progress: GET /api/admin/datacenter, or SyncJob.id === syncJobId in the DB.');
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
