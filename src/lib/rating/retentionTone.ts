import { retentionBadgeFor, type RetentionBadgeKey } from './retentionScore';

/**
 * Colour / word for a retention percentage. Since 2026-10-25 (owner) these
 * follow the five retention badge bands — Dropped, Sleeper, Solid, Peaking,
 * Hooked (`retentionScore.ts`) — in muted colours, everywhere retention is
 * shown. (Was green ≥40 / yellow <40 / red ≤20.)
 *
 * Note: a colour for a single number is only a tint. Whether an *anime*
 * actually holds a badge also depends on having enough ratings — use
 * `RetentionBadge` / the computed `badge` for that.
 */
export type RetentionTone = RetentionBadgeKey;

export function retentionTone(value: number): RetentionTone {
  return retentionBadgeFor(value).key;
}

export function retentionColor(value: number): string {
  return retentionBadgeFor(value).color;
}

/** The same colour, soft — for pills and backgrounds. */
export function retentionSoftColor(value: number): string {
  return retentionBadgeFor(value).soft;
}

/** The band's name (UI copy only). */
export function retentionLabel(value: number): string {
  return retentionBadgeFor(value).label;
}
