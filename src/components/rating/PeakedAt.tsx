'use client';

import React from 'react';
import { useCommunityScore } from '../../lib/rating/useCommunityScore';
import { retentionColor } from '../../lib/rating/retentionTone';
import styles from './PeakedAt.module.css';

/**
 * "Peaked at 93%" — the anime's community retention, beside an anime in a
 * review list (owner, 2026-10-25: replaced the reviewer's 1–10 star score
 * there; just the percent, no band name). Same number as the anime page and
 * cards. Shows nothing until a member has rated an episode.
 */
export function PeakedAt({ animeId, className = '' }: { animeId: string | null | undefined; className?: string }) {
  const data = useCommunityScore(animeId);
  if (!data || data.retention === null) return null;
  return (
    <span className={`${styles.peak} ${className}`} title="Community retention for this anime">
      Peaked at <strong style={{ color: retentionColor(data.retention) }}>{data.retention}%</strong>
    </span>
  );
}
