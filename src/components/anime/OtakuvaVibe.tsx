'use client';

import React from 'react';
import { Sparkles, Star } from 'lucide-react';
import { CategorySummaryItem, RatingConfidenceTier } from '../../lib/rating/ratingEngine';
import {
  getRatingTier,
  getScoreColor,
  getScoreSoftColor,
  RATING_TIERS,
  NO_SCORE_LABEL,
  scoreToPercent,
} from '../../lib/rating/ratingTiers';
import styles from './OtakuvaVibe.module.css';

// The chart keeps its original identity palette: each dimension owns a fixed
// colour so a slice is recognisable as "Story" or "Music" at a glance and the
// donut reads as one designed object rather than a heat map.
//
// The tier system supplies the *badges* instead — the Worst/Average/Decent/
// Good/Great chips and the score in the donut centre — so quality still reads
// from the shared five-tier ladder without repainting the chart.
const CATEGORY_COLORS: Record<string, string> = {
  STORY: '#6366F1',
  CHARACTERS: '#818CF8',
  ANIMATION: '#A5B4FC',
  MUSIC: '#38BDF8',
  PACING: '#34D399',
  WORLD_BUILDING: '#F472B6',
  ENJOYMENT: '#FBBF24',
  DIRECTION: '#A1A1AA',
};

interface OtakuvaVibeProps {
  animeTitle?: string;
  categoryAggregates?: CategorySummaryItem[];
  ratingCount?: number | null;
  confidence?: RatingConfidenceTier;
  onOpenRateModal?: () => void;
  // Backward compatibility
  genres?: string[];
  /** Average of OTAKUVA members' ratings — the same number the hero shows. */
  score?: number | null;
}

