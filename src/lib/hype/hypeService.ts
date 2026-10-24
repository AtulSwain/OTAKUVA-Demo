/**
 * Hype Meter (2026-10-20): members say how they feel about an anime before it
 * premieres — Hyped / Not interested (Excited and Curious retired 2026-10-22,
 * see hypeLevels.ts). One vote each, open
 * until episode 1 airs (same release rule as rating: getEpisodeReleaseState),
 * then frozen as "hype before premiere". Never feeds the OTAKUVA Score.
 */
import { unstable_cache, revalidateTag } from 'next/cache';
import { prisma } from '../prisma';
import { getEpisodeReleaseState } from '../rating/episodeRatings';
import { classifyAnimeStatus } from '../anime/animeStatus';
import { getAnimeDisplayTitle } from '../animeTitleResolver';
import { HYPE_LEVELS, emptyHypeCounts, hypePercent, isHypeLevel, isRetiredHypeLevel, type HypeCounts, type HypeLevel } from './hypeLevels';
import { notifyFollowersOfCreatorHype } from '../social/followService';

export class HypeError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export const HYPE_BOARD_TAG = 'hype-board';

/** Refresh the cached boards after a vote (a no-op outside the Next runtime, e.g. tests). */
function refreshBoards() {
  try {
    revalidateTag(HYPE_BOARD_TAG);
  } catch {
    /* not in a request: nothing cached to refresh */
  }
}

async function resolveAnimeId(idOrSlug: string): Promise<string> {
  const anime = await prisma.anime.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }, select: { id: true } });
  if (!anime) throw new HypeError('Anime not found', 404);
  return anime.id;
}

async function countsFor(animeIds: string[]): Promise<Map<string, HypeCounts>> {
  const out = new Map<string, HypeCounts>();
  if (animeIds.length === 0) return out;
  const rows = await prisma.animeHype.groupBy({ by: ['animeId', 'level'], where: { animeId: { in: animeIds } }, _count: { _all: true } });
  for (const r of rows) {
    if (!isHypeLevel(r.level)) continue;
    const c = out.get(r.animeId) ?? emptyHypeCounts();
    c[r.level] = r._count._all;
    out.set(r.animeId, c);
  }
  return out;
}

/** The meter for one anime, plus the viewer's own vote. */
export async function getHypeSummary(animeIdOrSlug: string, viewerId?: string | null) {
  const animeId = await resolveAnimeId(animeIdOrSlug);
  const [state, counts, mine] = await Promise.all([
    getEpisodeReleaseState(animeId),
    countsFor([animeId]),
    viewerId ? prisma.animeHype.findUnique({ where: { userId_animeId: { userId: viewerId, animeId } }, select: { level: true } }) : null,
  ]);
  const c = counts.get(animeId) ?? emptyHypeCounts();
  const total = HYPE_LEVELS.reduce((sum, l) => sum + c[l], 0);
  return {
    animeId,
    /** Voting is open only until episode 1 airs. */
    open: !state.isOpen,
    counts: c,
    total,
    percent: hypePercent(c),
    mine: mine && isHypeLevel(mine.level) ? mine.level : null,
  };
}

export async function setHype(userId: string, animeIdOrSlug: string, level: unknown) {
  if (!isHypeLevel(level)) throw new HypeError('Pick Hyped or Not interested.', 400);
  const animeId = await resolveAnimeId(animeIdOrSlug);
  const state = await getEpisodeReleaseState(animeId);
  if (state.isOpen) throw new HypeError("It's out now — rate it instead of hyping it.", 409);
  // A vote is final (owner, 2026-10-21): the first pick is locked in. Sending
  // the same level again is harmless; a different one is refused.
  const existing = await prisma.animeHype.findUnique({ where: { userId_animeId: { userId, animeId } }, select: { level: true } });
  if (existing) {
    if (existing.level === level) return;
    // A vote for a retired level (Excited / Curious) isn't counted any more,
    // so its owner gets one vote on the current choices — their own action.
    if (isRetiredHypeLevel(existing.level)) {
      await prisma.animeHype.update({ where: { userId_animeId: { userId, animeId } }, data: { level } });
      refreshBoards();
      if (level === 'HYPED') await notifyFollowersOfCreatorHype(userId, animeId);
      return;
    }
    throw new HypeError('Your hype is locked in — it can’t be changed.', 409);
  }
  try {
    await prisma.animeHype.create({ data: { userId, animeId, level } });
  } catch (error) {
    // Two taps racing: the other request already recorded the vote.
    if ((error as { code?: string })?.code === 'P2002') throw new HypeError('Your hype is locked in — it can’t be changed.', 409);
    throw error;
  }
  refreshBoards();
  // Creators only: their followers hear they're hyped (no-op for others).
  if (level === 'HYPED') await notifyFollowersOfCreatorHype(userId, animeId);
}

