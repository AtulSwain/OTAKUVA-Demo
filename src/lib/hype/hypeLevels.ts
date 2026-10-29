/**
 * Hype Meter levels: how members feel about an anime that hasn't premiered
 * yet. Shared by the server and the UI.
 *
 * One choice since 2026-10-25 (owner): Hyped. Excited and Curious were
 * retired 2026-10-22, "Not interested" (SKIP) on 2026-10-25 — their stored
 * votes are kept untouched (user data), but they're no longer offered,
 * counted or shown on boards, and a member whose vote is a retired level may
 * vote once more (see `setHype`).
 */
export const HYPE_LEVELS = ['HYPED'] as const;
export type HypeLevel = (typeof HYPE_LEVELS)[number];

export const RETIRED_HYPE_LEVELS = ['EXCITED', 'CURIOUS', 'SKIP'] as const;
export type RetiredHypeLevel = (typeof RETIRED_HYPE_LEVELS)[number];
/** Labels for retired votes, for history (profile activity) only. */
export const RETIRED_HYPE_LABELS: Record<RetiredHypeLevel, string> = { EXCITED: 'Excited', CURIOUS: 'Curious', SKIP: 'Not interested' };

export function isRetiredHypeLevel(v: unknown): v is RetiredHypeLevel {
  return typeof v === 'string' && (RETIRED_HYPE_LEVELS as readonly string[]).includes(v);
}

/** The flame colour carries meaning — the theme itself is black & grey. */
export const HYPE_LEVEL_INFO: Record<HypeLevel, { label: string; hint: string; weight: number; color: string }> = {
  HYPED: { label: 'Hyped', hint: 'Counting down the days', weight: 100, color: '#FF5A36' },
};

/** The hype % is only shown once a show has this many votes. */
export const MIN_HYPE_VOTES = 5;

export function isHypeLevel(v: unknown): v is HypeLevel {
  return typeof v === 'string' && (HYPE_LEVELS as readonly string[]).includes(v);
}

export type HypeCounts = Record<HypeLevel, number>;

export function emptyHypeCounts(): HypeCounts {
  return { HYPED: 0 };
}

/** Weighted average of the votes (0–100), or null below MIN_HYPE_VOTES. */
export function hypePercent(counts: HypeCounts): number | null {
  const total = HYPE_LEVELS.reduce((sum, l) => sum + counts[l], 0);
  if (total < MIN_HYPE_VOTES) return null;
  const weighted = HYPE_LEVELS.reduce((sum, l) => sum + counts[l] * HYPE_LEVEL_INFO[l].weight, 0);
  return Math.round(weighted / total);
}
