/**
 * OTAKUVA Rating Tier System — single source of truth.
 *
 * Every place in the product that turns a 0-10 score into a *word* or a
 * *colour* must read from this file. Before this existed there were four
 * competing ladders (the vibe donut, the score gauge, the rating modal and
 * the distribution card each invented their own), so the same 6.8 could read
 * "Mixed", "Average" and "Fine" on one page. That is the bug this fixes.
 *
 * Five tiers, contiguous, covering the whole 0.5-10.0 input range:
 *
 *   0.0 - 2.9   Worst
 *   3.0 - 5.9   Average
 *   6.0 - 6.9   Decent
 *   7.0 - 7.9   Good
 *   8.0 - 10.0  Great
 *
 * Two different colour functions live here on purpose:
 *
 *   getRatingTier(score)  -> the discrete band. Use for LABELS and badges.
 *   getScoreColor(score)  -> a continuous colour ramp. Use for BARS, rings
 *                            and gauges so the graph slides smoothly while a
 *                            user drags a slider instead of snapping between
 *                            five flat colours at the band edges.
 */

import type { CSSProperties } from 'react';

export type RatingTierId = 'WORST' | 'AVERAGE' | 'DECENT' | 'GOOD' | 'GREAT';

export interface RatingTier {
  id: RatingTierId;
  /** Visible label. Kept short so it fits inside the donut centre. */
  label: string;
  /** Inclusive lower bound. */
  min: number;
  /** Inclusive upper bound. */
  max: number;
  /** Solid tier colour — labels, badges, borders. */
  color: string;
  /** Same hue at low alpha — tracks, glows, tinted backgrounds. */
  colorSoft: string;
  /** One-line explanation shown in tooltips and the rating modal. */
  description: string;
}

export const RATING_TIERS: readonly RatingTier[] = [
  {
    id: 'WORST',
    label: 'Worst',
    min: 0,
    max: 2.99,
    color: '#EF4444',
    colorSoft: 'rgba(239, 68, 68, 0.16)',
    description: 'Fell apart. Not worth the time.',
  },
  {
    id: 'AVERAGE',
    label: 'Average',
    min: 3,
    max: 5.99,
    color: '#F59E0B',
    colorSoft: 'rgba(245, 158, 11, 0.16)',
    description: 'Has problems. Watchable, nothing more.',
  },
  {
    id: 'DECENT',
    label: 'Decent',
    min: 6,
    max: 6.99,
    color: '#EAB308',
    colorSoft: 'rgba(234, 179, 8, 0.16)',
    description: 'Solid enough. Works if the premise appeals to you.',
  },
  {
    id: 'GOOD',
    label: 'Good',
    min: 7,
    max: 7.99,
    color: '#84CC16',
    colorSoft: 'rgba(132, 204, 22, 0.16)',
    description: 'Genuinely good. An easy recommendation.',
  },
  {
    id: 'GREAT',
    label: 'Great',
    min: 8,
    max: 10,
    color: '#22C55E',
    colorSoft: 'rgba(34, 197, 94, 0.16)',
    description: 'Worth watching. Among the best in its class.',
  },
] as const;

/** Neutral colour used when there is genuinely no score to show. */
export const NO_SCORE_COLOR = '#52525B';
export const NO_SCORE_SOFT = 'rgba(82, 82, 91, 0.16)';
export const NO_SCORE_LABEL = 'Unrated';

/**
 * Discrete band for a score. Returns null for a missing score — callers must
 * render an honest empty state rather than defaulting to a tier.
 */
export function getRatingTier(score: number | null | undefined): RatingTier | null {
  if (typeof score !== 'number' || Number.isNaN(score)) return null;
  const clamped = Math.min(10, Math.max(0, score));
  return RATING_TIERS.find((t) => clamped >= t.min && clamped <= t.max) ?? RATING_TIERS[0];
}

/** Short label only ("Great"), or "Unrated" when there is no score. */
export function getRatingTierLabel(score: number | null | undefined): string {
  return getRatingTier(score)?.label ?? NO_SCORE_LABEL;
}

// ---------------------------------------------------------------------------
// Continuous colour ramp
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const to2 = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return '#' + to2(r) + to2(g) + to2(b);
}

function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t]);
}

/**
 * Anchor each tier colour at the midpoint of its band, then linearly blend
 * between neighbouring anchors. A score of 5.9 and a score of 6.0 land in
 * different tiers but only a shade apart, so dragging a slider produces a
 * smooth sweep rather than five hard jumps.
 */
const RAMP_ANCHORS: { at: number; color: string }[] = RATING_TIERS.map((t) => ({
  at: (Math.max(0, t.min) + Math.min(10, t.max)) / 2,
  color: t.color,
}));

/** Continuous colour for a score. Use for bars, rings, gauges, glows. */
export function getScoreColor(score: number | null | undefined): string {
  if (typeof score !== 'number' || Number.isNaN(score)) return NO_SCORE_COLOR;
  const s = Math.min(10, Math.max(0, score));

  const first = RAMP_ANCHORS[0];
  const last = RAMP_ANCHORS[RAMP_ANCHORS.length - 1];
  if (s <= first.at) return first.color;
  if (s >= last.at) return last.color;

  for (let i = 0; i < RAMP_ANCHORS.length - 1; i++) {
    const lo = RAMP_ANCHORS[i];
    const hi = RAMP_ANCHORS[i + 1];
    if (s >= lo.at && s <= hi.at) {
      return mix(lo.color, hi.color, (s - lo.at) / (hi.at - lo.at));
    }
  }
  return last.color;
}

/** Gradient string for a filled bar, darkened at the origin for depth. */
export function getScoreGradient(score: number | null | undefined, angle = '90deg'): string {
  if (typeof score !== 'number' || Number.isNaN(score)) {
    return 'linear-gradient(' + angle + ', #3F3F46 0%, ' + NO_SCORE_COLOR + ' 100%)';
  }
  const solid = getScoreColor(score);
  return 'linear-gradient(' + angle + ', ' + mix(solid, '#000000', 0.5) + ' 0%, ' + solid + ' 100%)';
}

/** Translucent version of the ramp colour, for tracks and tinted panels. */
export function getScoreSoftColor(score: number | null | undefined, alpha = 0.16): string {
  if (typeof score !== 'number' || Number.isNaN(score)) return NO_SCORE_SOFT;
  const [r, g, b] = hexToRgb(getScoreColor(score));
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

/**
 * CSS custom properties for a score, so a whole subtree can be themed by the
 * rating without every child needing its own inline style.
 */
export function getScoreCssVars(score: number | null | undefined): CSSProperties {
  const tier = getRatingTier(score);
  return {
    '--tier-color': getScoreColor(score),
    '--tier-color-soft': getScoreSoftColor(score),
    '--tier-gradient': getScoreGradient(score),
    '--tier-solid': tier ? tier.color : NO_SCORE_COLOR,
  } as CSSProperties;
}

/** Percentage of the 0-10 track a score fills. Shared by every meter. */
export function scoreToPercent(score: number | null | undefined): number {
  if (typeof score !== 'number' || Number.isNaN(score)) return 0;
  return Math.min(100, Math.max(0, (score / 10) * 100));
}