/** Votes are final (2026-10-21): taking one back is refused. Kept so the
 *  DELETE route answers clearly instead of 405. */
export async function clearHype(_userId: string, animeIdOrSlug: string) {
  await resolveAnimeId(animeIdOrSlug);
  throw new HypeError('Your hype is locked in — it can’t be taken back.', 409);
}

export interface HypeBoardItem {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  type: string | null;
  season: string | null;
  year: number | null;
  /** Exact upcoming premiere (day precision or episode 1's air time); null when only approximate. */
  premiereAt: string | null;
  /** "November 2026" / "2026" when only the month or year is known. */
  premiereText: string | null;
  counts: HypeCounts;
  total: number;
  percent: number | null;
}

/**
 * Anime that haven't premiered: provider status says upcoming AND no dated
 * air time (episode, schedule, next-airing) has passed — the same test
 * getEpisodeReleaseState uses, done in bulk.
 */
async function upcomingCandidates(limit: number) {
  const now = new Date();
  const statuses = (await prisma.anime.findMany({ distinct: ['status'], select: { status: true } }))
    .map((r) => r.status)
    .filter((s) => classifyAnimeStatus(s) === 'upcoming');
  if (statuses.length === 0) return [];
  const rows = await prisma.anime.findMany({
    where: { status: { in: statuses }, isAdult: false },
    select: { id: true, slug: true, canonicalTitle: true, posterUrl: true, type: true, season: true, year: true, startDate: true, datePrecision: true, nextAiringAt: true, nextAiringEpisode: true, members: true },
    orderBy: [{ startDate: { sort: 'asc', nulls: 'last' } }, { members: { sort: 'desc', nulls: 'last' } }],
    take: limit * 3,
  });
  const ids = rows.map((r) => r.id);
  const [aired, scheduled] = await Promise.all([
    prisma.episode.findMany({ where: { animeId: { in: ids }, airedAt: { lte: now } }, select: { animeId: true }, distinct: ['animeId'] }),
    prisma.airingSchedule.findMany({ where: { animeId: { in: ids }, airingAt: { lte: now } }, select: { animeId: true }, distinct: ['animeId'] }),
  ]);
  const started = new Set([...aired.map((r) => r.animeId), ...scheduled.map((r) => r.animeId)]);
  return rows.filter((r) => !started.has(r.id) && !(r.nextAiringAt && r.nextAiringAt <= now)).slice(0, limit);
}

