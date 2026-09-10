'use client';

import React, { useState, useEffect } from 'react';
import { Star, X, Trash2, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { RATING_CATEGORIES, CATEGORY_LABELS, RatingCategoryType } from '../../lib/rating/ratingEngine';
import {
  getRatingTier,
  getScoreColor,
  getScoreGradient,
  getScoreSoftColor,
  scoreToPercent,
  RATING_TIERS,
  NO_SCORE_COLOR,
} from '../../lib/rating/ratingTiers';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import styles from './RatingModal.module.css';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  animeId: string;
  animeTitle: string;
  currentRating?: number | null;
  currentCategoryRatings?: Partial<Record<RatingCategoryType, number>>;
  onRatingSaved?: (score: number, categoryScores?: Partial<Record<RatingCategoryType, number>>) => void;
  onRatingDeleted?: () => void;
}

// The modal used to have its own eight-step ladder ("Fine", "Appalling", …)
// that disagreed with the vibe graph and the score gauge. It now reads the
// same five tiers as everything else, so the word a user sees while rating is
// the word the page will show once the rating lands.
function getScoreLabel(score: number | null): string {
  if (score === null) return "WHAT'S YOUR RATING?";
  return (getRatingTier(score)?.label ?? '').toUpperCase();
}

/** Track background for a range input: filled portion tinted to the score. */
function sliderTrackStyle(score: number | null, fallback: number): React.CSSProperties {
  const value = score ?? fallback;
  const pct = scoreToPercent(value);
  const color = score === null ? NO_SCORE_COLOR : getScoreColor(value);
  return {
    background: `linear-gradient(90deg, ${color} 0%, ${color} ${pct}%, rgba(255,255,255,0.10) ${pct}%, rgba(255,255,255,0.10) 100%)`,
    accentColor: color,
  };
}

const POPULAR_QUICK_RATINGS = [5.0, 6.0, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0];

