/**
 * Keeps the airing schedule current without depending on the worker process.
 *
 * The schedule is normally refreshed by the BullMQ recurring `sync:airing`
 * job, but that needs `npm run worker` + Redis; when it isn't running the
 * schedule silently goes stale (it had been three weeks without a refresh
 * when this was added). Same stale-while-revalidate shape as
 * ensureFreshNews(): called from schedule-reading pages/routes, it starts a
 * sync in the background when the last AniList verification is older than
 * the interval and returns immediately — a request is never blocked on the
 * network. syncWeeklySchedule() upserts on (animeId, episode, releaseType)
 * and holds its own lock, so running alongside the worker is safe.
 */

import { prisma } from '../../prisma';
import { logger } from '../../logger';
import { syncEngine } from '../../syncEngine';
import { syncStreamingLinksForUpcomingSchedule } from '../../catalog/streamingLinks';
import { notifyHypePremieres } from '../../hype/hypePremiere';

const REFRESH_INTERVAL_MS = Number(process.env.SCHEDULE_REFRESH_INTERVAL_MS) || 3 * 60 * 60 * 1000;
/** Minimum gap between attempts in this process, even when attempts fail. */
const RETRY_BACKOFF_MS = 15 * 60 * 1000;

let lastAttemptAt = 0;
let inFlight = false;

export function ensureFreshSchedule(): void {
  const now = Date.now();
  if (inFlight || now - lastAttemptAt < RETRY_BACKOFF_MS) return;
  inFlight = true;
  lastAttemptAt = now;

  (async () => {
    // Freshness lives in the DB, so a restarted process doesn't re-sync needlessly.
    const latest = await prisma.airingSchedule.findFirst({
      where: { source: 'anilist' },
      orderBy: { lastVerifiedAt: 'desc' },
      select: { lastVerifiedAt: true },
    });
    if (latest && now - latest.lastVerifiedAt.getTime() < REFRESH_INTERVAL_MS) return;

    const res = await syncEngine.syncWeeklySchedule();
    if (!res.success) logger.warn('schedule refresh failed', { error: res.error });
    // Newly scheduled shows: fetch their official streaming listings so the
    // schedule can say where each episode streams.
    await syncStreamingLinksForUpcomingSchedule().catch((err: unknown) =>
      logger.warn('streaming-link refresh failed', { error: err instanceof Error ? err.message : String(err) })
    );
    // Fresh air times can mean a hyped show just premiered — tell its fans.
    await notifyHypePremieres().catch(() => 0);
  })()
    .catch((err: unknown) => {
      // A failed refresh never touches stored rows — just try again later.
      logger.warn('schedule refresh failed', { error: err instanceof Error ? err.message : String(err) });
    })
    .finally(() => {
      inFlight = false;
    });
}
