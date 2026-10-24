import { useId } from 'react';
import { getTier, tierIndex, type Tier, type TierKey } from '../../lib/badges/tiers';
import { BADGE_STRINGS } from '../../lib/badges/strings';
import { GLYPHS } from '../../lib/badges/glyphPaths';
import { SEAL_BEADS, SEAL_CENTER, SEAL_GLYPHS, SEAL_ORNAMENTS, SEAL_RADII, SEAL_STUDS } from '../../lib/badges/sealOrnaments';
import { tierVars } from './tierStyle';
import styles from './Seal.module.css';

export const SEAL_SIZES = { sm: 32, md: 46, lg: 88 } as const;
export type SealSize = keyof typeof SEAL_SIZES | number;

export interface SealProps {
  tier: TierKey | Tier;
  /** 'lg' (88) for profile headers, 'md' (46) for cards and lists, or px. */
  size?: SealSize;
  /** Reviewer's counted total; folded into the accessible label when given. */
  count?: number;
  /** Override the accessible label. */
  label?: string;
  className?: string;
  /** Hide from assistive tech when a neighbouring element already names the tier. */
  decorative?: boolean;
  /** Draw the un-inked slot for this tier (a level not reached yet) instead of the stamp. */
  blank?: boolean;
}

const VIEW = 68;
const C = SEAL_CENTER;
const R = SEAL_RADII;
const { BEADS_FROM, STUDS_FROM, DETAIL_MIN_PX, TEXTURE_MIN_PX } = SEAL_ORNAMENTS;

function Glyph({ ch, cx, cy, scale, className }: { ch: string; cx: number; cy: number; scale: number; className: string }) {
  const g = GLYPHS[ch];
  if (!g) return null;
  const bx = (g.x1 + g.x2) / 2;
  const by = (g.y1 + g.y2) / 2;
  return <path className={className} d={g.d} transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-bx} ${-by})`} />;
}

/**
 * Round hanko stamp. One component, every tier, including the Shoshinsha
 * empty state (a dashed, uninked circle).
 */
export default function Seal({ tier, size = 'md', count, label, className, decorative, blank = false }: SealProps) {
  const t = typeof tier === 'string' ? getTier(tier) : tier;
  const px = typeof size === 'number' ? size : SEAL_SIZES[size];
  const chars = Array.from(t.kanji);
  const empty = t.fill === null || blank;
  const rank = tierIndex(t);
  const detailed = px >= DETAIL_MIN_PX;
  const a11y =
    label ??
    (empty
      ? `${t.name} reviewer, ${BADGE_STRINGS.locked}`
      : count !== undefined
        ? BADGE_STRINGS.reviewerLabel(t.name, count)
        : BADGE_STRINGS.reviewerLabelNoCount(t.name));
  const uid = useId().replace(/:/g, '');
  const titleId = `${uid}t`;
  const ids = { depth: `${uid}d`, bevel: `${uid}b`, clip: `${uid}c`, shine: `${uid}s`, rough: `${uid}r` };
  const glyphs = (cls: string, dx = 0, dy = 0) =>
    chars.map((ch, i) => (
      <Glyph
        key={i}
        className={cls}
        ch={ch}
        cx={C + dx}
        cy={(chars.length === 1 ? C : SEAL_GLYPHS.pairCenters[i] ?? C) + dy}
        scale={chars.length === 1 ? SEAL_GLYPHS.singleScale : SEAL_GLYPHS.pairScale}
      />
    ));
  const line = t.special ? styles.lineSpecial : styles.linePlain;

  return (
    <svg
      className={[styles.seal, t.special ? styles.special : '', className].filter(Boolean).join(' ')}
      style={tierVars(t)}
      width={px}
      height={px}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-labelledby={decorative ? undefined : titleId}
      data-tier={t.key}
      focusable="false"
    >
      {!decorative && <title id={titleId}>{a11y}</title>}
      {empty ? (
        <>
          <circle className={styles.emptyPlate} cx={C} cy={C} r={R.outline} />
          <circle className={styles.empty} cx={C} cy={C} r={R.outline} />
          {detailed && <circle className={styles.emptyRing} cx={C} cy={C} r={R.ringInner} />}
          {glyphs(styles.emptyGlyph)}
        </>
      ) : (
        <>
          <defs>
            {/* Enamel depth: light from the top-left, shade toward the bottom-right. */}
            <linearGradient id={ids.depth} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="white" stopOpacity="0.26" />
              <stop offset="0.45" stopColor="white" stopOpacity="0" />
              <stop offset="1" stopColor="black" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id={ids.bevel} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="white" stopOpacity="0.45" />
              <stop offset="0.5" stopColor="white" stopOpacity="0.05" />
              <stop offset="1" stopColor="black" stopOpacity="0.35" />
            </linearGradient>
            <clipPath id={ids.clip}>
              <circle cx={C} cy={C} r={R.plate} />
            </clipPath>
            {t.special && (
              <linearGradient id={ids.shine} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="white" stopOpacity="0" />
                <stop offset="0.5" stopColor="white" stopOpacity="0.55" />
                <stop offset="1" stopColor="white" stopOpacity="0" />
              </linearGradient>
            )}
            {px >= TEXTURE_MIN_PX && (
              <filter id={ids.rough} x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={rank + 1} />
                <feDisplacementMap in="SourceGraphic" scale="0.7" />
              </filter>
            )}
          </defs>

          <g filter={px >= TEXTURE_MIN_PX ? `url(#${ids.rough})` : undefined}>
            <circle className={styles.plate} cx={C} cy={C} r={R.plate} />
          </g>
          <circle cx={C} cy={C} r={R.plate} fill={`url(#${ids.depth})`} />
          <circle className={styles.outline} cx={C} cy={C} r={R.outline} />
          {t.special && <circle className={styles.rim} cx={C} cy={C} r={R.outline} />}
          {detailed && <circle cx={C} cy={C} r={R.bevel} fill="none" stroke={`url(#${ids.bevel})`} strokeWidth={1.2} />}

          {detailed ? (
            <>
              <circle className={`${styles.frameOuter} ${line}`} cx={C} cy={C} r={R.ringOuter} />
              <circle className={`${styles.frameInner} ${line}`} cx={C} cy={C} r={R.ringInner} />
            </>
          ) : (
            <circle className={`${styles.border} ${t.special ? styles.borderSpecial : styles.borderPlain}`} cx={C} cy={C} r={R.border} />
          )}

          {detailed && rank >= BEADS_FROM && <path className={t.special ? styles.studSpecial : styles.stud} d={SEAL_BEADS} />}
          {detailed && rank >= STUDS_FROM && <path className={t.special ? styles.studSpecial : styles.stud} d={SEAL_STUDS} />}

          {/* Embossed kanji: a soft shade under the ink */}
          {detailed && glyphs(styles.glyphShade, 0.6, 0.9)}
          {glyphs(styles.glyph)}

          {t.special && (
            <g clipPath={`url(#${ids.clip})`}>
              <rect className={styles.shine} x={-40} y={-10} width={30} height={VIEW + 20} fill={`url(#${ids.shine})`} transform="skewX(-18)" />
            </g>
          )}
        </>
      )}
    </svg>
  );
}
