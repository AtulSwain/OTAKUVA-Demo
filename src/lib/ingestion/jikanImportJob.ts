/**
 * OTAKUVA — JIKAN V4 RESUMABLE CATALOG IMPORT JOB RUNNER
 *
 * DEPRECATED — no longer wired to anything live. `POST /api/admin/anime/
 * import` and `GET /api/admin/data` both moved to the BullMQ-backed
 * 'anime-import' queue job (src/lib/queue/handlers.ts's handleAnimeImport,
 * tracked on a SyncJob row via src/lib/queue/importJobState.ts) so the
 * work survives the Next.js process restarting and isn't lost if nobody
 * happens to be polling it. This file's `activeJob` was always in-memory
 * only (never actually persisted to the SyncJob table despite the comment
 * below), so nothing here needs migrating, only replacing.
 *
 * Kept only because src/lib/test_master_backend_and_jikan_architecture.ts
 * (a legacy `src/lib/test_*.ts` script — see CLAUDE.md on why those are
 * deprecated in favor of `tests/**`) still imports it. Do not add new
 * callers; use enqueueSyncJob({name: 'anime-import', ...}) instead (see
 * src/app/api/admin/anime/import/route.ts for the pattern).
 *
 * Original doc, for history:
 * Features:
 * - Persistent DB/in-memory import job state
 * - Checkpoint tracking (resumes from last processed page without duplicate fetches)
 * - Rate-limited batch processing with backoff
 * - Modes: FULL, SEASON, TOP, AIRING, UPCOMING, SPECIFIC_ID, RETRY_FAILED
 * - Progress metrics: processed anime, inserted, updated, failed, missing metadata
 */

import { prisma } from '../prisma';
import { getJikanTopAnime, getJikanSeasonalAnime, getJikanAnimeFull, syncJikanAnimeToDatabase } from '../jikanService';

export type ImportMode = 'FULL' | 'SEASON' | 'TOP' | 'AIRING' | 'UPCOMING' | 'SPECIFIC_ID' | 'RETRY_FAILED';

export interface ImportJobState {
  jobId: string;
  provider: 'jikan' | 'anilist';
  dataset: string;
  mode: ImportMode;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'PAUSED' | 'FAILED' | 'CANCELLED';
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

let activeJob: ImportJobState = {
  jobId: 'job-default',
  provider: 'jikan',
  dataset: 'ANIME',
  mode: 'TOP',
  status: 'IDLE',
  currentPage: 1,
  totalPages: 100,
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

let isJobRunning = false;

export class JikanImportJobManager {
  static getStatus(): ImportJobState {
    return { ...activeJob };
  }

  static async startOrResumeJob(
    mode: ImportMode = 'TOP',
    startPage?: number,
    maxPagesToRun = 10,
    specificId?: number
  ): Promise<ImportJobState> {
    if (isJobRunning) {
      return activeJob;
    }

    const pageToStart = startPage || activeJob.currentPage || 1;
    activeJob.mode = mode;
    activeJob.status = 'RUNNING';
    activeJob.currentPage = pageToStart;
    activeJob.startedTime = activeJob.startedTime || new Date().toISOString();
    activeJob.lastError = null;
    isJobRunning = true;

    // Run asynchronously in background
    (async () => {
      try {
        if (mode === 'SPECIFIC_ID' && specificId) {
          const anime = await getJikanAnimeFull(specificId);
          if (anime) {
            await syncJikanAnimeToDatabase(anime);
            activeJob.insertedAnime++;
            activeJob.processedAnime++;
            activeJob.status = 'COMPLETED';
            activeJob.progressPercent = 100;
          } else {
            activeJob.failedAnime++;
            activeJob.failedIds.push(specificId);
            activeJob.status = 'FAILED';
            activeJob.lastError = `Anime with ID ${specificId} not found.`;
          }
          isJobRunning = false;
          return;
        }

        let pagesProcessedInRun = 0;
        let currentPage = pageToStart;

        while (pagesProcessedInRun < maxPagesToRun && isJobRunning) {
          try {
            console.log(`[Jikan Import Job] Processing mode: ${mode}, page ${currentPage}...`);
            let res: any;

            if (mode === 'SEASON') {
              const now = new Date();
              const season = 'summer';
              res = await getJikanSeasonalAnime(now.getFullYear(), season, currentPage, 25);
            } else {
              res = await getJikanTopAnime(currentPage, 25);
            }

            if (res.animes && res.animes.length > 0) {
              for (const anime of res.animes) {
                if (!isJobRunning) break;
                const animeId = await syncJikanAnimeToDatabase(anime);
                if (animeId) {
                  activeJob.insertedAnime++;
                } else {
                  activeJob.failedAnime++;
                  if (anime.mal_id) activeJob.failedIds.push(anime.mal_id);
                }
                activeJob.processedAnime++;
              }
            }

            activeJob.processedPages++;
            activeJob.currentPage = currentPage + 1;
            pagesProcessedInRun++;

            activeJob.progressPercent = Math.min(100, Math.round((activeJob.currentPage / activeJob.totalPages) * 100));

            if (!res.pagination?.has_next_page) {
              activeJob.status = 'COMPLETED';
              activeJob.completedTime = new Date().toISOString();
              break;
            }

            currentPage++;
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (pageErr: any) {
            console.error(`[Jikan Import Job] Error on page ${currentPage}:`, pageErr);
            activeJob.failedPages.push(currentPage);
            activeJob.lastError = pageErr?.message || String(pageErr);
            currentPage++;
            pagesProcessedInRun++;
          }
        }

        if (activeJob.status !== 'COMPLETED' && isJobRunning) {
          activeJob.status = 'PAUSED';
        }
      } catch (err: any) {
        console.error('[Jikan Import Job] Fatal error:', err);
        activeJob.status = 'FAILED';
        activeJob.lastError = err?.message || String(err);
      } finally {
        isJobRunning = false;
      }
    })();

    return activeJob;
  }

  static pauseJob(): ImportJobState {
    isJobRunning = false;
    activeJob.status = 'PAUSED';
    return activeJob;
  }

  static cancelJob(): ImportJobState {
    isJobRunning = false;
    activeJob.status = 'CANCELLED';
    return activeJob;
  }

  static resetJob(): ImportJobState {
    isJobRunning = false;
    activeJob = {
      jobId: `job-${Date.now()}`,
      provider: 'jikan',
      dataset: 'ANIME',
      mode: 'TOP',
      status: 'IDLE',
      currentPage: 1,
      totalPages: 100,
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
    return activeJob;
  }
}
