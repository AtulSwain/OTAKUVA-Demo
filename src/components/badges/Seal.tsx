import { useId } from 'react';
import { getTier, type Tier, type TierKey } from '../../lib/badges/tiers';
import { BADGE_STRINGS } from '../../lib/badges/strings';
import { GLYPHS } from '../../lib/badges/glyphPaths';
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
}

const VIEW = 68;
const CENTER = VIEW / 2;
const PAIR_SCALE = 0.024; // 24-unit em => ~22-unit ink height per glyph
const SINGLE_SCALE = 0.044;
const PAIR_CENTERS = [21, 47];

function Glyph({ ch, cx, cy, scale, className }: { ch: string; cx: number; cy: number; scale: number; className: string }) {
  const g = GLYPHS[ch];
  if (!g) return null;
  const bx = (g.x1 + g.x2) / 2;
  const by = (g.y1 + g.y2) / 2;
  return <path className={className} d={g.d} transform={`translate(${cx} ${cy}) scale(${scale}) translate(${-bx} ${-by})`} />;
}

/** Hanko-style seal. One component, every tier, including the Shoshinsha empty state. */
export default function Seal({ tier, size = 'md', count, label, className, decorative }: SealProps) {
  const t = typeof tier === 'string' ? getTier(tier) : tier;
  const px = typeof size === 'number' ? size : SEAL_SIZES[size];
  const chars = Array.from(t.kanji);
  const empty = t.fill === null;
  const a11y =
    label ??
    (empty
      ? `${t.name} reviewer, ${BADGE_STRINGS.locked}`
      : count !== undefined
        ? BADGE_STRINGS.reviewerLabel(t.name, count)
        : BADGE_STRINGS.reviewerLabelNoCount(t.name));
  const titleId = useId();

  return (
    <svg
      className={[styles.seal, className].filter(Boolean).join(' ')}
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
          <rect className={styles.empty} x={1} y={1} width={66} height={66} rx={6} />
          <Glyph className={styles.emptyGlyph} ch={chars[0]} cx={CENTER} cy={CENTER} scale={SINGLE_SCALE} />
        </>
      ) : (
        <>
          <rect className={styles.plate} width={VIEW} height={VIEW} rx={6} />
          <rect className={styles.outline} x={0.7} y={0.7} width={VIEW - 1.4} height={VIEW - 1.4} rx={5.5} />
          {t.special && <rect className={styles.rim} x={0.8} y={0.8} width={VIEW - 1.6} height={VIEW - 1.6} rx={5.4} />}
          <rect
            className={`${styles.border} ${t.special ? styles.borderSpecial : styles.borderPlain}`}
            x={5}
            y={5}
            width={58}
            height={58}
            rx={3}
          />
          {chars.map((ch, i) => (
            <Glyph key={i} className={styles.glyph} ch={ch} cx={CENTER} cy={PAIR_CENTERS[i] ?? CENTER} scale={PAIR_SCALE} />
          ))}
        </>
      )}
    </svg>
  );
}
