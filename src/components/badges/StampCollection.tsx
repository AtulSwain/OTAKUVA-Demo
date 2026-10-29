'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { EARNED_TIERS, tierFor, type Tier } from '../../lib/badges/tiers';
import { glossFor } from '../../lib/badges/strings';
import Seal from './Seal';
import BadgeInfoSheet from './BadgeInfoSheet';
import { tierVars } from './tierStyle';
import styles from './StampCollection.module.css';

/** Same hand-pressed tilt per level as the owner's level journey. */
const TILT = [-7, 5, -4, 8, -6, 3, -8, 6];

/**
 * The stamps a member has collected (with a "Collected" tag), then the ones
 * still to come as blank "Locked" slots. Tap any to read what it means and
 * takes (2026-10-27).
 */
export default function StampCollection({ count }: { count: number }) {
  const reached = tierFor(count);
  const earned = EARNED_TIERS.filter((t) => t.min <= reached.min);
  const [info, setInfo] = useState<Tier | null>(null);

  return (
    <div className={styles.wrap}>
      <p className={styles.summary}>
        <strong>{earned.length}</strong> of {EARNED_TIERS.length} stamps collected
      </p>
      {earned.length === 0 && (
        <p className={styles.empty}>No stamps yet — the first one comes with the 10th review or rated anime.</p>
      )}
      {(
        <ul className={styles.row}>
          {earned.map((t, i) => (
            <li key={t.key} className={styles.item} style={{ ...tierVars(t), ['--tilt' as string]: `${TILT[i] ?? 0}deg`, ['--i' as string]: String(i) }}>
              <button type="button" className={styles.stampBtn} onClick={() => setInfo(t)} aria-label={`About the ${t.name} stamp`}>
                <span className={styles.stamp}>
                  <Seal tier={t} size={56} decorative />
                </span>
              </button>
              <span className={styles.name}>{t.name}</span>
              <span className={styles.gloss}>{glossFor(t.glossKey)}</span>
              <span className={styles.collected}>
                <Check size={10} strokeWidth={3.5} aria-hidden="true" /> Collected
              </span>
            </li>
          ))}
          {/* Not collected yet: blank slots, still tappable to read (2026-10-27). */}
          {EARNED_TIERS.filter((t) => t.min > reached.min).map((t) => (
            <li key={t.key} className={`${styles.item} ${styles.lockedItem}`} style={tierVars(t)}>
              <button type="button" className={styles.stampBtn} onClick={() => setInfo(t)} aria-label={`About the ${t.name} stamp (not collected)`}>
                <span className={styles.stampBlank}>
                  <Seal tier={t} size={56} blank decorative />
                </span>
              </button>
              <span className={styles.name}>{t.name}</span>
              <span className={styles.gloss}>{glossFor(t.glossKey)}</span>
              <span className={styles.lockedTag}>Locked</span>
            </li>
          ))}
        </ul>
      )}
      {info && <BadgeInfoSheet tier={info} count={count} onClose={() => setInfo(null)} />}
    </div>
  );
}
