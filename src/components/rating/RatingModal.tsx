'use client';

import React, { useState, useEffect } from 'react';
import { notifyCommunityScoresChanged } from '../../lib/rating/useCommunityScore';
import { Star, X, Trash2, Minus, Plus, Sparkles } from 'lucide-react';
import { ACTIVE_RATING_CATEGORIES, CATEGORY_LABELS, RatingCategoryType } from '../../lib/rating/ratingEngine';
import { getRatingTier, getScoreColor, NO_SCORE_COLOR } from '../../lib/rating/ratingTiers';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { promptPhoneVerification } from '../auth/VerifyPhonePrompt';
import styles from './RateWindow.module.css';

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

/** Scores run 0.5–10.0 in steps of 0.1 (9.1, 9.2 …) since 2026-10-23. */
const MIN = 0.5;
const MAX = 10;
const STEP = 0.1;
const DEFAULT_THUMB = 7.5;
const clean = (v: number) => Math.min(MAX, Math.max(MIN, Math.round(v * 10) / 10));
/** Guide numbers under the slider — whole numbers only (no 2.5 / 5.5 chips). */
const GUIDE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const guidePos = (n: number) => `${((n - MIN) / (MAX - MIN)) * 100}%`;

/** The filled part of a slider track, in the colour of the score under the thumb. */
function trackStyle(score: number | null): React.CSSProperties {
  const value = score ?? DEFAULT_THUMB;
  const pct = ((value - MIN) / (MAX - MIN)) * 100;
  const color = score === null ? NO_SCORE_COLOR : getScoreColor(value);
  return {
    background: `linear-gradient(90deg, ${color} 0%, ${color} ${pct}%, rgba(255,255,255,0.09) ${pct}%, rgba(255,255,255,0.09) 100%)`,
    ['--thumb' as string]: color,
  };
}

