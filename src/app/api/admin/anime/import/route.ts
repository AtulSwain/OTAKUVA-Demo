import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { requireRole } from '../../../../../lib/auth';
import { enqueueSyncJob } from '../../../../../lib/queue/enqueue';
import { requestAnimeImportStop } from '../../../../../lib/queue/handlers';
import { JOB_TYPES } from '../../../../../lib/queue/jobTypes';
import { getLatestSyncJob } from '../../../../../lib/queue/syncJob';
import { syncJobToImportJobState, IDLE_IMPORT_JOB_STATE } from '../../../../../lib/queue/importJobState';
import type { ImportMode } from '../../../../../lib/queue/handlers';

export const dynamic = 'force-dynamic';

const ACTIVE_STATUSES = ['PENDING', 'RUNNING'];

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'DATA_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const latest = await getLatestSyncJob(JOB_TYPES.JIKAN_IMPORT);
    const jobStatus = syncJobToImportJobState(latest);
    const totalCatalogCount = await prisma.anime.count({ where: { status: { not: 'MERGED' } } });
    const studiosCount = await prisma.studio.count();
    const creatorsCount = await prisma.person.count();
    const charactersCount = await prisma.character.count();

    return NextResponse.json({
      job: jobStatus,
      catalogMetrics: {
        totalAnime: totalCatalogCount,
        totalStudios: studiosCount,
        totalCreators: creatorsCount,
        totalCharacters: charactersCount,
      },
    });
  } catch (err: any) {
    console.error('Admin Anime Import Status Error:', err);
    return NextResponse.json({ error: 'Failed to retrieve import status' }, { status: 500 });
  }
}

/**
 * Same URL, method, auth, and request body shape as before
 * (action/mode/startPage/maxPages/specificId). The actual import work now
 * runs in the queue worker (scripts/worker.ts), not inline in this
 * request — 'start'/'resume' enqueues and returns immediately with the
 * freshly-created (PENDING) job state; the admin UI's existing 3s poll of
 * GET picks up real progress from there, same as it always has.
 * 'stop'/'pause'/'cancel'/'reset' are control-plane actions and stay
 * synchronous — they're fast DB/Redis writes, not sync work.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'DATA_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'start'; // start, resume, stop, pause, reset, cancel
    const mode = (body.mode as ImportMode) || 'TOP';
    const startPage = body.startPage ? parseInt(body.startPage, 10) : undefined;
    const maxPages = body.maxPages ? parseInt(body.maxPages, 10) : 5;
    const specificId = body.specificId ? parseInt(body.specificId, 10) : undefined;

    if (action === 'stop' || action === 'pause' || action === 'cancel') {
      const active = await prisma.syncJob.findFirst({
        where: { jobType: JOB_TYPES.JIKAN_IMPORT, status: { in: ACTIVE_STATUSES } },
        orderBy: { startedAt: 'desc' },
      });
      if (!active) {
        return NextResponse.json({ success: true, message: 'No active import job to stop', job: IDLE_IMPORT_JOB_STATE });
      }
      await requestAnimeImportStop(active.id, action === 'cancel' ? 'CANCELLED' : 'PAUSED');
      // Cooperative: the worker notices between pages, not instantly — the
      // job state returned here is still whatever it was a moment ago;
      // the admin UI's poll picks up the actual PAUSED/CANCELLED status
      // once the worker acts on the request.
      return NextResponse.json({
        success: true,
        message: `${action === 'cancel' ? 'Cancel' : 'Pause'} requested — will take effect after the current page finishes`,
        job: syncJobToImportJobState(active),
      });
    }

    if (action === 'reset') {
      // No existing row is deleted (no silent deletion of a job's audit
      // trail) — a fresh CANCELLED row is created instead, so GET's "latest
      // row" reconstruction shows a zeroed-out, not-running state exactly
      // like the old in-memory resetJob() did.
      const fresh = await prisma.syncJob.create({
        data: { provider: 'jikan', jobType: JOB_TYPES.JIKAN_IMPORT, status: 'CANCELLED', mode, page: 1, completedAt: new Date() },
      });
      return NextResponse.json({ success: true, message: 'Import job reset', job: syncJobToImportJobState(fresh) });
    }

    // Default start or resume.
    const active = await prisma.syncJob.findFirst({
      where: { jobType: JOB_TYPES.JIKAN_IMPORT, status: { in: ACTIVE_STATUSES } },
      orderBy: { startedAt: 'desc' },
    });
    if (active) {
      // Already queued/running — don't enqueue a duplicate; mirrors the old
      // in-memory manager's `if (isJobRunning) return activeJob;`.
      return NextResponse.json({
        success: true,
        message: `Import job already ${active.status.toLowerCase()} (page ${active.page})`,
        job: syncJobToImportJobState(active),
      });
    }

    // Resume from where the last run of this mode left off unless the
    // caller explicitly gave a startPage.
    const previous = mode !== 'SPECIFIC_ID' ? await getLatestSyncJobForMode(mode) : null;
    const resolvedStartPage = startPage || previous?.page || 1;

    const { syncJob } = await enqueueSyncJob({
      name: 'anime-import',
      provider: 'jikan',
      jobType: JOB_TYPES.JIKAN_IMPORT,
      mode,
      page: resolvedStartPage,
      payload: { mode, startPage: resolvedStartPage, maxPages, specificId },
      data: { mode, startPage: resolvedStartPage, maxPages, specificId },
    });

    return NextResponse.json({
      success: true,
      message: `Import job enqueued (mode: ${mode}) from page ${resolvedStartPage}`,
      job: syncJobToImportJobState(syncJob),
    });
  } catch (err: any) {
    console.error('Admin Anime Import Action Error:', err);
    return NextResponse.json({ error: 'Failed to execute import action' }, { status: 500 });
  }
}

async function getLatestSyncJobForMode(mode: string) {
  return prisma.syncJob.findFirst({
    where: { jobType: JOB_TYPES.JIKAN_IMPORT, mode },
    orderBy: { startedAt: 'desc' },
  });
}
