import { EARNED_TIERS, getTier } from '../../lib/badges/tiers';
import BadgeChip from './BadgeChip';
import { tierVars } from './tierStyle';
import styles from './BadgeDistribution.module.css';

export interface BadgeDistributionProps {
  /** tierKey -> count, straight from AnimeBadgeAggregate. */
  counts: Record<string, number>;
  /** Noun for the accessible label, e.g. "reviews". */
  unit?: string;
  className?: string;
}

const MIN_BAR_PCT = 2; // any non-zero count stays visible

/** One row per tier, Kōhai to Densetsu: chip, bar scaled to the largest count, count. */
export default function BadgeDistribution({ counts, unit = 'reviews', className }: BadgeDistributionProps) {
  const rows = EARNED_TIERS.map((t) => ({ tier: t, n: counts[t.key] ?? 0 }));
  const max = Math.max(1, ...rows.map((r) => r.n));
  const newer = counts.shoshinsha ?? 0;
  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <ul className={styles.list}>
        {rows.map(({ tier, n }) => (
          <li key={tier.key} className={styles.row} aria-label={`${tier.name}: ${n.toLocaleString('en-US')} ${unit}`}>
            <span className={styles.label}>
              <BadgeChip tier={tier} />
            </span>
            <span className={styles.track} style={tierVars(tier)} aria-hidden="true">
              {n > 0 && <span className={styles.bar} style={{ width: `${Math.max(MIN_BAR_PCT, (n / max) * 100)}%` }} />}
            </span>
            <span className={styles.count}>{n.toLocaleString('en-US')}</span>
          </li>
        ))}
      </ul>
      {newer > 0 && (
        <p className={styles.note}>{`${newer.toLocaleString('en-US')} ${unit} by ${getTier('shoshinsha').name} reviewers`}</p>
      )}
    </div>
  );
}
