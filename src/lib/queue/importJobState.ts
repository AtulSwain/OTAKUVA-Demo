/**
 * OTAKUVA — reconstructs the `ImportJobState` shape the admin anime-import
 * UI (src/app/admin/anime/page.tsx) has always polled from a SyncJob row.
 *
 * Before the queue, this shape came from an in-memory object
 * (src/lib/ingestion/jikanImportJob.ts's `activeJob`) that no longer
 * exists — the queue worker owns progress now, persisted on the SyncJob
 * row it updates as it runs (see handleAnimeImport in
 * src/lib/queue/handlers.ts). This module is only a read-side translation
 * so GET/POST /api/admin/anime/import can keep returning exactly what the
 * page already expects.
 */

import type { SyncJob } from '@prisma/client';

export interface ImportJobState {
  jobId: string;
  provider: 'jikan' | 'anilist';
  dataset: string;
  mode: string;
  status: 'IDLE' | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'FAILED' | 'CANCELLED';
  currentPage: number;
  totalPages: number;
  processedPages: number;
  processedAnime: number;
  insertedAnime: number;
  updatedAnime: number;
  failedAnime: number;
  failedPages: number[];
  failedIds: number[];
  startedTime: string | null;
  completedTime: string | null;
  lastError: string | null;
  progressPercent: number;
}

// Same rough, never-really-computed estimate the old in-memory job manager
// hardcoded — kept identical rather than "fixed" here since real total-page
// count depends on Jikan's live result count, which isn't known up front.
const DEFAULT_TOTAL_PAGES = 100;

export const IDLE_IMPORT_JOB_STATE: ImportJobState = {
  jobId: 'job-default',
  provider: 'jikan',
  dataset: 'ANIME',
  mode: 'TOP',
  status: 'IDLE',
  currentPage: 1,
  totalPages: DEFAULT_TOTAL_PAGES,
  processedPages: 0,
  processedAnime: 0,
  insertedAnime: 0,
  updatedAnime: 0,
  failedAnime: 0,
  failedPages: [],
  failedIds: [],
  startedTime: null,
  completedTime: null,
  lastError: null,
  progressPercent: 0,
};

function parseJsonNumberArray(json: string | null): number[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

export function syncJobToImportJobState(row: SyncJob | null): ImportJobState {
  if (!row) return IDLE_IMPORT_JOB_STATE;

  const page = row.page ?? 1;

  return {
    jobId: row.id,
    provider: 'jikan',
    dataset: 'ANIME',
    mode: row.mode || 'TOP',
    status: (row.status as ImportJobState['status']) || 'IDLE',
    currentPage: page,
    totalPages: DEFAULT_TOTAL_PAGES,
    processedPages: row.processedPages,
    processedAnime: row.processedCount,
    insertedAnime: row.createdCount,
    updatedAnime: row.updatedCount,
    failedAnime: row.failedCount,
    failedPages: parseJsonNumberArray(row.failedPagesJson),
    failedIds: parseJsonNumberArray(row.failedIdsJson),
    startedTime: row.startedAt.toISOString(),
    completedTime: row.completedAt ? row.completedAt.toISOString() : null,
    lastError: row.error,
    progressPercent: Math.min(100, Math.round((page / DEFAULT_TOTAL_PAGES) * 100)),
  };
}
