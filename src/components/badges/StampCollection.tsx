import { EARNED_TIERS, tierFor } from '../../lib/badges/tiers';
import { glossFor } from '../../lib/badges/strings';
import Seal from './Seal';
import BadgeTooltip from './BadgeTooltip';
import { tierVars } from './tierStyle';
import styles from './StampCollection.module.css';

/** Same hand-pressed tilt per level as the owner's level journey. */
const TILT = [-7, 5, -4, 8, -6, 3, -8, 6];

/**
 * The stamps a member has collected — only the ones earned, for other people
 * to see. (Progress toward the next one is the owner's business, on their own
 * profile's level journey.)
 */
export default function StampCollection({ count }: { count: number }) {
  const reached = tierFor(count);
  const earned = EARNED_TIERS.filter((t) => t.min <= reached.min);

  return (
    <div className={styles.wrap}>
      <p className={styles.summary}>
        <strong>{earned.length}</strong> of {EARNED_TIERS.length} stamps collected
      </p>
      {earned.length === 0 ? (
        <p className={styles.empty}>No stamps yet — the first one comes with the 10th review.</p>
      ) : (
        <ul className={styles.row}>
          {earned.map((t, i) => (
            <li key={t.key} className={styles.item} style={{ ...tierVars(t), ['--tilt' as string]: `${TILT[i] ?? 0}deg`, ['--i' as string]: String(i) }}>
              <BadgeTooltip tier={t}>
                <span className={styles.stamp}>
                  <Seal tier={t} size={56} label={`${t.name} stamp`} />
                </span>
              </BadgeTooltip>
              <span className={styles.name}>{t.name}</span>
              <span className={styles.gloss}>{glossFor(t.glossKey)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