/**
 * "Rate this anime" window (redesigned 2026-10-23, owner: drop the 0.5 / 2.5 /
 * 5.5 quick picks, one slider people can drag in 0.1 steps). One big score in
 * its tier colour, a slider with −/+ fine-tune (0.1), and the optional
 * OTAKUVA Vibe aspects as simple 0.1-step sliders — untouched aspects stay
 * unrated and are never submitted.
 */
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
  const [categoryScores, setCategoryScores] = useState<Partial<Record<RatingCategoryType, number>>>(currentCategoryRatings || {});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setOverallScore(currentRating ?? null);
      setCategoryScores(currentCategoryRatings || {});
      setError(null);
    }
  }, [isOpen, currentRating, currentCategoryRatings]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const tier = getRatingTier(overallScore);
  const color = overallScore === null ? NO_SCORE_COLOR : getScoreColor(overallScore);
  const ratedCount = ACTIVE_RATING_CATEGORIES.filter((c) => typeof categoryScores[c] === 'number').length;

  const nudge = (delta: number) => setOverallScore((prev) => clean((prev ?? DEFAULT_THUMB) + delta));
  const setCategory = (cat: RatingCategoryType, val: number) => setCategoryScores((prev) => ({ ...prev, [cat]: clean(val) }));
  const clearCategory = (cat: RatingCategoryType) =>
    setCategoryScores((prev) => {
      const copy = { ...prev };
      delete copy[cat];
      return copy;
    });

  const handleSave = async () => {
    if (overallScore === null) {
      setError('Drag the slider to choose your score first.');
      return;
    }
    try {
      setIsSaving(true);
      setError(null);

      const cleanScore = clean(overallScore);
      const payload: { score: number; categoryScores?: Partial<Record<RatingCategoryType, number>> } = { score: cleanScore };
      const cleanCats: Partial<Record<RatingCategoryType, number>> = {};
      for (const [k, v] of Object.entries(categoryScores)) {
        if (typeof v === 'number' && !isNaN(v) && v >= MIN && v <= MAX) cleanCats[k as RatingCategoryType] = clean(v);
      }
      if (Object.keys(cleanCats).length > 0) payload.categoryScores = cleanCats;

      // Guest flow: save locally and prompt login smoothly without a 401 error
      if (!user) {
        try {
          localStorage.setItem(
            `otakuva_guest_rating_${animeId}`,
            JSON.stringify({ score: cleanScore, categoryScores: payload.categoryScores, timestamp: Date.now() })
          );
        } catch {
          // ignore storage errors
        }
        onRatingSaved?.(cleanScore, payload.categoryScores);
        showToast(`Rated ★ ${cleanScore.toFixed(1)}/10 (Saved locally)`, 'success');
        onClose();
        openAuthModalWithIntent(
          { type: 'RATE_ANIME', animeId, animeTitle, score: cleanScore },
          `Rating saved locally! Sign in to sync your score and contribute to Otakuva Vibe.`
        );
        return;
      }

      const res = await fetch(`/api/anime/${animeId}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({} as { error?: string; code?: string }));
        if (errData.code === 'PHONE_NOT_VERIFIED') {
          onClose();
          promptPhoneVerification('rate');
          return;
        }
        throw new Error(
          res.status === 401
            ? 'Your session is no longer valid. Please sign in again, then save your rating.'
            : errData.error || 'Failed to save rating'
        );
      }
      // Cards and posters show the new OTAKUVA score straight away.
      notifyCommunityScoresChanged();
      showToast(`Rated ★ ${cleanScore.toFixed(1)}/10`, 'success');
      onRatingSaved?.(cleanScore, payload.categoryScores);
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
        try {
          localStorage.removeItem(`otakuva_guest_rating_${animeId}`);
        } catch {
          // ignore
        }
        showToast('Rating removed', 'info');
        onRatingDeleted?.();
        onClose();
        return;
      }
      const res = await fetch(`/api/anime/${animeId}/rating`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete rating');
      notifyCommunityScoresChanged();
      showToast('Rating removed', 'info');
      onRatingDeleted?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Unable to delete rating.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={`Rate ${animeTitle}`}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headText}>
            <span className={styles.kicker}>Rate this anime</span>
            <h3 className={styles.title}>{animeTitle}</h3>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className={styles.body}>
          {/* The score — colour follows the tier as you drag */}
          <div className={styles.scoreBlock} style={{ ['--c' as string]: color }}>
            <div className={styles.scoreRow}>
              <Star size={26} className={styles.scoreStar} fill={overallScore === null ? 'none' : color} color={color} aria-hidden="true" />
              <span className={styles.score} aria-live="polite">
                {overallScore === null ? '–' : overallScore.toFixed(1)}
              </span>
              <span className={styles.scoreMax}>/ 10</span>
            </div>
            <p className={styles.tierLine}>
              {tier ? (
                <>
                  <strong>{tier.label}</strong> · {tier.description}
                </>
              ) : (
                'Drag the slider to choose your score'
              )}
            </p>
          </div>

          {/* One slider, 0.1 steps; −/+ fine-tune by 0.1 */}
          <div className={styles.sliderBlock}>
            <button type="button" className={styles.nudge} onClick={() => nudge(-STEP)} aria-label="Lower by 0.1">
              <Minus size={16} />
            </button>
            <div className={styles.sliderWrap}>
              <input
                type="range"
                min={MIN}
                max={MAX}
                step={STEP}
                value={overallScore ?? DEFAULT_THUMB}
                onChange={(e) => setOverallScore(clean(parseFloat(e.target.value)))}
                className={`${styles.slider} ${overallScore === null ? styles.sliderIdle : ''}`}
                style={trackStyle(overallScore)}
                aria-label="Your score, 0.5 to 10 in steps of 0.1"
                aria-valuetext={overallScore === null ? 'Not rated' : `${overallScore.toFixed(1)} out of 10`}
              />
              <div className={styles.guide} aria-hidden="true">
                {GUIDE.map((n) => (
                  <span key={n} style={{ left: guidePos(n) }}>
                    {n}
                  </span>
                ))}
              </div>
            </div>
            <button type="button" className={styles.nudge} onClick={() => nudge(STEP)} aria-label="Raise by 0.1">
              <Plus size={16} />
            </button>
          </div>

          {/* OTAKUVA Vibe aspects — optional */}
          <section className={styles.vibe} aria-label="OTAKUVA Vibe aspects">
            <div className={styles.vibeHead}>
              <span className={styles.vibeTitle}>
                <Sparkles size={14} aria-hidden="true" /> OTAKUVA Vibe
              </span>
              <span className={styles.vibeNote}>
                Optional · {ratedCount} of {ACTIVE_RATING_CATEGORIES.length} rated
              </span>
            </div>
            <ul className={styles.aspects}>
              {ACTIVE_RATING_CATEGORIES.map((cat) => {
                const val = categoryScores[cat];
                const has = typeof val === 'number';
                return (
                  <li key={cat} className={`${styles.aspect} ${has ? styles.aspectOn : ''}`}>
                    <span className={styles.aspectName}>{CATEGORY_LABELS[cat]}</span>
                    <input
                      type="range"
                      min={MIN}
                      max={MAX}
                      step={STEP}
                      value={val ?? DEFAULT_THUMB}
                      onChange={(e) => setCategory(cat, parseFloat(e.target.value))}
                      className={`${styles.aspectSlider} ${has ? '' : styles.sliderIdle}`}
                      style={trackStyle(has ? val : null)}
                      aria-label={`Rate ${CATEGORY_LABELS[cat]}`}
                    />
                    <span className={styles.aspectValue} style={has ? { color: getScoreColor(val) } : undefined}>
                      {has ? val.toFixed(1) : '–'}
                    </span>
                    <button
                      type="button"
                      className={styles.aspectClear}
                      onClick={() => clearCategory(cat)}
                      aria-label={`Clear ${CATEGORY_LABELS[cat]}`}
                      disabled={!has}
                    >
                      <X size={13} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className={styles.footer}>
          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}
          <div className={styles.footerRow}>
            {currentRating !== null && currentRating !== undefined ? (
              <button type="button" className={styles.remove} onClick={handleDelete} disabled={isSaving}>
                <Trash2 size={14} /> Remove
              </button>
            ) : (
              <span />
            )}
            <div className={styles.actions}>
              <button type="button" className={styles.cancel} onClick={onClose} disabled={isSaving}>
                Cancel
              </button>
              <button
                type="button"
                className={styles.save}
                onClick={handleSave}
                disabled={overallScore === null || isSaving}
                style={overallScore === null ? undefined : { background: color }}
              >
                {isSaving ? 'Saving…' : overallScore === null ? 'Save rating' : `Save ${overallScore.toFixed(1)}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
