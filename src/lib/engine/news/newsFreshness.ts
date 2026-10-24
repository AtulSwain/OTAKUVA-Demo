/**
 * Keeps the news feed current without depending on the worker process.
 *
 * News is normally refreshed by the BullMQ recurring `news-sync` job, but that
 * needs `npm run worker` + Redis. When it isn't running, nothing ingests and
 * the site serves whatever was last stored. `ensureFreshNews()` is a
 * stale-while-revalidate fallback called from the news-reading API routes: if
 * the last sync attempt in this process is older than the interval, it starts
 * one in the background and returns immediately (the request is never blocked
 * on the network). Ingestion dedups on external id, so running alongside the
 * worker is safe.
 */

import { logger } from '../../logger';
import { newsEngine } from './newsEngine';

const REFRESH_INTERVAL_MS = Number(process.env.NEWS_REFRESH_INTERVAL_MS) || 10 * 60 * 1000;

let lastAttemptAt = 0;
let inFlight = false;

export function ensureFreshNews(): void {
  const now = Date.now();
  if (inFlight || now - lastAttemptAt < REFRESH_INTERVAL_MS) return;

  inFlight = true;
  lastAttemptAt = now;
  newsEngine
    .syncAllProviders(40)
    .then((results) => {
      const created = results.reduce((sum: number, r: any) => sum + (r?.createdCount || 0), 0);
      logger.info('news refresh complete', { created });
    })
    .catch((err: unknown) => {
      // A failed refresh must never touch stored articles — just try again next interval.
      logger.warn('news refresh failed', { error: err instanceof Error ? err.message : String(err) });
    })
    .finally(() => {
      inFlight = false;
    });
}
