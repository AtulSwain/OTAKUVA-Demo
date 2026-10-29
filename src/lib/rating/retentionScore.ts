/**
 * Episode Retention — the one place the numbers and badges are decided
 * (2026-10-25, owner). Pure functions only, so the server, the API and the
 * tests all use exactly the same rules.
 *
 *   1. A member rates an episode they've marked watched: a whole number 1–100
 *      ("how well did this episode keep you watching?"). One rating per member
 *      per episode — rating again replaces it.
 *   2. Episode score = the plain mean of that episode's ratings.
 *      No ratings → "Not rated" (never 0).
 *   3. Anime score = the mean of its rated episodes' scores — every rated
 *      episode counts once, however many people rated it. Unrated episodes
 *      are left out, never counted as 0.
 *   4. The badge comes from the RAW anime score (89.6 is PEAKING even though
 *      it displays as 90%). It's only given once there's enough data
 *      (`RETENTION_MIN_*`); before that the score shows as Provisional.
 *
 * These are members' own reports of how engaged they felt — not measured
 * watch-time.
 */

export const RETENTION_MIN = 1;
export const RETENTION_MAX = 100;

/** A valid rating: a whole number from 1 to 100. */
export function isValidRetention(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= RETENTION_MIN && value <= RETENTION_MAX;
}

export type RetentionBadgeKey = 'DROPPED' | 'SLEEPER' | 'SOLID' | 'PEAKING' | 'HOOKED';

export interface RetentionBadgeInfo {
  key: RetentionBadgeKey;
  label: string;
  /** Inclusive lower bound of the raw score. */
  from: number;
  /** Muted text colour. */
  color: string;
  /** Soft background for the chip. */
  soft: string;
}

/**
 * Highest first. Clear but not neon (owner, 2026-10-25): green at the top,
 * then lime, yellow, orange and red — used for the badge, the episode chart
 * and the rating bar alike. "Hooked" was "Locked In" until 2026-10-25.
 */
export const RETENTION_BADGES: readonly RetentionBadgeInfo[] = [
  { key: 'HOOKED', label: 'Hooked', from: 90, color: '#34C77B', soft: 'rgba(52, 199, 123, 0.15)' },
  { key: 'PEAKING', label: 'Peaking', from: 70, color: '#9BCB4E', soft: 'rgba(155, 203, 78, 0.15)' },
  { key: 'SOLID', label: 'Solid', from: 40, color: '#E6C04A', soft: 'rgba(230, 192, 74, 0.15)' },
  { key: 'SLEEPER', label: 'Sleeper', from: 20, color: '#EE8F45', soft: 'rgba(238, 143, 69, 0.15)' },
  { key: 'DROPPED', label: 'Dropped', from: 0, color: '#E5564E', soft: 'rgba(229, 86, 78, 0.15)' },
];

/** The badge band for a raw (unrounded) score. */
export function retentionBadgeFor(raw: number): RetentionBadgeInfo {
  return RETENTION_BADGES.find((b) => raw >= b.from) ?? RETENTION_BADGES[RETENTION_BADGES.length - 1];
}

export function retentionBadgeInfo(key: RetentionBadgeKey): RetentionBadgeInfo {
  return RETENTION_BADGES.find((b) => b.key === key)!;
}

/**
 * Minimum data for a definitive badge, the same everywhere:
 *  - at least 3 different members have rated episodes of the anime, and
 *  - at least 3 of its episodes are rated (or every episode, for a show with
 *    fewer than 3 — a movie needs its one episode rated).
 * Below that the score is shown as Provisional, without a badge.
 */
export const RETENTION_MIN_RATERS = 3;
export const RETENTION_MIN_RATED_EPISODES = 3;

export function requiredRatedEpisodes(declaredEpisodes: number | null | undefined): number {
  const total = typeof declaredEpisodes === 'number' && declaredEpisodes > 0 ? declaredEpisodes : RETENTION_MIN_RATED_EPISODES;
  return Math.min(RETENTION_MIN_RATED_EPISODES, total);
}

/** Mean of a list, or null when empty. */
export function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

/** Score shown to people: whole percent. Never used to pick a badge. */
export function displayRetention(raw: number | null): number | null {
  return raw === null ? null : Math.round(raw);
}

export interface EpisodeRetentionStat {
  number: number;
  /** Sum and count of the episode's valid ratings. */
  sum: number;
  count: number;
}

export type RetentionStatus = 'unrated' | 'provisional' | 'rated';

export interface AnimeRetention {
  /** Mean of rated episodes' scores, unrounded; null when nothing is rated. */
  raw: number | null;
  /** Whole-percent display value. */
  value: number | null;
  /** Episodes with at least one rating (the ones that count). */
  ratedEpisodes: number;
  /** All valid episode ratings for the anime. */
  totalRatings: number;
  /** Different members who rated at least one episode. */
  raters: number;
  status: RetentionStatus;
  /** Only when status is 'rated'. */
  badge: RetentionBadgeKey | null;
  /** What it takes to leave Provisional (for the UI's explanation). */
  needs: { raters: number; ratedEpisodes: number };
}

/** The anime-level score from its episodes' rating totals. */
export function computeAnimeRetention(
  episodes: EpisodeRetentionStat[],
  raters: number,
  declaredEpisodes?: number | null
): AnimeRetention {
  const rated = episodes.filter((e) => e.count > 0);
  const episodeScores = rated.map((e) => e.sum / e.count);
  const raw = mean(episodeScores);
  const totalRatings = rated.reduce((sum, e) => sum + e.count, 0);
  const needs = { raters: RETENTION_MIN_RATERS, ratedEpisodes: requiredRatedEpisodes(declaredEpisodes) };
  const enough = raw !== null && raters >= needs.raters && rated.length >= needs.ratedEpisodes;
  return {
    raw,
    value: displayRetention(raw),
    ratedEpisodes: rated.length,
    totalRatings,
    raters,
    status: raw === null ? 'unrated' : enough ? 'rated' : 'provisional',
    badge: enough && raw !== null ? retentionBadgeFor(raw).key : null,
    needs,
  };
}
