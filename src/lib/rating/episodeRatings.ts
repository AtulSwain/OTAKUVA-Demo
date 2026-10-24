/**
 * Per-episode ratings (2026-10-19). Members rate episodes as they air — a
 * score (0.5–10, 0.1 steps, same rule as anime ratings) plus optional aspect
 * scores (Story, Characters… = ACTIVE_RATING_CATEGORIES).
 *
 * How this feeds the OTAKUVA Score (owner's decisions):
 *  - A member's score for the anime is the AVERAGE of the episodes they
 *    rated. A member who never rates episodes can still give one overall
 *    rating (AnimeRating), which counts as their score.
 *  - Each member counts ONCE in the OTAKUVA Score (bayesian over members),
 *    however many episodes they rate.
 *  - Aspect averages for OTAKUVA Vibe work the same way: per member, their
 *    episode aspect average, else their overall rating's aspect.
 *  - Nothing can be rated or reviewed before episode 1 has aired.
 *
 * "Has episode N aired" comes from real data only: Episode.airedAt,
 * AiringSchedule times, the anime's next-episode pointer, and — for a
 * finished show — its official episode count. No Episode rows are created.
 */
import { prisma } from '../prisma';
import { hasWatchedEpisode } from '../library/watchedCheck';
import { classifyAnimeStatus } from '../anime/animeStatus';
import { hasAnimePremiered } from '../anime/premiereStatus';
import { ACTIVE_RATING_CATEGORIES, calculateRawAverage, type RatingCategoryType } from './ratingEngine';
import { recalculateAnimeAggregates, validateRatingScore } from './ratingService';

export class EpisodeRatingError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

export interface EpisodeReleaseState {
  /** Highest episode number that has aired (0 = nothing yet: rating locked). */
  released: number;
  /** Declared total, when known. */
  total: number | null;
  /** The next episode to air, when known. */
  next: { number: number; airingAt: string } | null;
  /** Episode titles we have, by number. */
  titles: Record<number, string>;
  /** When each episode aired, where known (ISO). */
  airedAt: Record<number, string>;
  isOpen: boolean;
  /** The show is still airing (a new anime or a new season). */
  airing: boolean;
}

const GENERIC_TITLE = /^episode\s+\d+$/i;

export async function getEpisodeReleaseState(animeId: string, now = new Date()): Promise<EpisodeReleaseState> {
  const anime = await prisma.anime.findUnique({
    where: { id: animeId },
    select: { status: true, type: true, episodes: true, nextAiringEpisode: true, nextAiringAt: true },
  });
  if (!anime) return { released: 0, total: null, next: null, titles: {}, airedAt: {}, isOpen: false, airing: false };

  const [episodes, schedule] = await Promise.all([
    prisma.episode.findMany({ where: { animeId }, select: { number: true, title: true, airedAt: true } }),
    prisma.airingSchedule.findMany({ where: { animeId }, select: { episode: true, airingAt: true }, orderBy: { airingAt: 'asc' } }),
  ]);

  const status = classifyAnimeStatus(anime.status);
  const isMovie = /movie/i.test(anime.type || '');
  const total = anime.episodes && anime.episodes > 0 ? anime.episodes : isMovie ? 1 : null;
  const titles: Record<number, string> = {};
  const airedAt: Record<number, string> = {};
  let released = 0;

  for (const e of episodes) {
    const n = Math.floor(e.number);
    if (e.title && !GENERIC_TITLE.test(e.title.trim())) titles[n] = e.title;
    if (e.airedAt && e.airedAt <= now) {
      released = Math.max(released, n);
      airedAt[n] = e.airedAt.toISOString();
    }
  }
  for (const s of schedule) {
    if (s.airingAt <= now) {
      released = Math.max(released, s.episode);
      airedAt[s.episode] ??= s.airingAt.toISOString();
    }
  }
  if (anime.nextAiringEpisode && anime.nextAiringAt && anime.nextAiringAt <= now) {
    // The announced next episode's time has passed (status may lag behind).
    released = Math.max(released, anime.nextAiringEpisode);
    airedAt[anime.nextAiringEpisode] ??= anime.nextAiringAt.toISOString();
  }
  // Episodes we have a real, already-passed air time for.
  const datedReleased = released;
  if (anime.nextAiringEpisode && anime.nextAiringAt && anime.nextAiringAt > now) {
    released = Math.max(released, anime.nextAiringEpisode - 1);
  }
  if (status === 'finished') {
    // Every episode of a finished show has aired; its count is the official one.
    released = Math.max(released, total ?? 0, episodes.length ? Math.max(...episodes.map((e) => Math.floor(e.number))) : 0, 1);
  } else if ((status === 'airing' || (status === null && hasAnimePremiered(anime.status))) && released === 0) {
    // On air (or an unrecognised status that isn't "not yet aired") but no dated
    // episode on record: at least episode 1 is out.
    released = 1;
  }
  // "Not yet aired" only wins when no dated air time has passed — so a
  // premiere unlocks the moment episode 1's scheduled time arrives.
  if (status === 'upcoming') released = datedReleased;
  if (total !== null) released = Math.min(released, total);

  const upcoming = schedule.find((s) => s.airingAt > now);
  const next = upcoming
    ? { number: upcoming.episode, airingAt: upcoming.airingAt.toISOString() }
    : anime.nextAiringEpisode && anime.nextAiringAt && anime.nextAiringAt > now
      ? { number: anime.nextAiringEpisode, airingAt: anime.nextAiringAt.toISOString() }
      : null;

  return { released, total, next, titles, airedAt, isOpen: released > 0, airing: status === 'airing' && released > 0 };
}

