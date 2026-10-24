/**
 * OTAKUVA — SyncJob bookkeeping for queued jobs.
 *
 * Every job enqueued onto the `otakuva-sync` queue gets a SyncJob row
 * created PENDING *before* it's enqueued (so a job still sitting in the
 * queue, not yet picked up by a worker, is visible as such — not just
 * absent). The queue handler then walks it through RUNNING -> COMPLETED /
 * PAUSED / CANCELLED, or (only once BullMQ has exhausted every retry)
 * FAILED. This is the table the existing admin UI already reads
 * (`GET /api/admin/datacenter`, `GET /api/admin/anime/import`), so none of
 * it had to change to keep working.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';
import { MAX_JOB_ATTEMPTS } from './queue';

export interface CreatePendingSyncJobInput {
  provider: string;
  jobType: string;
  mode?: string;
  totalItems?: number;
  page?: number;
  payload?: unknown;
}

export async function createPendingSyncJob(input: CreatePendingSyncJobInput) {
  return prisma.syncJob.create({
    data: {
      provider: input.provider,
      jobType: input.jobType,
      status: 'PENDING',
      mode: input.mode,
      totalItems: input.totalItems ?? 0,
      page: input.page ?? 1,
      maxAttempts: MAX_JOB_ATTEMPTS,
      payloadJson: input.payload !== undefined ? JSON.stringify(input.payload) : null,
    },
  });
}

export async function attachBullJobId(syncJobId: string, bullJobId: string | undefined) {
  if (!bullJobId) return;
  await prisma.syncJob.update({ where: { id: syncJobId }, data: { bullJobId } }).catch(() => {});
}

export async function markSyncJobRunning(syncJobId: string, attemptsMade = 0) {
  await prisma.syncJob.update({
    where: { id: syncJobId },
    data: { status: 'RUNNING', attempts: attemptsMade, error: null },
  });
}

type SyncJobCountsPatch = Partial<{
  processedCount: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  processedPages: number;
  page: number;
  cursor: string | null;
  failedPagesJson: string | null;
  failedIdsJson: string | null;
}>;

/** Mid-run progress update — status stays whatever it already is (RUNNING). */
export async function updateSyncJobProgress(syncJobId: string, patch: SyncJobCountsPatch) {
  await prisma.syncJob.update({ where: { id: syncJobId }, data: patch }).catch((e) => {
    logger.error('SyncJob progress update failed', { error: e, component: 'queue/syncJob', syncJobId });
  });
}

export async function completeSyncJob(syncJobId: string, patch: SyncJobCountsPatch = {}) {
  await prisma.syncJob.update({
    where: { id: syncJobId },
    data: { ...patch, status: 'COMPLETED', completedAt: new Date(), error: null },
  });
}

export async function pauseSyncJob(syncJobId: string, patch: SyncJobCountsPatch = {}) {
  await prisma.syncJob.update({
    where: { id: syncJobId },
    data: { ...patch, status: 'PAUSED' },
  });
}

export async function cancelSyncJob(syncJobId: string, patch: SyncJobCountsPatch = {}) {
  await prisma.syncJob.update({
    where: { id: syncJobId },
    data: { ...patch, status: 'CANCELLED', completedAt: new Date() },
  }).catch(() => {});
}

/**
 * Mid-retry failure — records the error and attempt count but leaves
 * status as-is (RUNNING); BullMQ is about to retry with backoff. Only
 * `markSyncJobFailedPermanently` (called from the Worker's 'failed'
 * listener once attempts are exhausted) sets status to FAILED.
 */
export async function recordSyncJobAttemptFailure(syncJobId: string, attemptsMade: number, error: string) {
  await prisma.syncJob.update({ where: { id: syncJobId }, data: { attempts: attemptsMade, error } }).catch(() => {});
}

export async function markSyncJobFailedPermanently(syncJobId: string, error: string) {
  await prisma.syncJob.update({
    where: { id: syncJobId },
    data: { status: 'FAILED', completedAt: new Date(), error },
  }).catch(() => {});
}

export async function getLatestSyncJob(jobType: string) {
  return prisma.syncJob.findFirst({ where: { jobType }, orderBy: { startedAt: 'desc' } });
}
