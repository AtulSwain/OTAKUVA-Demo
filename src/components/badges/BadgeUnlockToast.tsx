'use client';

import React, { useEffect } from 'react';
import { getTier, type TierKey } from '../../lib/badges/tiers';
import Seal from './Seal';
import styles from './BadgeUnlockToast.module.css';

export interface BadgeUnlockToastProps {
  tier: TierKey;
  title: string;
  body?: string;
  onClose: () => void;
  /** Auto-dismiss delay. */
  durationMs?: number;
}

/**
 * Celebration for a newly earned tier: the seal is "stamped" into place. With
 * prefers-reduced-motion the seal simply appears (no animation).
 */
export default function BadgeUnlockToast({ tier, title, body, onClose, durationMs = 7000 }: BadgeUnlockToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, durationMs);
    return () => clearTimeout(t);
  }, [onClose, durationMs]);

  return (
    <div className={styles.toast} role="status" aria-live="polite" data-tier={tier}>
      <span className={styles.stamp}>
        <Seal tier={getTier(tier)} size={56} decorative />
      </span>
      <span className={styles.text}>
        <strong className={styles.title}>{title}</strong>
        {body && <span className={styles.body}>{body}</span>}
      </span>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