/** Throws when nothing has aired yet — the server-side twin of the page's premiere lock. */
export async function assertRatingOpen(animeId: string) {
  const state = await getEpisodeReleaseState(animeId);
  if (!state.isOpen) throw new EpisodeRatingError('Ratings and reviews open when episode 1 airs.', 403);
  return state;
}

async function resolveAnimeId(animeIdOrSlug: string): Promise<string> {
  const anime = await prisma.anime.findFirst({ where: { OR: [{ id: animeIdOrSlug }, { slug: animeIdOrSlug }] }, select: { id: true } });
  if (!anime) throw new EpisodeRatingError('Anime not found', 404);
  return anime.id;
}

function cleanAspects(raw: unknown): { category: RatingCategoryType; score: number }[] {
  if (!raw || typeof raw !== 'object') return [];
  const out: { category: RatingCategoryType; score: number }[] = [];
  for (const cat of ACTIVE_RATING_CATEGORIES) {
    const v = (raw as Record<string, unknown>)[cat];
    if (v === undefined || v === null || v === '') continue;
    const check = validateRatingScore(Number(v));
    if (!check.valid) throw new EpisodeRatingError(`${cat.toLowerCase().replace(/_/g, ' ')}: ${check.error}`, 400);
    out.push({ category: cat, score: check.normalized });
  }
  return out;
}

