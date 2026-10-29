'use client';

import React from 'react';
import { Users } from 'lucide-react';
import { useCommunityScore } from '../../lib/rating/useCommunityScore';
import styles from './CommunityScoreBadge.module.css';

/**
 * "12 verdicts" (owner, 2026-10-26): how many different members rated this
 * anime's episodes or reviewed it — each member once, whichever they did.
 * A plain count, nothing estimated. Shows nothing until someone has.
 * Used on ranked poster cards (the rank numeral owns the bottom-left).
 */
export function VerdictCount({ animeId, className = '' }: { animeId: string | null | undefined; className?: string }) {
  const data = useCommunityScore(animeId);
  const n = data?.verdicts ?? 0;
  if (!data || n <= 0) return null;
  const label = `${n.toLocaleString('en-US')} ${n === 1 ? 'member' : 'members'} rated episodes or reviewed this anime`;
  return (
    <span className={`${styles.wrap} ${styles.overlay} ${styles.overlayTop} ${className}`} title={label} aria-label={label}>
      <span className={styles.retention}>
        <Users size={11} aria-hidden="true" />
        <strong>{n.toLocaleString('en-US')}</strong>
        <span className={styles.provisional}>{n === 1 ? 'verdict' : 'verdicts'}</span>
      </span>
    </span>
  );
}
