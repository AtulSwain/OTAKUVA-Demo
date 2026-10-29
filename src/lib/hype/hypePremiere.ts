/**
 * Hyped → tracked → told when it premieres (2026-10-25, owner).
 *
 *  1. Voting Hyped adds the anime to the member's library as Plan to Watch
 *     (only if it isn't there already — an existing status is never changed),
 *     so it shows under "You are tracking".
 *  2. Once episode 1 has aired (same rule as rating — getEpisodeReleaseState),
 *     every member who voted Hyped gets ONE notification: "<title> has
 *     premiered", linking to the anime's Retention section to rate it.
 *
 * Exactly-once: before creating, we look for an existing HYPE_PREMIERE
 * notification for that member + anime (same link), inside a per-anime
 * Postgres advisory lock, so two sweeps running at once can't both send it.
 * No schema change. Best-effort like every other notifier: a failure here
 * never breaks a vote, a page or a sync.
 */
import { prisma } from '../prisma';
import { logger } from '../logger';
import { getEpisodeReleaseState } from '../rating/episodeRatings';
import { getAnimeDisplayTitle } from '../animeTitleResolver';

export const HYPE_PREMIERE_NOTIFICATION = 'HYPE_PREMIERE';
/** Premieres older than this are not announced (nothing "just came out" any more). */
const ANNOUNCE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const premiereLink = (slug: string) => `/anime/${slug}#retention`;

/**
 * Hyped → library. Creates a Plan to Watch entry (plus the usual
 * STATUS_CHANGED activity) when the member doesn't track the anime yet.
 * Returns true when it was added.
 */
export async function addHypedAnimeToLibrary(userId: string, animeId: string): Promise<boolean> {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.userAnime.findUnique({ where: { userId_animeId: { userId, animeId } }, select: { id: true } });
      if (existing) return false;
      await tx.userAnime.create({ data: { userId, animeId, status: 'PLAN_TO_WATCH' } });
      await tx.activity.create({
        data: { userId, type: 'STATUS_CHANGED', animeId, metadata: JSON.stringify({ status: 'PLAN_TO_WATCH', via: 'hype' }) },
      });
      return true;
    });
  } catch (error) {
    // Two taps racing: the other one added it.
    if ((error as { code?: string })?.code === 'P2002') return false;
    logger.warn('hype: could not add to library', { error, userId, animeId });
    return false;
  }
}

/**
 * Sends premiere notifications that are due. With `userId`, only that
 * member's hyped anime are checked (cheap — used when they open their
 * notifications); without it, every hyped anime is checked.
 * Returns how many notifications were created.
 */
export async function notifyHypePremieres(opts: { userId?: string; now?: Date } = {}): Promise<number> {
  const now = opts.now ?? new Date();
  const votes = await prisma.animeHype.findMany({
    where: { level: 'HYPED', ...(opts.userId ? { userId: opts.userId } : {}) },
    select: { userId: true, animeId: true },
  });
  if (votes.length === 0) return 0;

  const byAnime = new Map<string, string[]>();
  for (const v of votes) byAnime.set(v.animeId, [...(byAnime.get(v.animeId) ?? []), v.userId]);

  let created = 0;
  for (const [animeId, voterIds] of byAnime) {
    try {
      const state = await getEpisodeReleaseState(animeId, now);
      if (!state.isOpen) continue; // not out yet
      const firstAired = state.airedAt[1] ? new Date(state.airedAt[1]).getTime() : null;
      if (firstAired !== null && now.getTime() - firstAired > ANNOUNCE_WINDOW_MS) continue;

      const anime = await prisma.anime.findUnique({
        where: { id: animeId },
        select: { slug: true, canonicalTitle: true, titles: true },
      });
      if (!anime) continue;
      const title = getAnimeDisplayTitle(anime as any);
      const linkUrl = premiereLink(anime.slug);

      created += await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`hype-premiere:${animeId}`}))`;
        const already = await tx.notification.findMany({
          where: { type: HYPE_PREMIERE_NOTIFICATION, linkUrl, userId: { in: voterIds } },
          select: { userId: true },
        });
        const done = new Set(already.map((n) => n.userId));
        const due = voterIds.filter((id) => !done.has(id));
        if (due.length === 0) return 0;
        await tx.notification.createMany({
          data: due.map((userId) => ({
            userId,
            type: HYPE_PREMIERE_NOTIFICATION,
            title: `${title} has premiered`,
            body: 'You were hyped for it — episode 1 is out now. Watch it, tick it in the Episode Guide and rate how well it kept you watching.',
            linkUrl,
          })),
        });
        return due.length;
      });
    } catch (error) {
      logger.warn('hype premiere notification failed', { error, animeId });
    }
  }
  return created;
}

/* ── Background sweep, throttled per process (pages call this; it never blocks a request) ── */
const SWEEP_EVERY_MS = 10 * 60 * 1000;
let lastSweep = 0;
let sweeping = false;

export function ensureHypePremiereNotifications(): void {
  const now = Date.now();
  if (sweeping || now - lastSweep < SWEEP_EVERY_MS) return;
  sweeping = true;
  lastSweep = now;
  notifyHypePremieres()
    .then((n) => {
      if (n > 0) logger.info('hype premiere notifications sent', { count: n });
    })
    .catch((error) => logger.warn('hype premiere sweep failed', { error }))
    .finally(() => {
      sweeping = false;
    });
}