export const RatingModal: React.FC<RatingModalProps> = ({
  isOpen,
  onClose,
  animeId,
  animeTitle,
  currentRating = null,
  currentCategoryRatings = {},
  onRatingSaved,
  onRatingDeleted,
}) => {
  const { user, openAuthModalWithIntent } = useAuth();
  const { showToast } = useToast();
  const [overallScore, setOverallScore] = useState<number | null>(currentRating ?? null);
  const [categoryScores, setCategoryScores] = useState<Partial<Record<RatingCategoryType, number>>>(
    currentCategoryRatings || {}
  );
  const [showCategoryPanel, setShowCategoryPanel] = useState<boolean>(
    Boolean(currentCategoryRatings && Object.keys(currentCategoryRatings).length > 0)
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setOverallScore(currentRating ?? null);
      setCategoryScores(currentCategoryRatings || {});
      setShowCategoryPanel(Boolean(currentCategoryRatings && Object.keys(currentCategoryRatings).length > 0));
      setError(null);
    }
  }, [isOpen, currentRating, currentCategoryRatings]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Everything colour-related in this modal derives from these two values, so
  // the panel, the slider, the chips and the aspect preview all move together
  // the moment the score changes.
  const activeTier = getRatingTier(overallScore);
  const activeColor = overallScore === null ? NO_SCORE_COLOR : getScoreColor(overallScore);

  // Live preview of the aspect bars the user is about to contribute to the
  // OTAKUVA Vibe graph. Only aspects they have actually rated appear — nothing
  // is invented to fill the chart out.
  const ratedCategories = RATING_CATEGORIES.filter(
    (cat) => typeof categoryScores[cat] === 'number'
  );

  const handleCategoryChange = (cat: RatingCategoryType, val: number) => {
    const clean = Math.round(val * 2) / 2;
    setCategoryScores((prev) => ({
      ...prev,
      [cat]: clean,
    }));
  };

  const handleClearCategory = (cat: RatingCategoryType) => {
    setCategoryScores((prev) => {
      const copy = { ...prev };
      delete copy[cat];
      return copy;
    });
  };

  const handleSave = async () => {
    if (overallScore === null) {
      setError('Please select an overall rating before saving.');
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const cleanScore = Math.round(overallScore * 2) / 2;
      const payload: {
        score: number;
        categoryScores?: Partial<Record<RatingCategoryType, number>>;
      } = {
        score: cleanScore,
      };

      if (showCategoryPanel && categoryScores && Object.keys(categoryScores).length > 0) {
        const cleanCats: Partial<Record<RatingCategoryType, number>> = {};
        for (const [k, v] of Object.entries(categoryScores)) {
          if (typeof v === 'number' && !isNaN(v) && v >= 0.5 && v <= 10.0) {
            cleanCats[k as RatingCategoryType] = Math.round(v * 2) / 2;
          }
        }
        if (Object.keys(cleanCats).length > 0) {
          payload.categoryScores = cleanCats;
        }
      }

      // Guest flow: save locally and prompt login smoothly without 401 error
      if (!user) {
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem(
              `otakuva_guest_rating_${animeId}`,
              JSON.stringify({
                score: cleanScore,
                categoryScores: payload.categoryScores,
                timestamp: Date.now(),
              })
            );
          } catch {
            // ignore localStorage quota errors
          }
        }

        if (onRatingSaved) {
          onRatingSaved(cleanScore, payload.categoryScores);
        }
        showToast(`Rated ★ ${cleanScore.toFixed(1)}/10 (Saved locally)`, 'success');
        onClose();

        openAuthModalWithIntent(
          {
            type: 'RATE_ANIME',
            animeId,
            animeTitle,
            score: cleanScore,
          },
          `Rating saved locally! Sign in to sync your score and contribute to Otakuva Vibe.`
        );
        return;
      }

      // Authenticated flow: submit to API
      const res = await fetch(`/api/anime/${animeId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save rating');
      }

      showToast(`Rated ★ ${cleanScore.toFixed(1)}/10`, 'success');
      if (onRatingSaved) {
        onRatingSaved(cleanScore, payload.categoryScores);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Unable to save rating. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      setIsSaving(true);
      setError(null);

      if (!user) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem(`otakuva_guest_rating_${animeId}`);
        }
        showToast('Rating removed', 'info');
        if (onRatingDeleted) {
          onRatingDeleted();
        }
        onClose();
        return;
      }

      const res = await fetch(`/api/anime/${animeId}/rating`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete rating');
      }

      showToast('Rating removed', 'info');
      if (onRatingDeleted) {
        onRatingDeleted();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Unable to delete rating.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleCol}>
            <span className={styles.kicker}>YOUR RATING</span>
            <h3 className={styles.animeTitle}>{animeTitle}</h3>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {error && <div className={styles.errorAlert}>{error}</div>}

        {/* Big Overall Rating Display — every colour here is derived from the
            score currently under the user's thumb, so the whole panel shifts
            from red to green live as they drag. */}
        <div
          className={styles.scoreHero}
          style={{
            background: overallScore === null ? undefined : getScoreSoftColor(overallScore, 0.09),
            borderColor: overallScore === null ? undefined : getScoreSoftColor(overallScore, 0.35),
            boxShadow:
              overallScore === null
                ? undefined
                : `inset 0 0 40px ${getScoreSoftColor(overallScore, 0.12)}`,
          }}
        >
          <div className={styles.starRow}>
            {overallScore !== null ? (
              <Star size={32} className={styles.starIcon} fill={activeColor} color={activeColor} />
            ) : (
              <Star size={32} className={styles.starIconEmpty} />
            )}
          </div>
          <div className={styles.scoreValueRow}>
            {overallScore !== null ? (
              <>
                <span className={styles.scoreBig} style={{ color: activeColor }}>
                  {overallScore.toFixed(1)}
                </span>
                <span className={styles.scoreMax}>/ 10.0</span>
              </>
            ) : (
              <>
                <span className={styles.scorePlaceholder}>—</span>
                <span className={styles.scoreMax}>/ 10.0</span>
              </>
            )}
          </div>
          <span
            className={styles.scoreLabel}
            style={{ color: overallScore === null ? undefined : activeColor }}
          >
            {getScoreLabel(overallScore)}
          </span>
          {activeTier ? (
            <span className={styles.scoreHint}>{activeTier.description}</span>
          ) : (
            <span className={styles.scoreHint}>Select a score from 0.5 to 10.0 below</span>
          )}

          {/* The five-tier ladder, with the user's current band lit up. */}
          <div className={styles.tierLadder} role="list" aria-label="Rating tiers">
            {RATING_TIERS.map((tier) => {
              const isActive = activeTier?.id === tier.id;
              return (
                <span
                  key={tier.id}
                  role="listitem"
                  className={`${styles.tierStep} ${isActive ? styles.tierStepActive : ''}`}
                  style={
                    isActive
                      ? { color: tier.color, borderColor: tier.color, background: tier.colorSoft }
                      : undefined
                  }
                  title={`${tier.min.toFixed(1)} – ${tier.max >= 10 ? '10.0' : tier.max.toFixed(1)}`}
                >
                  {tier.label}
                </span>
              );
            })}
          </div>
        </div>

        {/* Quick Stepper Slider (0.5 increments) */}
        <div className={styles.sliderSection}>
          <div className={styles.sliderControlsRow}>
            <button
              type="button"
              className={styles.stepperBtn}
              onClick={() =>
                setOverallScore((prev) => Math.max(0.5, Number(((prev ?? 8.0) - 0.5).toFixed(1))))
              }
              title="Decrease by 0.5"
            >
              -0.5
            </button>
            <input
              type="range"
              min="0.5"
              max="10.0"
              step="0.5"
              value={overallScore ?? 7.5}
              onChange={(e) => setOverallScore(parseFloat(e.target.value))}
              className={styles.scoreSlider}
              style={sliderTrackStyle(overallScore, 7.5)}
              aria-label="Select score from 0.5 to 10.0 in 0.5 steps"
            />
            <button
              type="button"
              className={styles.stepperBtn}
              onClick={() =>
                setOverallScore((prev) => Math.min(10.0, Number(((prev ?? 7.0) + 0.5).toFixed(1))))
              }
              title="Increase by 0.5"
            >
              +0.5
            </button>
          </div>
          <div className={styles.sliderTicks}>
            <span>0.5</span>
            <span>2.5</span>
            <span>5.0</span>
            <span>7.5</span>
            <span>10.0</span>
          </div>

          {/* Quick Preset Chips */}
          <div className={styles.quickChipsRow}>
            <span className={styles.quickChipsLabel}>Quick Select:</span>
            <div className={styles.quickChips}>
              {POPULAR_QUICK_RATINGS.map((val) => (
                <button
                  key={val}
                  type="button"
                  className={`${styles.chipBtn} ${overallScore === val ? styles.chipBtnActive : ''}`}
                  onClick={() => setOverallScore(val)}
                  style={{
                    color: getScoreColor(val),
                    borderColor:
                      overallScore === val
                        ? getScoreColor(val)
                        : getScoreSoftColor(val, 0.35),
                    background:
                      overallScore === val ? getScoreSoftColor(val, 0.2) : undefined,
                  }}
                  title={`${val.toFixed(1)} · ${getRatingTier(val)?.label ?? ''}`}
                >
                  {val.toFixed(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Optional Collapsible Detailed Category Ratings Panel */}
        <div className={styles.categoryToggleSection}>
          <button
            type="button"
            className={styles.toggleCategoryBtn}
            onClick={() => setShowCategoryPanel((prev) => !prev)}
          >
            <Sparkles size={14} />
            <span>Detailed Aspect Ratings (Optional)</span>
            {showCategoryPanel ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {showCategoryPanel && (
            <div className={styles.categoryPanel}>
              <p className={styles.categoryNote}>
                Rate individual dimensions to shape OTAKUVA&apos;s Community Vibe profile. Unrated dimensions remain blank and are not manufactured.
              </p>
              <div className={styles.categoryList}>
                {RATING_CATEGORIES.map((cat) => {
                  const val = categoryScores[cat];
                  const hasVal = typeof val === 'number';
                  return (
                    <div key={cat} className={styles.categoryRow}>
                      <div className={styles.categoryLabelCol}>
                        <span className={styles.catName}>{CATEGORY_LABELS[cat]}</span>
                        <div className={styles.catRightCol}>
                          {hasVal ? (
                            <>
                              <span
                                className={styles.catTierChip}
                                style={{
                                  color: getScoreColor(val),
                                  background: getScoreSoftColor(val, 0.14),
                                }}
                              >
                                {getRatingTier(val)?.label}
                              </span>
                              <span className={styles.catVal} style={{ color: getScoreColor(val) }}>
                                {val.toFixed(1)}
                              </span>
                              <button
                                type="button"
                                className={styles.catClearBtn}
                                onClick={() => handleClearCategory(cat)}
                                title="Clear rating for this aspect"
                              >
                                Clear
                              </button>
                            </>
                          ) : (
                            <span className={styles.catUnrated}>— Unrated</span>
                          )}
                        </div>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="10.0"
                        step="0.5"
                        value={val ?? 7.5}
                        onChange={(e) => handleCategoryChange(cat, parseFloat(e.target.value))}
                        className={styles.catSlider}
                        style={sliderTrackStyle(hasVal ? val : null, 7.5)}
                        aria-label={`Rate ${CATEGORY_LABELS[cat]}`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Live preview of what these scores will look like in the
                  OTAKUVA Vibe graph. Same tier colours, same bars — so the
                  user can see the graph move before they commit. */}
              {ratedCategories.length > 0 && (
                <div className={styles.vibePreview}>
                  <div className={styles.vibePreviewHead}>
                    <span>Your Vibe Preview</span>
                    <span className={styles.vibePreviewCount}>
                      {ratedCategories.length} of {RATING_CATEGORIES.length} aspects rated
                    </span>
                  </div>
                  <div className={styles.vibePreviewBars}>
                    {ratedCategories.map((cat) => {
                      const value = categoryScores[cat] as number;
                      return (
                        <div key={cat} className={styles.vibePreviewRow}>
                          <span className={styles.vibePreviewLabel}>{CATEGORY_LABELS[cat]}</span>
                          <span
                            className={styles.vibePreviewTrack}
                            style={{ background: getScoreSoftColor(value, 0.1) }}
                          >
                            <span
                              className={styles.vibePreviewFill}
                              style={{
                                width: `${scoreToPercent(value)}%`,
                                background: getScoreGradient(value),
                              }}
                            />
                          </span>
                          <span
                            className={styles.vibePreviewVal}
                            style={{ color: getScoreColor(value) }}
                          >
                            {value.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions Footer */}
        <div className={styles.footer}>
          {currentRating !== null && currentRating !== undefined ? (
            <button
              type="button"
              className={styles.deleteBtn}
              onClick={handleDelete}
              disabled={isSaving}
              title="Remove your rating"
            >
              <Trash2 size={14} />
              <span>Remove Rating</span>
            </button>
          ) : (
            <div />
          )}

          <div className={styles.actionRight}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={overallScore === null || isSaving}
              title={overallScore === null ? 'Select a rating first' : 'Save your rating'}
            >
              {isSaving ? 'Saving...' : 'Save Rating'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
