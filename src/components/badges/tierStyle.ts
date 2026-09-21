import type { CSSProperties } from 'react';
import { getTier, type Tier, type TierKey } from '../../lib/badges/tiers';

export type BadgeTheme = 'light' | 'dark';

/**
 * Turns a tier's config colours into CSS custom properties. Components read
 * `--b-*` via their CSS module; the module picks the light or dark set from
 * the nearest `data-badge-theme` ancestor (the site itself is dark-only, so
 * dark is the default when no ancestor says otherwise).
 */
export function tierVars(tier: Tier | TierKey): CSSProperties {
  const t = typeof tier === 'string' ? getTier(tier) : tier;
  const vars: Record<string, string> = {
    '--b-fill-light': t.fill ?? 'transparent',
    '--b-ink-light': t.ink ?? 'var(--text-muted, currentColor)',
    '--b-stroke-light': t.stroke ?? 'transparent',
  };
  if (t.dark?.fill) vars['--b-fill-dark'] = t.dark.fill;
  if (t.dark?.ink) vars['--b-ink-dark'] = t.dark.ink;
  if (t.dark?.stroke) vars['--b-stroke-dark'] = t.dark.stroke;
  if (t.dark?.outline) vars['--b-outline-dark'] = t.dark.outline;
  return vars as CSSProperties;
}
