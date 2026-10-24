import React from 'react';
import type { HypeLevel } from '../../lib/hype/hypeLevels';
import styles from './HypeFx.module.css';

/**
 * A small animated background for one Hype level, drawn inside its button:
 * Hyped = heat + embers rising, Not interested = a quiet drifting haze
 * (Excited / Curious retired 2026-10-22). Decorative only
 * (aria-hidden), pure CSS, and still under prefers-reduced-motion.
 * The parent button needs `position: relative; overflow: hidden`.
 */
export function HypeFx({ level, active }: { level: HypeLevel; active: boolean }) {
  return (
    <span className={`${styles.fx} ${styles[level]} ${active ? styles.on : ''}`} aria-hidden="true">
      {level === 'HYPED' && (
        <>
          <span className={styles.heat} />
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={styles.ember} />
          ))}
        </>
      )}
      {level === 'SKIP' && <span className={styles.haze} />}
    </span>
  );
}
