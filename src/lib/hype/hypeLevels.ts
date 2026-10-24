/**
 * Hype Meter levels: how members feel about an anime that hasn't premiered
 * yet. Shared by the server and the UI.
 *
 * Two choices since 2026-10-22 (owner): Hyped / Not interested (label
 * renamed from "Not hyped" 2026-10-23). Excited and
 * Curious were retired — their stored votes are kept untouched (user data),
 * but they're no longer offered, counted or shown on boards, and a member
 * whose vote is a retired level may vote once more (see `setHype`).
 */
export const HYPE_LEVELS = ['HYPED', 'SKIP'] as const;
export type HypeLevel = (typeof HYPE_LEVELS)[number];

export const RETIRED_HYPE_LEVELS = ['EXCITED', 'CURIOUS'] as const;
export type RetiredHypeLevel = (typeof RETIRED_HYPE_LEVELS)[number];
/** Labels for retired votes, for history (profile activity) only. */
export const RETIRED_HYPE_LABELS: Record<RetiredHypeLevel, string> = { EXCITED: 'Excited', CURIOUS: 'Curious' };

export function isRetiredHypeLevel(v: unknown): v is RetiredHypeLevel {
  return typeof v === 'string' && (RETIRED_HYPE_LEVELS as readonly string[]).includes(v);
}

/** Colours carry meaning (flame / grey) — the theme itself is black & grey. */
export const HYPE_LEVEL_INFO: Record<HypeLevel, { label: string; hint: string; weight: number; color: string }> = {
  HYPED: { label: 'Hyped', hint: 'Counting down the days', weight: 100, color: '#FF5A36' },
  SKIP: { label: 'Not interested', hint: 'Not for me', weight: 0, color: '#8A8A94' },
};

/** The hype % is only shown once a show has this many votes. */
export const MIN_HYPE_VOTES = 5;

export function isHypeLevel(v: unknown): v is HypeLevel {
  return typeof v === 'string' && (HYPE_LEVELS as readonly string[]).includes(v);
}

export type HypeCounts = Record<HypeLevel, number>;

export function emptyHypeCounts(): HypeCounts {
  return { HYPED: 0, SKIP: 0 };
}

/** Weighted average of the votes (0–100), or null below MIN_HYPE_VOTES. */
export function hypePercent(counts: HypeCounts): number | null {
  const total = HYPE_LEVELS.reduce((sum, l) => sum + counts[l], 0);
  if (total < MIN_HYPE_VOTES) return null;
  const weighted = HYPE_LEVELS.reduce((sum, l) => sum + counts[l] * HYPE_LEVEL_INFO[l].weight, 0);
  return Math.round(weighted / total);
}