export async function submitEpisodeRating(input: {
  userId: string;
  animeId: string;
  episodeNumber: number;
  score: number;
  categoryScores?: unknown;
  note?: unknown;
}) {
  const animeId = await resolveAnimeId(input.animeId);
  const n = Number(input.episodeNumber);
  if (!Number.isInteger(n) || n < 1) throw new EpisodeRatingError('Choose an episode to rate.', 400);
  const check = validateRatingScore(Number(input.score));
  if (!check.valid) throw new EpisodeRatingError(check.error || 'Invalid score', 400);
  const aspects = cleanAspects(input.categoryScores);
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 500) : '';

  const state = await getEpisodeReleaseState(animeId);
  if (!state.isOpen) throw new EpisodeRatingError('Ratings open when episode 1 airs.', 403);
  if (n > state.released) {
    throw new EpisodeRatingError(
      state.next && state.next.number === n ? `Episode ${n} hasn't aired yet.` : `Episode ${n} hasn't aired yet — you can rate up to episode ${state.released}.`,
      403
    );
  }
  const episode = await prisma.episode.findFirst({ where: { animeId, number: n }, select: { id: true } });
  const rating = await prisma.$transaction(async (tx) => {
    const saved = await tx.episodeRating.upsert({
      where: { userId_animeId_episodeNumber: { userId: input.userId, animeId, episodeNumber: n } },
      create: { userId: input.userId, animeId, episodeNumber: n, episodeId: episode?.id ?? null, rating: check.normalized, review: note || null },
      update: { rating: check.normalized, review: note || null, episodeId: episode?.id ?? null },
      select: { id: true },
    });
    await tx.episodeRatingCategoryScore.deleteMany({ where: { episodeRatingId: saved.id } });
    if (aspects.length) {
      await tx.episodeRatingCategoryScore.createMany({ data: aspects.map((a) => ({ episodeRatingId: saved.id, category: a.category, score: a.score })) });
    }
    return saved;
  });

  await recalculateAnimeAggregates(animeId);
  return { id: rating.id, episodeNumber: n, score: check.normalized, categoryScores: Object.fromEntries(aspects.map((a) => [a.category, a.score])), note: note || null };
}

export async function deleteEpisodeRating(userId: string, animeIdOrSlug: string, episodeNumber: number) {
  const animeId = await resolveAnimeId(animeIdOrSlug);
  const res = await prisma.episodeRating.deleteMany({ where: { userId, animeId, episodeNumber } });
  if (res.count === 0) throw new EpisodeRatingError('Rating not found', 404);
  await recalculateAnimeAggregates(animeId);
}

/** Retention is a whole percentage in steps of 5 (0, 5 … 100). */
export const RETENTION_STEP = 5;

/**
 * Episode retention (2026-10-20): how much an episode kept the member hooked,
 * 0–100%. Rated separately from the anime's own score and never feeds the
 * OTAKUVA Score. Any aired episode the member has marked watched can be
 * rated (watched first since 2026-10-21), airing or finished show.
 */
export async function submitEpisodeRetention(input: { userId: string; animeId: string; episodeNumber: number; retention: unknown }) {
  const animeId = await resolveAnimeId(input.animeId);
  const n = Number(input.episodeNumber);
  if (!Number.isInteger(n) || n < 1) throw new EpisodeRatingError('Choose an episode to rate.', 400);
  const r = Number(input.retention);
  if (input.retention === null || input.retention === '' || !Number.isFinite(r) || r < 0 || r > 100 || r % RETENTION_STEP !== 0) {
    throw new EpisodeRatingError(`Retention must be 0–100% in steps of ${RETENTION_STEP}.`, 400);
  }

  const state = await getEpisodeReleaseState(animeId);
  if (!state.isOpen) throw new EpisodeRatingError('Ratings open when episode 1 airs.', 403);
  if (n > state.released) {
    throw new EpisodeRatingError(
      state.next && state.next.number === n ? `Episode ${n} hasn't aired yet.` : `Episode ${n} hasn't aired yet — you can rate up to episode ${state.released}.`,
      403
    );
  }

  // Only after marking the episode watched (owner, 2026-10-21).
  if (!(await hasWatchedEpisode(input.userId, animeId, n))) {
    throw new EpisodeRatingError(`Mark episode ${n} as watched first, then rate how well it kept you watching.`, 409, 'EPISODE_NOT_WATCHED');
  }

  const episode = await prisma.episode.findFirst({ where: { animeId, number: n }, select: { id: true } });
  await prisma.episodeRating.upsert({
    where: { userId_animeId_episodeNumber: { userId: input.userId, animeId, episodeNumber: n } },
    create: { userId: input.userId, animeId, episodeNumber: n, episodeId: episode?.id ?? null, retention: r },
    update: { retention: r, episodeId: episode?.id ?? null },
  });
  return { episodeNumber: n, retention: r };
}

