'use client';

import React from 'react';
import { useCommunityScore } from '../../lib/rating/useCommunityScore';
import { retentionBadgeFor, retentionBadgeInfo } from '../../lib/rating/retentionScore';
import styles from './CommunityScoreBadge.module.css';

/**
 * The score every anime card / poster / row shows: the anime's community
 * retention — the mean of its rated episodes' scores — with its badge once
 * there's enough data, else its band name greyed with "· early" (provisional)
 * (2026-10-25, owner; replaced the
 * 1–10 OTAKUVA score star). Same numbers as the anime page. Renders nothing
 * until a member has rated an episode, and updates as soon as someone does.
 *
 * `overlay`: a dark glass chip for a poster corner. `inline`: for a meta row.
 */
export function CommunityScoreBadge({
  animeId,
  variant = 'inline',
  position = 'bottom',
  className = '',
}: {
  animeId: string | null | undefined;
  variant?: 'overlay' | 'inline';
  /** Overlay corner. Use 'top' on cards with a rank numeral at the bottom (owner, 2026-10-26). */
  position?: 'bottom' | 'top';
  className?: string;
}) {
  const data = useCommunityScore(animeId);
  if (!data || data.retention === null || data.retentionStatus === 'unrated') return null;

  const badge = data.retentionStatus === 'rated' && data.retentionBadge ? retentionBadgeInfo(data.retentionBadge) : null;
  const ratings = `${data.retentionRatings} ${data.retentionRatings === 1 ? 'rating' : 'ratings'} on ${data.ratedEpisodes} ${data.ratedEpisodes === 1 ? 'episode' : 'episodes'}`;
  const label = badge ? `Retention ${data.retention}% — ${badge.label} (${ratings})` : `Retention ${data.retention}% — provisional (${ratings})`;

  return (
    <span
      className={`${styles.wrap} ${variant === 'overlay' ? styles.overlay : styles.inline} ${variant === 'overlay' && position === 'top' ? styles.overlayTop : ''} ${className}`}
      title={label}
      aria-label={label}
    >
      <span className={styles.retention}>
        <strong>{data.retention}%</strong>
        {badge ? (
          <span className={styles.badge} style={{ color: badge.color }}>
            {badge.label}
          </span>
        ) : (
          <span className={styles.provisional}>
            {retentionBadgeFor(data.retention).label}
            {variant === 'overlay' ? '' : ' · early'}
          </span>
        )}
      </span>
    </span>
  );
}
