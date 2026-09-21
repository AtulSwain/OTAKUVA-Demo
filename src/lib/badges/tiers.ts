/**
 * OTAKUVA reviewer badges — the single source of truth for tier data.
 *
 * Nothing else in the codebase may hard-code a tier name, kanji, threshold
 * or colour: components, jobs, seeds and tests all read from here.
 *
 * TODO(i18n/native review): the Japanese titles (Kōhai, Senpai, Buchō,
 * Mekiki, Sensei, Tatsujin, Meijin, Densetsu) and the seal kanji were chosen
 * by the product team, not a native speaker. Ask a native Japanese speaker
 * to review them before launch. Notes for the reviewer:
 *  - Mekiki's full word is 目利き; the seal shows only 目利 because the
 *    trailing hiragana does not fit a two-character stack. Tooltips and
 *    labels use the full word (`kanjiFull`).
 *  - Senpai (先輩) and Sensei (先生) share the character 先. Chips therefore
 *    never use kanji.
 *
 * Volume tiers are DERIVED from the counted-review total; they are never
 * stored per user (see UserBadge for future specialty/seasonal badges).
 */

export type TierKey =
  | 'shoshinsha'
  | 'kohai'
  | 'senpai'
  | 'buchou'
  | 'mekiki'
  | 'sensei'
  | 'tatsujin'
  | 'meijin'
  | 'densetsu';

export interface Tier {
  key: TierKey;
  /** Romaji display name (macron form). */
  name: string;
  /** Kanji shown on the seal (2-char stack, or a single char for Shoshinsha). */
  kanji: string;
  /** Full written form, used in tooltips and labels. */
  kanjiFull: string;
  /** Qualified (counted) reviews needed. */
  min: number;
  /** Seal fill; `null` = no fill (dashed outline, Shoshinsha). */
  fill: string | null;
  /** Glyph colour. `null` = the theme's muted text colour. */
  ink: string | null;
  /** Border stroke on the seal, when it differs from the default inner border. */
  stroke: string | null;
  /** Ivory/lacquer "special" seals get a gold inner border and a distinct chip. */
  special: boolean;
  /** Dark-theme overrides for tiers that lose contrast on a dark surface. */
  dark?: { fill?: string; ink?: string; stroke?: string; outline?: string };
  /** Message key in BADGE_STRINGS (see strings.ts) for the English meaning. */
  glossKey: string;
}

export const TIERS: readonly Tier[] = [
  { key: 'shoshinsha', name: 'Shoshinsha', kanji: '初', kanjiFull: '初心者', min: 0, fill: null, ink: null, stroke: null, special: false, glossKey: 'shoshinsha' },
  { key: 'kohai', name: 'Kōhai', kanji: '後輩', kanjiFull: '後輩', min: 10, fill: '#3F8F68', ink: '#FFFFFF', stroke: null, special: false, glossKey: 'kohai' },
  { key: 'senpai', name: 'Senpai', kanji: '先輩', kanjiFull: '先輩', min: 100, fill: '#2B6CA3', ink: '#FFFFFF', stroke: null, special: false, glossKey: 'senpai' },
  { key: 'buchou', name: 'Buchō', kanji: '部長', kanjiFull: '部長', min: 200, fill: '#1E8C93', ink: '#FFFFFF', stroke: null, special: false, glossKey: 'buchou' },
  { key: 'mekiki', name: 'Mekiki', kanji: '目利', kanjiFull: '目利き', min: 300, fill: '#6A3F9C', ink: '#FFFFFF', stroke: null, special: false, glossKey: 'mekiki' },
  { key: 'sensei', name: 'Sensei', kanji: '先生', kanjiFull: '先生', min: 500, fill: '#B7282E', ink: '#FFFFFF', stroke: null, special: false, glossKey: 'sensei' },
  // Iron navy vanishes into a dark surface: lighten the fill and add a stroke there.
  { key: 'tatsujin', name: 'Tatsujin', kanji: '達人', kanjiFull: '達人', min: 700, fill: '#1F2F4A', ink: '#FFFFFF', stroke: null, special: false, dark: { fill: '#2A4066', stroke: '#6F8BB8' }, glossKey: 'tatsujin' },
  // Black lacquer disappears on a dark surface: keep it, but outline it in gold.
  { key: 'meijin', name: 'Meijin', kanji: '名人', kanjiFull: '名人', min: 1000, fill: '#1C1C1E', ink: '#E3C15A', stroke: '#E3C15A', special: true, dark: { stroke: '#E3C15A', outline: '#E3C15A' }, glossKey: 'meijin' },
  { key: 'densetsu', name: 'Densetsu', kanji: '伝説', kanjiFull: '伝説', min: 1500, fill: '#F4EFE3', ink: '#C8321F', stroke: '#C9A227', special: true, glossKey: 'densetsu' },
] as const;

export const TIER_KEYS: readonly TierKey[] = TIERS.map((t) => t.key);

/** Every tier that can be earned by counted reviews (i.e. all but Shoshinsha). */
export const EARNED_TIERS: readonly Tier[] = TIERS.filter((t) => t.min > 0);

export const TOP_TIER: Tier = TIERS[TIERS.length - 1];

const TIER_BY_KEY: Record<string, Tier> = Object.fromEntries(TIERS.map((t) => [t.key, t]));

export function getTier(key: TierKey | string): Tier {
  return TIER_BY_KEY[key] ?? TIERS[0];
}

export function isTierKey(value: unknown): value is TierKey {
  return typeof value === 'string' && value in TIER_BY_KEY;
}

export function tierIndex(tier: Tier | TierKey): number {
  const key = typeof tier === 'string' ? tier : tier.key;
  return TIERS.findIndex((t) => t.key === key);
}

/** Tier whose threshold the counted total has reached. Negative/NaN counts clamp to 0. */
export function tierFor(count: number): Tier {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  let current = TIERS[0];
  for (const t of TIERS) {
    if (n >= t.min) current = t;
    else break;
  }
  return current;
}

/** The tier after the one `count` currently earns, or `null` at the top. */
export function nextTier(count: number): Tier | null {
  const i = tierIndex(tierFor(count));
  return i >= 0 && i < TIERS.length - 1 ? TIERS[i + 1] : null;
}

export interface TierProgressInfo {
  current: Tier;
  next: Tier | null;
  /** Reviews still needed for `next`; 0 at the top tier. */
  remaining: number;
  /** 0..1, measured between the current and next thresholds; 1 at the top tier. */
  fraction: number;
}

export function progressToNext(count: number): TierProgressInfo {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  const current = tierFor(n);
  const next = nextTier(n);
  if (!next) return { current, next: null, remaining: 0, fraction: 1 };
  const span = next.min - current.min;
  return {
    current,
    next,
    remaining: next.min - n,
    fraction: span > 0 ? Math.min(1, Math.max(0, (n - current.min) / span)) : 1,
  };
}