/** Clears one episode's retention; drops the row only when nothing else (a legacy score) is on it. */
export async function deleteEpisodeRetention(userId: string, animeIdOrSlug: string, episodeNumber: number) {
  const animeId = await resolveAnimeId(animeIdOrSlug);
  const row = await prisma.episodeRating.findUnique({
    where: { userId_animeId_episodeNumber: { userId, animeId, episodeNumber } },
    select: { id: true, rating: true, retention: true },
  });
  if (!row || row.retention === null) throw new EpisodeRatingError('Rating not found', 404);
  if (row.rating === null) await prisma.episodeRating.delete({ where: { id: row.id } });
  else await prisma.episodeRating.update({ where: { id: row.id }, data: { retention: null } });
}

export interface MemberScore {
  userId: string;
  /** Their score for the anime: episode average, else their overall rating. */
  score: number;
  /** "episodes" when it comes from episode ratings. */
  source: 'episodes' | 'overall';
  episodesRated: number;
  categories: Partial<Record<RatingCategoryType, number>>;
}

/**
 * One score per member for an anime (the input to the OTAKUVA Score and Vibe).
 * Since 2026-10-20 the anime and its episodes are rated separately: a member's
 * score is their overall rating of the anime. Only members with no overall
 * rating fall back to the average of the legacy per-episode scores they gave
 * (2026-10-19 – 2026-10-20), so those aren't lost. Retention never counts.
 */
export async function getMemberScores(animeId: string): Promise<MemberScore[]> {
  const [episodeRatings, overall] = await Promise.all([
    prisma.episodeRating.findMany({
      where: { animeId, episodeNumber: { not: null }, rating: { not: null } },
      select: { userId: true, rating: true, categoryScores: { select: { category: true, score: true } } },
    }),
    prisma.animeRating.findMany({
      where: { animeId, deletedAt: null },
      select: { userId: true, rating: true, categoryScores: { select: { category: true, score: true } } },
    }),
  ]);

  const out: MemberScore[] = [];
  const seen = new Set<string>();
  for (const o of overall) {
    const categories: Partial<Record<RatingCategoryType, number>> = {};
    for (const c of o.categoryScores) if ((ACTIVE_RATING_CATEGORIES as readonly string[]).includes(c.category)) categories[c.category as RatingCategoryType] = c.score;
    out.push({ userId: o.userId, score: o.rating, source: 'overall', episodesRated: 0, categories });
    seen.add(o.userId);
  }

  const byUser = new Map<string, { scores: number[]; cats: Map<string, number[]> }>();
  for (const r of episodeRatings) {
    if (seen.has(r.userId) || r.rating === null) continue;
    const u = byUser.get(r.userId) ?? { scores: [] as number[], cats: new Map<string, number[]>() };
    u.scores.push(r.rating);
    for (const c of r.categoryScores) u.cats.set(c.category, [...(u.cats.get(c.category) ?? []), c.score]);
    byUser.set(r.userId, u);
  }
  for (const [userId, u] of byUser) {
    const categories: Partial<Record<RatingCategoryType, number>> = {};
    for (const cat of ACTIVE_RATING_CATEGORIES) {
      const list = u.cats.get(cat);
      if (list?.length) categories[cat] = Math.round((calculateRawAverage(list) ?? 0) * 10) / 10;
    }
    out.push({
      userId,
      score: Math.round((calculateRawAverage(u.scores) ?? 0) * 10) / 10,
      source: 'episodes',
      episodesRated: u.scores.length,
      categories,
    });
  }
  return out;
}

