'use client';

import React from 'react';
import {
  getRatingTier,
  getScoreColor,
  getScoreGradient,
  getScoreSoftColor,
  RATING_TIERS,
  NO_SCORE_LABEL,
} from '../../lib/rating/ratingTiers';
import styles from './RatingDistributionCard.module.css';

interface RatingDistributionCardProps {
  score?: number | null;
  ratingCount?: number | null;
  reviewCount?: number | null;
  /** Real 1-10 bucket distribution from the rating summary API. */
  distribution?: Record<number, { count: number; percentage: number }> | null;
  onOpenRateModal?: () => void;
}

/**
 * This card previously shipped a hardcoded 72/18/6/2/2 five-star split and
 * defaulted to a score of 9.2 with 48,291 ratings for every anime on the site
 * — invented numbers presented as community data. It now renders only the
 * real distribution returned by the rating summary, and an honest empty state
 * when there is none.
 */
export const RatingDistributionCard: React.FC<RatingDistributionCardProps> = ({
  score = null,
  ratingCount = null,
  reviewCount = null,
  distribution = null,
  onOpenRateModal,
}) => {
  const hasScore = typeof score === 'number' && !Number.isNaN(score);
  const tier = getRatingTier(hasScore ? score : null);
  const tierColor = getScoreColor(hasScore ? score : null);
  const total = typeof ratingCount === 'number' ? ratingCount : 0;

  // Collapse the engine's 10 integer buckets into the five OTAKUVA tiers, so
  // the breakdown speaks the same language as the score above it.
  const tierBuckets = RATING_TIERS.map((t) => {
    let count = 0;
    if (distribution) {
      for (let bucket = 1; bucket <= 10; bucket++) {
        if (bucket >= t.min && bucket <= t.max) {
          count += distribution[bucket]?.count ?? 0;
        }
      }
    }
    return { tier: t, count };
  }).reverse(); // Great first, Worst last.

  const bucketTotal = tierBuckets.reduce((acc, b) => acc + b.count, 0);
  const hasDistribution = bucketTotal > 0;

  return (
    <section className={styles.section} aria-label="Community Rating Breakdown">
      <div className={styles.sectionHead}>
        <h2 className={styles.title}>Community Rating</h2>
        <span className={styles.subtitle}>
          {total > 0 ? `${total.toLocaleString()} rating${total === 1 ? '' : 's'}` : 'No ratings yet'}
        </span>
      </div>

      <div className={styles.scoreReviewGrid}>
        {/* Score + tier */}
        <div
          className={styles.scoreCard}
          style={
            hasScore
              ? {
                  background: getScoreSoftColor(score, 0.08),
                  borderColor: getScoreSoftColor(score, 0.3),
                }
              : undefined
          }
        >
          <span className={styles.bigScore} style={{ color: hasScore ? tierColor : undefined }}>
            {hasScore ? Number(score).toFixed(1) : '—'}
          </span>
          <span
            className={styles.tierLabel}
            style={
              hasScore
                ? { color: tierColor, background: getScoreSoftColor(score, 0.14) }
                : undefined
            }
          >
            {tier ? tier.label : NO_SCORE_LABEL}
          </span>
          {tier && <span className={styles.tierDesc}>{tier.description}</span>}
          <span className={styles.reviewCountLabel}>
            {typeof reviewCount === 'number' && reviewCount > 0
              ? `${reviewCount.toLocaleString()} written review${reviewCount === 1 ? '' : 's'}`
              : 'No written reviews yet'}
          </span>
          {onOpenRateModal && (
            <button type="button" className={styles.rateActionBtn} onClick={onOpenRateModal}>
              ★ Rate Anime
            </button>
          )}
        </div>

        {/* Real tier distribution */}
        <div className={styles.distributionCard}>
          {hasDistribution ? (
            tierBuckets.map(({ tier: t, count }) => {
              const pct = (count / bucketTotal) * 100;
              const midpoint = (t.min + Math.min(10, t.max)) / 2;
              return (
                <div key={t.id} className={styles.distributionRow}>
                  <span className={styles.starLabel} style={{ color: t.color }}>
                    {t.label}
                  </span>
                  <div
                    className={styles.distTrack}
                    style={{ background: getScoreSoftColor(midpoint, 0.1) }}
                  >
                    <span
                      className={styles.distFill}
                      style={{ width: `${pct}%`, background: getScoreGradient(midpoint) }}
                    />
                  </div>
                  <span className={styles.percentLabel}>{Math.round(pct)}%</span>
                </div>
              );
            })
          ) : (
            <p className={styles.distEmpty}>
              No rating distribution yet. Once the community starts rating this
              anime, the breakdown across all five tiers appears here.
            </p>
          )}
        </div>
      </div>
    </section>
  );
};