export const OtakuvaVibe: React.FC<OtakuvaVibeProps> = ({
  animeTitle,
  categoryAggregates = [],
  ratingCount = 0,
  confidence = 'NO_DATA',
  onOpenRateModal,
  score = null,
}) => {
  // Only display categories with real community responses
  const activeCategories = (categoryAggregates || []).filter(
    (c) => c && typeof c.averageScore === 'number' && c.responseCount > 0
  );

  const totalAspectRatings = activeCategories.reduce((acc, c) => acc + c.responseCount, 0);
  const hasVibeData = activeCategories.length > 0 && totalAspectRatings > 0;

  // Render honest empty state when there are no aspect ratings
  if (!hasVibeData) {
    return (
      <section className={styles.section} aria-label="OTAKUVA Vibe & Perception">
        <div className={styles.sectionHead}>
          <h2 className={styles.title}>OTAKUVA Vibe</h2>
          <span className={styles.subtitle}>Based on structured community signals</span>
        </div>

        <div className={styles.vibeGrid}>
          <div className={styles.emptyVibeCard}>
            <div className={styles.emptyIconWrapper}>
              <Sparkles size={20} />
            </div>
            <h3 className={styles.emptyVibeTitle}>Awaiting Community Aspect Signals</h3>
            <p className={styles.emptyVibeDesc}>
              OTAKUVA Vibe measures the true character of an anime across Story, Characters, Animation, Music, Pacing, and World Building. Community members establish this profile by rating individual dimensions.
            </p>
            <div className={styles.emptyVibeActions}>
              {onOpenRateModal && (
                <button type="button" className={styles.emptyRateBtn} onClick={onOpenRateModal}>
                  <Star size={13} fill="currentColor" />
                  <span>Rate Aspects</span>
                </button>
              )}
              <span className={styles.emptyMetaChip}>0 aspect ratings recorded</span>
              <span className={styles.emptyMetaChip}>Confidence: NO DATA</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Calculate highest-rated primary aspect
  const sortedByScore = [...activeCategories].sort((a, b) => b.averageScore - a.averageScore);
  const primaryAspect = sortedByScore[0];
  const secondaryAspect = sortedByScore.length > 1 ? sortedByScore[1] : null;

  // The number in the middle of the circle: the actual community score
  // (recalculated from every real AnimeRating row whenever anyone rates or
  // re-rates — see recalculateAnimeAggregates), not the top single aspect,
  // so the circle's color reflects "how people have rated this anime"
  // overall rather than just its single best-scoring dimension.
  const overallScore = typeof score === 'number' ? score : primaryAspect.averageScore;
  const overallTier = getRatingTier(overallScore);
  // The headline is the plain average of members' ratings (the page passes
  // RatingSummary.rawAverage), so with only a few ratings it is simply an
  // early read — say so rather than present it as settled.
  const isProvisional = (ratingCount || 0) > 0 && (ratingCount || 0) < 10;
  const overallColor = getScoreColor(overallScore);
  const overallLabel = overallTier ? overallTier.label : NO_SCORE_LABEL;

  // Conic gradient calculation from real normalized percentage shares
  let accumulatedPct = 0;
  const gradientStops = activeCategories.map((item) => {
    const start = accumulatedPct;
    const end = Math.min(100, accumulatedPct + item.percentage);
    accumulatedPct = end;
    const color = CATEGORY_COLORS[item.category] || '#6366F1';
    return `${color} ${start}% ${end}%`;
  });
  if (accumulatedPct < 100) {
    gradientStops.push(`#27272A ${accumulatedPct}% 100%`);
  }
  const donutBackground = `conic-gradient(${gradientStops.join(', ')})`;

  // Dynamic qualitative synthesis from real top dimensions
  // Describe the aspects with the same five words used everywhere else, and
  // name the weakest dimension too — a graph that only ever reports strengths
  // is not an honest read of a low-rated show.
  const weakestAspect = sortedByScore[sortedByScore.length - 1];
  const primaryTierLabel = (getRatingTier(primaryAspect.averageScore)?.label ?? NO_SCORE_LABEL).toLowerCase();
  const dynamicSummary =
    weakestAspect && weakestAspect.category !== primaryAspect.category
      ? `Rated ${overallLabel.toLowerCase()} overall. Its strongest dimension is ${primaryAspect.label} (★ ${primaryAspect.averageScore.toFixed(
          1
        )}, ${primaryTierLabel}) and its weakest is ${weakestAspect.label} (★ ${weakestAspect.averageScore.toFixed(
          1
        )}, ${(getRatingTier(weakestAspect.averageScore)?.label ?? NO_SCORE_LABEL).toLowerCase()}).`
      : `Rated ${overallLabel.toLowerCase()} overall, led by ${primaryAspect.label} (★ ${primaryAspect.averageScore.toFixed(
          1
        )}, ${primaryTierLabel}).`;

  const badgeClass =
    confidence === 'HIGH'
      ? styles.badgeHigh
      : confidence === 'MEDIUM'
      ? styles.badgeMedium
      : confidence === 'LOW'
      ? styles.badgeLow
      : styles.badgeEarly;

  return (
    <section className={styles.section} aria-label="OTAKUVA Vibe & Perception">
      <div className={styles.sectionHead}>
        <h2 className={styles.title}>OTAKUVA Vibe</h2>
        <span className={styles.subtitle}>
          Based on {totalAspectRatings.toLocaleString()} structured aspect signals
        </span>
      </div>

      {/* The five-tier scale, so the colours in the graph below are readable
          without guessing what green or amber is supposed to mean. */}
      <div className={styles.tierScale} role="list" aria-label="OTAKUVA rating scale">
        {RATING_TIERS.map((tier) => {
          const isActive = overallTier?.id === tier.id;
          return (
            <span
              key={tier.id}
              role="listitem"
              className={`${styles.tierChip} ${isActive ? styles.tierChipActive : ''}`}
              style={{
                color: isActive ? tier.color : undefined,
                borderColor: isActive ? tier.color : undefined,
                background: isActive ? tier.colorSoft : undefined,
              }}
              title={`${tier.min.toFixed(1)}–${tier.max >= 10 ? '10.0' : tier.max.toFixed(1)} · ${tier.description}`}
            >
              <span className={styles.tierDot} style={{ background: tier.color }} />
              {tier.label}
              <small className={styles.tierRange}>
                {tier.min.toFixed(0)}–{tier.max >= 10 ? '10' : Math.floor(tier.max).toString()}
              </small>
            </span>
          );
        })}
      </div>

      <div className={styles.vibeGrid}>
        {/* Real Aspect Donut Chart — outer ring is the category composition
            (unchanged); the center is the actual overall community score,
            colored by tier so it reads as a quality signal at a glance. */}
        <div className={styles.donutWrapper}>
          <div
            className={styles.donut}
            style={{
              background: donutBackground,
              boxShadow: `0 0 0 3px ${overallColor}33, 0 6px 20px rgba(0, 0, 0, 0.4)`,
            }}
          >
            <div className={styles.donutInner}>
              <span className={styles.donutPercent} style={{ color: overallColor }}>
                {overallScore.toFixed(1)}
              </span>
              <span className={styles.donutLabel} style={{ color: overallColor }}>
                {overallLabel}
              </span>
              <span className={styles.donutSubLabel}>
                {(ratingCount || 0).toLocaleString()} rating{(ratingCount || 0) === 1 ? '' : 's'}
              </span>
            </div>
          </div>

          {isProvisional && (
            <p className={styles.provisionalNote}>
              <strong>Early score.</strong> Based on {(ratingCount || 0).toLocaleString()} rating
              {(ratingCount || 0) === 1 ? '' : 's'} so far — it will settle as more members rate.
            </p>
          )}
        </div>

        {/* Real Aspect Horizontal Bars */}
        <div className={styles.barsContainer}>
          {activeCategories.map((item) => {
            const fillWidth = Math.max(5, scoreToPercent(item.averageScore));
            const barColor = CATEGORY_COLORS[item.category] || '#6366F1';
            const barTier = getRatingTier(item.averageScore);
            return (
              <div key={item.category} className={styles.barItem}>
                <div className={styles.barLabelRow}>
                  <span>{item.label}</span>
                  <span className={styles.barPercent}>
                    <span>★ {item.averageScore.toFixed(1)}</span>
                    {barTier && (
                      <small
                        className={styles.barTierChip}
                        style={{
                          color: getScoreColor(item.averageScore),
                          background: getScoreSoftColor(item.averageScore, 0.14),
                        }}
                      >
                        {barTier.label}
                      </small>
                    )}
                    <small style={{ color: '#888', fontWeight: 500, marginLeft: 4 }}>
                      ({item.percentage}%)
                    </small>
                  </span>
                </div>
                <div className={styles.barTrack}>
                  <span
                    className={styles.barFill}
                    style={{ width: `${fillWidth}%`, backgroundColor: barColor }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Qualitative Insights Card */}
        <div className={styles.insightsCard}>
          <h3 className={styles.cardHeading}>Vibe Synthesis</h3>
          <p className={styles.summaryText}>{dynamicSummary}</p>
          <div className={styles.metricsList}>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Overall Tier</span>
              <span
                className={`${styles.badge}`}
                style={{
                  color: overallColor,
                  background: getScoreSoftColor(overallScore, 0.14),
                  border: `1px solid ${getScoreSoftColor(overallScore, 0.4)}`,
                }}
              >
                {overallLabel} · {overallScore.toFixed(1)}
              </span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Leading Dimension</span>
              <span className={styles.metricValue}>
                {primaryAspect.label} (★ {primaryAspect.averageScore.toFixed(1)})
              </span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Signal Confidence</span>
              <span className={`${styles.badge} ${badgeClass}`}>{confidence}</span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Sample Size</span>
              <span className={styles.metricValue}>
                {totalAspectRatings.toLocaleString()} ratings
              </span>
            </div>
            <div className={styles.metricRow}>
              <span className={styles.metricLabel}>Active Dimensions</span>
              <span className={styles.metricValue}>{activeCategories.length} tracked</span>
            </div>
          </div>

          {onOpenRateModal && (
            <button
              type="button"
              className={styles.contributeBtn}
              onClick={onOpenRateModal}
              title="Contribute aspect ratings"
            >
              <Sparkles size={13} />
              <span>Contribute Aspect Ratings</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