/** Everything the episode list / rating window needs, for one anime and (optionally) one viewer. */
export async function getEpisodeRatingSummary(animeIdOrSlug: string, viewerId?: string | null) {
  const animeId = await resolveAnimeId(animeIdOrSlug);
  const [state, rows, mine] = await Promise.all([
    getEpisodeReleaseState(animeId),
    prisma.episodeRating.findMany({
      where: { animeId, episodeNumber: { not: null } },
      select: { userId: true, episodeNumber: true, rating: true, retention: true },
    }),
    viewerId
      ? prisma.episodeRating.findMany({
          where: { animeId, userId: viewerId, episodeNumber: { not: null } },
          select: { episodeNumber: true, rating: true, retention: true, review: true },
        })
      : Promise.resolve([]),
  ]);

  const avg = (list: number[]) => (list.length ? Math.round(list.reduce((sum, v) => sum + v, 0) / list.length) : null);
  const perEpisode = new Map<number, { scores: number[]; retention: number[] }>();
  for (const r of rows) {
    const n = r.episodeNumber!;
    const e = perEpisode.get(n) ?? { scores: [] as number[], retention: [] as number[] };
    if (r.rating !== null) e.scores.push(r.rating);
    if (r.retention !== null) e.retention.push(r.retention);
    perEpisode.set(n, e);
  }

  const episodes = Array.from({ length: state.released }, (_, i) => i + 1).map((n) => {
    const e = perEpisode.get(n);
    return {
      number: n,
      title: state.titles[n] ?? null,
      airedAt: state.airedAt[n] ?? null,
      /** Members' average retention %, rounded; null when nobody rated it yet. */
      retention: e && e.retention.length ? Math.round(e.retention.reduce((sum, v) => sum + v, 0) / e.retention.length) : null,
      retentionCount: e ? e.retention.length : 0,
      /** Legacy per-episode score average (kept for old data). */
      average: e && e.scores.length ? Math.round((calculateRawAverage(e.scores) ?? 0) * 10) / 10 : null,
      count: e ? e.scores.length : 0,
    };
  });

  // A member's retention for the anime = the average of their episodes; the
  // community figure averages members (each counts once, however many
  // episodes they rated).
  const byMember = new Map<string, number[]>();
  for (const r of rows) if (r.retention !== null) byMember.set(r.userId, [...(byMember.get(r.userId) ?? []), r.retention]);
  const memberRetention = Array.from(byMember.values()).map((list) => list.reduce((sum, v) => sum + v, 0) / list.length);
  const myRetentionList = mine.filter((m) => m.retention !== null).map((m) => m.retention as number);

  return {
    animeId,
    released: state.released,
    total: state.total,
    next: state.next,
    isOpen: state.isOpen,
    airing: state.airing,
    /** Community retention for the whole anime, 0–100; null until someone rated an episode. */
    retention: { value: avg(memberRetention.map((v) => Math.round(v))), members: memberRetention.length },
    /** The viewer's retention for the whole anime: the average of their episodes. */
    myRetention: { value: avg(myRetentionList), episodes: myRetentionList.length },
    episodes,
    /** The viewer's own episode ratings, by episode number. */
    mine: Object.fromEntries(
      mine.map((m) => [m.episodeNumber!, { retention: m.retention, score: m.rating, note: m.review }])
    ) as Record<number, { retention: number | null; score: number | null; note: string | null }>,
  };
}

/**
 * One member's legacy per-episode score for an anime (2026-10-19 – 10-20):
 * the average of the episode scores they gave. Only used when they have no
 * overall rating. Null when there are none.
 */
export async function getMyEpisodeScore(userId: string, animeId: string) {
  const rows = await prisma.episodeRating.findMany({
    where: { animeId, userId, episodeNumber: { not: null }, rating: { not: null } },
    select: { rating: true, categoryScores: { select: { category: true, score: true } } },
  });
  if (!rows.length) return null;
  const cats = new Map<string, number[]>();
  for (const r of rows) for (const c of r.categoryScores) cats.set(c.category, [...(cats.get(c.category) ?? []), c.score]);
  const categories: Partial<Record<RatingCategoryType, number>> = {};
  for (const cat of ACTIVE_RATING_CATEGORIES) {
    const list = cats.get(cat);
    if (list?.length) categories[cat] = Math.round((calculateRawAverage(list) ?? 0) * 10) / 10;
  }
  return {
    score: Math.round((calculateRawAverage(rows.map((r) => r.rating as number)) ?? 0) * 10) / 10,
    categories,
    episodesRated: rows.length,
  };
}
