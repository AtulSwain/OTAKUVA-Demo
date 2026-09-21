import { progressToNext, type TierProgressInfo } from '../../lib/badges/tiers';
import { BADGE_STRINGS } from '../../lib/badges/strings';
import { tierVars } from './tierStyle';
import styles from './TierProgress.module.css';

export interface TierProgressProps {
  /** Counted-review total. Ignored when `progress` is supplied. */
  count?: number;
  progress?: TierProgressInfo;
  className?: string;
}

/** Progress toward the next tier, drawn in the NEXT tier's colour. */
export default function TierProgress({ count = 0, progress, className }: TierProgressProps) {
  const p = progress ?? progressToNext(count);
  const cls = [styles.wrap, className].filter(Boolean).join(' ');
  if (!p.next) {
    return (
      <div className={cls}>
        <div className={styles.text}>
          <span className={styles.label}>{BADGE_STRINGS.topTier}</span>
        </div>
        <div className={styles.track} style={tierVars(p.current)}>
          <div className={styles.bar} style={{ width: '100%' }} />
        </div>
      </div>
    );
  }
  const pct = Math.round(p.fraction * 100);
  const label = BADGE_STRINGS.nextAt(p.next.name, p.next.min);
  return (
    <div className={cls}>
      <div className={styles.text}>
        <span className={styles.label}>{label}</span>
        <span className={styles.togo}>{BADGE_STRINGS.toGo(p.remaining)}</span>
      </div>
      <div
        className={styles.track}
        style={tierVars(p.next)}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${label}, ${BADGE_STRINGS.toGo(p.remaining)}`}
      >
        <div className={styles.bar} style={{ width: `${Math.max(pct, p.fraction > 0 ? 2 : 0)}%` }} />
      </div>
    </div>
  );
}
