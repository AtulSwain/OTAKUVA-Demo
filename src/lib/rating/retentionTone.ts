/**
 * Colour for a retention percentage (owner, 2026-10-20): good retention is
 * green, under 40% is yellow, 20% and below is red. One rule everywhere
 * retention is shown (episode bars, totals, the rating window).
 */
export type RetentionTone = 'good' | 'low' | 'poor';

export const RETENTION_LOW_BELOW = 40;
export const RETENTION_POOR_AT_OR_BELOW = 20;

export function retentionTone(value: number): RetentionTone {
  if (value <= RETENTION_POOR_AT_OR_BELOW) return 'poor';
  if (value < RETENTION_LOW_BELOW) return 'low';
  return 'good';
}

const COLORS: Record<RetentionTone, string> = {
  good: '#22C55E',
  low: '#FACC15',
  poor: '#EF4444',
};

export function retentionColor(value: number): string {
  return COLORS[retentionTone(value)];
}

const RGB: Record<RetentionTone, string> = {
  good: '34, 197, 94',
  low: '250, 204, 21',
  poor: '239, 68, 68',
};

/** The same colour, translucent — for pills and soft backgrounds. */
export function retentionSoftColor(value: number, alpha = 0.14): string {
  return `rgba(${RGB[retentionTone(value)]}, ${alpha})`;
}

/** A short word for the band (UI copy only). */
export function retentionLabel(value: number): string {
  const t = retentionTone(value);
  return t === 'good' ? (value >= 80 ? 'Hooked' : 'Kept watching') : t === 'low' ? 'Drifting' : 'Lost them';
}
