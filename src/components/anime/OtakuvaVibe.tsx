'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';
import { CategorySummaryItem, RatingConfidenceTier, isActiveRatingCategory } from '../../lib/rating/ratingEngine';
import { getRatingTier, getScoreColor, scoreToPercent, NO_SCORE_LABEL } from '../../lib/rating/ratingTiers';
import styles from './OtakuvaVibe.module.css';

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

/**
 * OTAKUVA Vibe — how members rate each aspect (Story, Characters, …).
 * Simplified 2026-10-23 (owner): one line naming the strongest and weakest
 * aspect, then one clean row per aspect (name · bar coloured by its score ·
 * score and tier word). The tier scale, donut and "Vibe Synthesis" metrics
 * box are gone — the overall score already sits in Community Rating above.
 * Only aspects members actually rated are shown; nothing is filled in.
 */
export const OtakuvaVibe: React.FC<OtakuvaVibeProps> = ({ categoryAggregates = [], ratingCount = 0, onOpenRateModal }) => {
  const aspects = (categoryAggregates || [])
    .filter((c) => c && isActiveRatingCategory(c.category) && typeof c.averageScore === 'number' && c.responseCount > 0)
    .sort((a, b) => b.averageScore - a.averageScore);
  const raters = ratingCount || 0;

  if (aspects.length === 0) {
    return (
      <section className={styles.section} aria-label="OTAKUVA Vibe">
        <div className={styles.head}>
          <h2 className={styles.title}>OTAKUVA Vibe</h2>
        </div>
        <div className={styles.empty}>
          <Sparkles size={18} aria-hidden="true" />
          <p>
            No aspect ratings yet. When members rate this anime they can score Story, Characters, Animation, Music,
            Pacing, World Building and Enjoyment — the vibe appears here.
          </p>
          {onOpenRateModal && (
            <button type="button" className={styles.rateBtn} onClick={onOpenRateModal}>
              Rate the vibe
            </button>
          )}
        </div>
      </section>
    );
  }

  const best = aspects[0];
  const worst = aspects[aspects.length - 1];
  const word = (s: number) => (getRatingTier(s)?.label ?? NO_SCORE_LABEL).toLowerCase();
  const summary =
    aspects.length > 1
      ? `Strongest: ${best.label} (${best.averageScore.toFixed(1)}, ${word(best.averageScore)}). Weakest: ${worst.label} (${worst.averageScore.toFixed(1)}, ${word(worst.averageScore)}).`
      : `${best.label} is rated ${best.averageScore.toFixed(1)} (${word(best.averageScore)}).`;

  return (
    <section className={styles.section} aria-label="OTAKUVA Vibe">
      <div className={styles.head}>
        <h2 className={styles.title}>OTAKUVA Vibe</h2>
        {raters > 0 && (
          <span className={styles.sub}>
            From {raters.toLocaleString('en-US')} member{raters === 1 ? '' : 's'}
            {raters < 10 && ' · early read'}
          </span>
        )}
      </div>
      <p className={styles.summary}>{summary}</p>

      <ul className={styles.rows}>
        {aspects.map((a) => {
          const color = getScoreColor(a.averageScore);
          return (
            <li key={a.category} className={styles.row}>
              <span className={styles.name}>{a.label}</span>
              <span className={styles.track} aria-hidden="true">
                <span className={styles.fill} style={{ width: `${Math.max(4, scoreToPercent(a.averageScore))}%`, background: color }} />
              </span>
              <span className={styles.value}>
                <strong style={{ color }}>{a.averageScore.toFixed(1)}</strong>
                <small>{getRatingTier(a.averageScore)?.label ?? ''}</small>
              </span>
            </li>
          );
        })}
      </ul>

      {onOpenRateModal && (
        <button type="button" className={styles.rateLink} onClick={onOpenRateModal}>
          Add your vibe
        </button>
      )}
    </section>
  );
};
