import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '../../../../lib/auth';
import { enqueueSyncJob } from '../../../../lib/queue/enqueue';
import { JOB_TYPES } from '../../../../lib/queue/jobTypes';

export const dynamic = 'force-dynamic';

/**
 * Enqueues sync work onto the `otakuva-sync` BullMQ queue instead of
 * running it inline — a worker process (scripts/worker.ts) must be running
 * for anything queued here to actually happen; see
 * docs/production/RUNBOOK.md §6. Same URL, method, auth, and request body
 * shape as before; the response is now `{success, jobId, syncJobId,
 * status}` instead of the finished sync's stats, since the work hasn't run
 * yet by the time this returns — poll `GET /api/admin/datacenter` (or
 * `SyncJob.id === syncJobId`) for progress/outcome.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'DATA_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { action, externalId, provider = 'anilist', maxPages = 2 } = body;

    if (action === 'SYNC_ANIME') {
      if (!externalId) {
        return NextResponse.json({ error: 'externalId is required for SYNC_ANIME' }, { status: 400 });
      }
      const { syncJob, bullJobId } = await enqueueSyncJob({
        name: 'sync:anime',
        provider,
        jobType: JOB_TYPES.SYNC_ANIME,
        payload: { externalId, provider },
        data: { externalId: String(externalId), provider },
      });
      return NextResponse.json({ success: true, jobId: bullJobId, syncJobId: syncJob.id, status: syncJob.status });
    }

    if (action === 'SYNC_CATALOG') {
      const { syncJob, bullJobId } = await enqueueSyncJob({
        name: 'sync:catalog',
        provider,
        jobType: JOB_TYPES.FULL_CATALOG,
        payload: { provider, maxPages },
        data: { provider, maxPages },
      });
      return NextResponse.json({ success: true, jobId: bullJobId, syncJobId: syncJob.id, status: syncJob.status });
    }

    if (action === 'SYNC_AIRING') {
      const { syncJob, bullJobId } = await enqueueSyncJob({
        name: 'sync:airing',
        provider: 'anilist',
        jobType: JOB_TYPES.AIRING,
      });
      return NextResponse.json({ success: true, jobId: bullJobId, syncJobId: syncJob.id, status: syncJob.status });
    }

    // Real-world weekly broadcast slots, computed from Jikan-sourced
    // `broadcastDay`/`broadcastTime` already on each Anime record — see
    // ScheduleEngine.syncFromBroadcastMetadata for why this is separate
    // from SYNC_AIRING (which needs AniList-specific per-episode data most
    // of this Jikan-sourced catalog doesn't have).
    if (action === 'SYNC_BROADCAST_SCHEDULE') {
      const { syncJob, bullJobId } = await enqueueSyncJob({
        name: 'sync:broadcast-schedule',
        provider: 'jikan',
        jobType: JOB_TYPES.BROADCAST_SCHEDULE,
      });
      return NextResponse.json({ success: true, jobId: bullJobId, syncJobId: syncJob.id, status: syncJob.status });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Admin sync error:', error);
    return NextResponse.json({ error: error.message || 'Failed to enqueue sync job' }, { status: 500 });
  }
}
