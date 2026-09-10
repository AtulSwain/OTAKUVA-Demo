'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Anime } from '../../types/anime';
import { CategorySummaryItem } from '../../lib/rating/ratingEngine';
import {
  getRatingTier,
  getScoreColor,
  getScoreSoftColor,
  NO_SCORE_LABEL,
  scoreToPercent,
} from '../../lib/rating/ratingTiers';
import styles from './AnimeScoreCard.module.css';

interface AnimeScoreCardProps {
  anime: Anime;
  /**
   * Real per-category community averages from the rating summary. Aspects
   * used to be synthesised here by multiplying the overall score by made-up
   * factors (0.99, 1.02, 1.04 …), which produced convincing-looking numbers
   * nobody had ever submitted. Only real aspects are rendered now.
   */
  categories?: CategorySummaryItem[];
  onOpenDetails?: () => void;
}

export const AnimeScoreCard: React.FC<AnimeScoreCardProps> = ({
  anime,
  categories = [],
  onOpenDetails,
}) => {
  const hasScore = typeof anime.score === 'number' && !Number.isNaN(anime.score);
  const baseScore = hasScore ? (anime.score as number) : null;
  const tier = getRatingTier(baseScore);
  const tierColor = getScoreColor(baseScore);
  const ratingCount = typeof anime.ratingCount === 'number' ? anime.ratingCount : 0;

  const aspects = (categories || []).filter(
    (c) => c && typeof c.averageScore === 'number' && c.responseCount > 0
  );

  // SVG Gauge calculations
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (scoreToPercent(baseScore) / 100) * circumference;

  return (
    <div className={styles.card} role="region" aria-label="OTAKUVA Score Breakdown">
      <div className={styles.headerRow}>
        <h3 className={styles.headerTitle}>OTAKUVA Score</h3>
        {onOpenDetails && (
          <button type="button" className={styles.detailsBtn} onClick={onOpenDetails}>
            <span>Details</span>
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      <div className={styles.scoreBody}>
        {/* Circular Gauge — stroke colour tracks the tier */}
        <div className={styles.gaugeWrapper}>
          <svg className={styles.gaugeSvg} viewBox="0 0 90 90">
            <circle className={styles.gaugeBg} cx="45" cy="45" r={radius} />
            <circle
              className={styles.gaugeFill}
              cx="45"
              cy="45"
              r={radius}
              stroke={tierColor}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>
          <div className={styles.gaugeCenter}>
            <span className={styles.gaugeScore} style={{ color: hasScore ? tierColor : undefined }}>
              {hasScore ? (baseScore as number).toFixed(1) : '—'}
            </span>
            <span
              className={styles.gaugeRatingLabel}
              style={{ color: hasScore ? tierColor : undefined }}
            >
              {tier ? tier.label : NO_SCORE_LABEL}
            </span>
          </div>
        </div>

        {/* Aspect Breakdown — real community categories only */}
        <div className={styles.aspectsList}>
          {aspects.length > 0 ? (
            aspects.map((asp) => (
              <div key={asp.category} className={styles.aspectRow}>
                <span>{asp.label}</span>
                <span
                  className={styles.aspectScore}
                  style={{
                    color: getScoreColor(asp.averageScore),
                    background: getScoreSoftColor(asp.averageScore, 0.12),
                  }}
                >
                  {asp.averageScore.toFixed(1)}
                </span>
              </div>
            ))
          ) : (
            <p className={styles.aspectsEmpty}>
              No aspect ratings submitted yet.
            </p>
          )}
        </div>
      </div>

      <div className={styles.divider} />

      <div className={styles.footerMetrics}>
        <div>
          <span>Community Score</span>
          <span className={styles.communityScoreVal}>
            {hasScore ? (baseScore as number).toFixed(2) : 'Unrated'}
          </span>
        </div>
        <div>
          <span>
            {ratingCount > 0
              ? `${ratingCount.toLocaleString()} rating${ratingCount === 1 ? '' : 's'}`
              : 'No ratings'}
          </span>
        </div>
      </div>
    </div>
  );
};
