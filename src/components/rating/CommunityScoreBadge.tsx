'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { useCommunityScore } from '../../lib/rating/useCommunityScore';
import { retentionColor, retentionSoftColor } from '../../lib/rating/retentionTone';
import styles from './CommunityScoreBadge.module.css';

/**
 * Members' OTAKUVA score (star) and community retention (coloured %) for one
 * anime — the score every card and poster shows (2026-10-21, owner; replaced
 * the provider score on cards). Renders nothing until a member has rated or
 * set retention, and updates as soon as someone does.
 *
 * `overlay`: glass chips for the corner of a poster. `inline`: text for a
 * card's meta row.
 */
export function CommunityScoreBadge({
  animeId,
  variant = 'inline',
  className = '',
}: {
  animeId: string | null | undefined;
  variant?: 'overlay' | 'inline';
  className?: string;
}) {
  const data = useCommunityScore(animeId);
  if (!data) return null;
  const hasScore = data.score !== null && data.ratingCount > 0;
  const hasRetention = data.retention !== null;
  if (!hasScore && !hasRetention) return null;

  return (
    <span className={`${styles.wrap} ${variant === 'overlay' ? styles.overlay : styles.inline} ${className}`}>
      {hasScore && (
        <span
          className={styles.score}
          title={`OTAKUVA score · ${data.ratingCount} ${data.ratingCount === 1 ? 'member rating' : 'member ratings'}`}
          aria-label={`OTAKUVA score ${data.score!.toFixed(1)} from ${data.ratingCount} ${data.ratingCount === 1 ? 'rating' : 'ratings'}`}
        >
          <Star size={variant === 'overlay' ? 11 : 11} fill="currentColor" aria-hidden="true" />
          {data.score!.toFixed(1)}
        </span>
      )}
      {hasRetention && (
        <span
          className={styles.retention}
          style={{ color: retentionColor(data.retention!), background: variant === 'overlay' ? undefined : retentionSoftColor(data.retention!) }}
          title={`Retention · ${data.retentionMembers} ${data.retentionMembers === 1 ? 'member' : 'members'}`}
          aria-label={`Retention ${data.retention}%`}
        >
          <i style={{ background: retentionColor(data.retention!) }} aria-hidden="true" />
          {data.retention}%
        </span>
      )}
    </span>
  );
}
