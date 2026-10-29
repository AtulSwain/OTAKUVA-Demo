import React from 'react';
import { retentionBadgeFor, retentionBadgeInfo, type RetentionBadgeKey, type RetentionStatus } from '../../lib/rating/retentionScore';
import styles from './RetentionBadge.module.css';

/**
 * The anime's retention badge — one look everywhere (2026-10-25). A
 * definitive badge only when the anime has enough ratings (`status` 'rated').
 * Before that it stays grey and says so: with a `value` it names the band
 * plus "early" ("Peaking · early" — owner, 2026-10-25: every retention %
 * carries its name); without one, "Provisional". Nothing rated: "Not rated".
 */
export function RetentionBadge({
  status,
  badge,
  size = 'sm',
  className = '',
  value = null,
}: {
  /** The score, so a provisional badge can still name its band. */
  value?: number | null;
  status: RetentionStatus;
  badge: RetentionBadgeKey | null;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const sizeClass = size === 'md' ? styles.md : size === 'xs' ? styles.xs : '';
  if (status === 'rated' && badge) {
    const info = retentionBadgeInfo(badge);
    return (
      <span
        className={`${styles.badge} ${sizeClass} ${className}`}
        style={{ color: info.color, background: info.soft, borderColor: `${info.color}33` }}
        title={`${info.label} — retention badge`}
      >
        {info.label}
      </span>
    );
  }
  return (
    <span
      className={`${styles.badge} ${styles.muted} ${sizeClass} ${className}`}
      title={status === 'provisional' ? 'Provisional — not enough ratings yet for a badge' : 'No episode ratings yet'}
    >
      {status === 'provisional' ? (value !== null ? `${retentionBadgeFor(value).label} · early` : 'Provisional') : 'Not rated'}
    </span>
  );
}