export async function buildHypeBoard(kind: HypeLevel | 'upcoming', limit: number): Promise<HypeBoardItem[]> {
  // A level board ranks by that level's real vote count across EVERY upcoming
  // show (exact counts from the database), so the most-voted show always
  // leads — it's never cut off by a premiere-date window. The 'upcoming' list
  // is the date-ordered one.
  let candidates: Awaited<ReturnType<typeof upcomingCandidates>>;
  if (kind === 'upcoming') {
    candidates = await upcomingCandidates(Math.max(limit, 80));
  } else {
    // Every show that hasn't premiered (no window), then only those that got
    // this vote — counted exactly below.
    const allUpcoming = await upcomingCandidates(100_000);
    const voted = await prisma.animeHype.groupBy({
      by: ['animeId'],
      where: { level: kind, animeId: { in: allUpcoming.map((a) => a.id) } },
      _count: { _all: true },
    });
    const votedIds = new Set(voted.map((v) => v.animeId));
    candidates = allUpcoming.filter((a) => votedIds.has(a.id));
  }
  const counts = await countsFor(candidates.map((c) => c.id));
  const now = Date.now();
  const sortKey = new Map<string, [number, number]>();
  let items: HypeBoardItem[] = candidates.map((a) => {
    const c = counts.get(a.id) ?? emptyHypeCounts();
    // Only a real, future, day-precise date (or episode 1's scheduled time) gets
    // a countdown; month/year-only dates are shown as such, never as a day.
    let exact: Date | null = a.nextAiringEpisode === 1 && a.nextAiringAt && a.nextAiringAt.getTime() > now ? a.nextAiringAt : null;
    if (!exact && a.startDate && a.datePrecision === 'DAY' && a.startDate.getTime() > now) exact = a.startDate;
    let premiereText: string | null = null;
    if (!exact && a.startDate) {
      const d = a.startDate;
      const thisMonth = new Date(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1).getTime();
      if (a.datePrecision === 'MONTH' && d.getTime() >= thisMonth) premiereText = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
      else if (a.datePrecision === 'YEAR' && d.getUTCFullYear() >= new Date(now).getUTCFullYear()) premiereText = String(d.getUTCFullYear());
    }
    sortKey.set(a.id, exact ? [0, exact.getTime()] : premiereText && a.startDate ? [1, a.startDate.getTime()] : [2, -(a.members ?? 0)]);
    const premiere = exact;
    return {
      id: a.id,
      slug: a.slug,
      title: getAnimeDisplayTitle(a),
      posterUrl: a.posterUrl || null,
      type: a.type,
      season: a.season,
      year: a.year,
      premiereAt: premiere ? premiere.toISOString() : null,
      premiereText,
      counts: c,
      total: HYPE_LEVELS.reduce((sum, l) => sum + c[l], 0),
      percent: hypePercent(c),
    };
  });
  // Soonest exact premieres first, then month/year-only ones, then the rest by popularity.
  items.sort((x, y) => {
    const a = sortKey.get(x.id)!;
    const b = sortKey.get(y.id)!;
    return a[0] - b[0] || a[1] - b[1];
  });
  if (kind !== 'upcoming') {
    // Only shows that actually got this vote. Order: most votes of this level
    // first (exact counts); ties → more votes overall → sooner premiere →
    // title, so the same counts always give the same order.
    const premiereTime = (i: HypeBoardItem) => (i.premiereAt ? new Date(i.premiereAt).getTime() : Number.MAX_SAFE_INTEGER);
    items = items
      .filter((i) => i.counts[kind] > 0)
      .sort(
        (a, b) =>
          b.counts[kind] - a.counts[kind] ||
          b.total - a.total ||
          premiereTime(a) - premiereTime(b) ||
          a.title.localeCompare(b.title)
      );
  }
  return items.slice(0, limit);
}

const cachedBoard = unstable_cache((kind: HypeLevel | 'upcoming', limit: number) => buildHypeBoard(kind, limit), ['hype-board'], {
  revalidate: 300,
  tags: [HYPE_BOARD_TAG],
});

/** Upcoming anime by premiere date ('upcoming'), or the ones with the most votes of one level. */
export function getHypeBoard(kind: HypeLevel | 'upcoming', limit = 20) {
  return cachedBoard(kind, Math.min(40, Math.max(1, limit)));
}

/** The viewer's own votes for a set of anime (to mark their pick on cards). */
export async function getMyHypes(userId: string, animeIds: string[]): Promise<Record<string, HypeLevel>> {
  if (animeIds.length === 0) return {};
  const rows = await prisma.animeHype.findMany({ where: { userId, animeId: { in: animeIds } }, select: { animeId: true, level: true } });
  return Object.fromEntries(rows.filter((r) => isHypeLevel(r.level)).map((r) => [r.animeId, r.level as HypeLevel]));
}
