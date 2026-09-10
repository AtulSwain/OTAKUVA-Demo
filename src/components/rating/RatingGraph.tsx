'use client';

import React, { useState } from 'react';
import { Sparkles, Info, HelpCircle, BarChart2 } from 'lucide-react';
import { CategorySummaryItem, RatingConfidenceTier, CATEGORY_EXPLANATION_TEXT } from '../../lib/rating/ratingEngine';
import {
  getRatingTier,
  getScoreColor,
  getScoreGradient,
  getScoreSoftColor,
  scoreToPercent,
} from '../../lib/rating/ratingTiers';
import styles from './RatingGraph.module.css';

interface RatingGraphProps {
  categories?: CategorySummaryItem[];
  confidence?: RatingConfidenceTier;
  ratingCount?: number;
  isLoading?: boolean;
  isError?: boolean;
  onOpenDetailedRate?: () => void;
}

export const RatingGraph: React.FC<RatingGraphProps> = ({
  categories = [],
  confidence = 'NO_DATA',
  ratingCount = 0,
  isLoading = false,
  isError = false,
  onOpenDetailedRate,
}) => {
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className={styles.container} aria-busy="true" aria-label="Loading category rating graph">
        <div className={styles.headerSkeleton} />
        <div className={styles.barsSkeleton}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.barSkeletonRow} />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <BarChart2 size={24} className={styles.errorIcon} />
          <p className={styles.errorText}>Unable to load community category statistics.</p>
        </div>
      </div>
    );
  }

  const hasData = categories && categories.length > 0;
  const isEarlyData = confidence === 'EARLY' || (hasData && categories[0].responseCount < 25);

  // Generate screen reader analytical text summary
  let screenReaderSummary = 'No category ratings have been submitted yet for this anime.';
  if (hasData) {
    const sorted = [...categories].sort((a, b) => b.averageScore - a.averageScore);
    const top = sorted[0];
    const lowest = sorted[sorted.length - 1];
    screenReaderSummary = `The highest-rated category is ${top.label} with an average score of ${top.averageScore.toFixed(
      1
    )} out of 10 and a normalized community share of ${top.percentage} percent. The lowest-rated category is ${
      lowest.label
    } with an average score of ${lowest.averageScore.toFixed(1)} out of 10 and a normalized community share of ${
      lowest.percentage
    } percent.`;
  }

  return (
    <section className={styles.container} aria-label="Community Category Breakdown">
      {/* Hidden Text Alternative for Assistive Tech */}
      <div className={styles.srOnly} role="status">
        {screenReaderSummary}
      </div>

      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.badgeRow}>
            <span className={styles.sectionBadge}>
              <BarChart2 size={12} />
              <span>CATEGORY BREAKDOWN</span>
            </span>
            {hasData && (
              <span
                className={`${styles.confidencePill} ${
                  confidence === 'HIGH' ? styles.confidenceHigh : styles.confidenceEarly
                }`}
              >
                {confidence === 'HIGH' ? 'HIGH CONFIDENCE' : isEarlyData ? 'EARLY CATEGORY DATA' : 'COMMUNITY DATA'}
              </span>
            )}
          </div>
          <h3 className={styles.title}>How the Community Rates This Anime</h3>
          <p className={styles.subtitle}>
            Analytical breakdown of community scores across storytelling, characters, visuals, audio, and enjoyment.
          </p>
        </div>

        {onOpenDetailedRate && (
          <button type="button" className={styles.rateDetailBtn} onClick={onOpenDetailedRate}>
            <span>Rate Categories</span>
          </button>
        )}
      </div>

      {!hasData ? (
        <div className={styles.noDataCard}>
          <Sparkles size={20} className={styles.noDataIcon} />
          <h4 className={styles.noDataTitle}>No Detailed Category Ratings Yet</h4>
          <p className={styles.noDataText}>
            Be the first to submit detailed category ratings for Story, Characters, Animation, Direction, Music, and Enjoyment!
          </p>
          {onOpenDetailedRate && (
            <button type="button" className={styles.primaryRateAction} onClick={onOpenDetailedRate}>
              + Submit Category Ratings
            </button>
          )}
        </div>
      ) : (
        <div className={styles.graphBody}>
          <div className={styles.barsList} role="list">
            {categories.map((item) => {
              const isSelected = activeTooltip === item.category;
              const barWidthPercent = Math.max(8, scoreToPercent(item.averageScore));
              // Each bar is coloured by its own score, so the graph as a whole
              // reads red-to-green rather than a uniform grey ramp.
              const barTier = getRatingTier(item.averageScore);

              return (
                <div
                  key={item.category}
                  className={`${styles.barRow} ${isSelected ? styles.barRowActive : ''}`}
                  role="listitem"
                  onClick={() => setActiveTooltip(isSelected ? null : item.category)}
                  onMouseEnter={() => setActiveTooltip(item.category)}
                  onMouseLeave={() => setActiveTooltip(null)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveTooltip(isSelected ? null : item.category);
                    }
                  }}
                  aria-label={`${item.label}: score ${item.averageScore.toFixed(1)} out of 10, rated ${
                    barTier?.label ?? 'unrated'
                  }, share ${item.percentage} percent, based on ${item.responseCount} responses`}
                >
                  <div className={styles.labelCol}>
                    <span className={styles.categoryName}>{item.label}</span>
                    <span className={styles.categoryScore} style={{ color: getScoreColor(item.averageScore) }}>
                      {item.averageScore.toFixed(1)} <small>/ 10</small>
                      {barTier && (
                        <small
                          className={styles.categoryTier}
                          style={{
                            color: getScoreColor(item.averageScore),
                            background: getScoreSoftColor(item.averageScore, 0.14),
                          }}
                        >
                          {barTier.label}
                        </small>
                      )}
                    </span>
                  </div>

                  <div className={styles.meterCol}>
                    <div
                      className={styles.meterTrack}
                      style={{ background: getScoreSoftColor(item.averageScore, 0.1) }}
                    >
                      <div
                        className={styles.meterFill}
                        style={{
                          width: `${barWidthPercent}%`,
                          background: getScoreGradient(item.averageScore),
                        }}
                      />
                    </div>
                  </div>

                  <div className={styles.percentageCol}>
                    <span className={styles.percentageBadge}>{item.percentage}%</span>
                  </div>

                  {/* Accessible Hover / Tap Tooltip */}
                  {isSelected && (
                    <div className={styles.tooltipPopover} role="tooltip">
                      <div className={styles.tooltipTitle}>{item.label} Analysis</div>
                      <div className={styles.tooltipRow}>
                        <span>Average Score:</span>
                        <strong style={{ color: getScoreColor(item.averageScore) }}>
                          {item.averageScore.toFixed(1)} / 10 · {barTier?.label}
                        </strong>
                      </div>
                      <div className={styles.tooltipRow}>
                        <span>Community Share:</span>
                        <strong>{item.percentage}%</strong>
                      </div>
                      <div className={styles.tooltipRow}>
                        <span>Detailed Ratings:</span>
                        <strong>{item.responseCount.toLocaleString()}</strong>
                      </div>
                      <div className={styles.tooltipRow}>
                        <span>Confidence:</span>
                        <strong>{item.confidence}</strong>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Explanatory Footnote Note (Section 8) */}
          <div className={styles.footnoteRow}>
            <Info size={13} className={styles.footnoteIcon} />
            <p className={styles.footnoteText}>{CATEGORY_EXPLANATION_TEXT}</p>
          </div>
        </div>
      )}
    </section>
  );
};
