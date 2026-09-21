import { TIERS } from '../../lib/badges/tiers';
import { tierVars } from './tierStyle';
import styles from './SegmentedBadgeBar.module.css';

export interface SegmentedBadgeBarProps {
  /** tierKey -> member count, straight from CommunityBadgeAggregate. */
  counts: Record<string, number>;
  className?: string;
}

/**
 * One bar split by tier proportions, plus a legend (dot, name, count).
 * Shoshinsha (no badge yet) is drawn only when someone is in it.
 */
export default function SegmentedBadgeBar({ counts, className }: SegmentedBadgeBarProps) {
  const items = TIERS.map((t) => ({ tier: t, n: counts[t.key] ?? 0 })).filter((i) => i.tier.min > 0 || i.n > 0);
  const total = items.reduce((a, i) => a + i.n, 0);
  const summary = items.map((i) => `${i.tier.name} ${i.n.toLocaleString('en-US')}`).join(', ');
  return (
    <div className={[styles.wrap, className].filter(Boolean).join(' ')}>
      <div className={styles.bar} role="img" aria-label={`Members by badge: ${summary}`}>
        {total === 0 && <span className={styles.empty} />}
        {items
          .filter((i) => i.n > 0)
          .map(({ tier, n }) => (
            <span key={tier.key} className={`${styles.seg} ${tier.min === 0 ? styles.segMuted : ''}`} style={{ ...tierVars(tier), flexGrow: n }} />
          ))}
      </div>
      <ul className={styles.legend}>
        {items.map(({ tier, n }) => (
          <li key={tier.key} className={styles.legendItem} style={tierVars(tier)}>
            <span className={`${styles.dot} ${tier.min === 0 ? styles.dotMuted : ''}`} aria-hidden="true" />
            <span className={styles.name}>{tier.name}</span>
            <span className={styles.n}>{n.toLocaleString('en-US')}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
