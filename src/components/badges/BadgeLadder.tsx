import { EARNED_TIERS, tierIndex, type Tier, type TierKey } from '../../lib/badges/tiers';
import BadgeChip from './BadgeChip';
import BadgeTooltip from './BadgeTooltip';
import styles from './BadgeLadder.module.css';

export interface BadgeLadderProps {
  /** The user's current tier. Every tier up to and including it is drawn as earned. */
  current: TierKey | Tier;
  className?: string;
}

/** Row of chips for all eight earnable tiers: earned are filled, locked are dashed outlines. */
export default function BadgeLadder({ current, className }: BadgeLadderProps) {
  const cur = tierIndex(current);
  return (
    <ul className={[styles.row, className].filter(Boolean).join(' ')}>
      {EARNED_TIERS.map((t) => (
        <li key={t.key} className={styles.item}>
          <BadgeTooltip tier={t}>
            <BadgeChip tier={t} locked={tierIndex(t) > cur} />
          </BadgeTooltip>
        </li>
      ))}
    </ul>
  );
}
