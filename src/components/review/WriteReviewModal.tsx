'use client';

import React, { useState, useEffect } from 'react';
import { X, Star, AlertTriangle, ShieldCheck, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import styles from './WriteReviewModal.module.css';

export type SpoilerLevelType = 'SPOILER_FREE' | 'MILD_SPOILERS' | 'SPOILERS' | 'FULL_SPOILERS';

export interface InitialReviewData {
  id: string;
  title: string;
  body: string;
  rating?: number | null;
  spoilerLevel?: SpoilerLevelType;
}

interface WriteReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  animeId: string;
  animeTitle: string;
  initialReview?: InitialReviewData | null;
  onSuccess?: () => void;
}

const SPOILER_OPTIONS: { level: SpoilerLevelType; label: string; desc: string; icon: any }[] = [
  {
    level: 'SPOILER_FREE',
    label: 'Spoiler Free',
    desc: 'Safe for everyone who hasn’t watched',
    icon: ShieldCheck,
  },
  {
    level: 'MILD_SPOILERS',
    label: 'Mild Spoilers',
    desc: 'Minor worldbuilding or early-episode context',
    icon: ShieldAlert,
  },
  {
    level: 'SPOILERS',
    label: 'Spoilers',
    desc: 'Mid-series reveals, major plot twists',
    icon: AlertTriangle,
  },
  {
    level: 'FULL_SPOILERS',
    label: 'Full Spoilers',
    desc: 'Climax, series finale, character fates',
    icon: AlertTriangle,
  },
];

export const WriteReviewModal: React.FC<WriteReviewModalProps> = ({
  isOpen,
  onClose,
  animeId,
  animeTitle,
  initialReview,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const isEditing = Boolean(initialReview?.id);

  // Initial rating starts as null unless editing with an existing rating
  const [rating, setRating] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [spoilerLevel, setSpoilerLevel] = useState<SpoilerLevelType>('SPOILER_FREE');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialReview) {
        setTitle(initialReview.title || '');
        setBody(initialReview.body || '');
        setRating(typeof initialReview.rating === 'number' ? initialReview.rating : null);
        setSpoilerLevel(initialReview.spoilerLevel || 'SPOILER_FREE');
      } else {
        setTitle('');
        setBody('');
        setRating(null);
        setSpoilerLevel('SPOILER_FREE');
      }
      setError(null);
    }
  }, [isOpen, initialReview]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle) {
      setError('Please provide a review headline (up to 120 characters).');
      return;
    }
    if (trimmedTitle.length > 120) {
      setError('Headline cannot exceed 120 characters.');
      return;
    }
    if (trimmedBody.length < 20) {
      setError(`Review text is too short (${trimmedBody.length}/20 characters minimum).`);
      return;
    }
    if (trimmedBody.length > 5000) {
      setError('Review text exceeds 5,000 characters limit.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      if (isEditing && initialReview?.id) {
        // Edit existing review
        const res = await fetch(`/api/reviews/${initialReview.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: trimmedTitle,
            body: trimmedBody,
            rating,
            spoilerLevel,
            containsSpoiler: spoilerLevel !== 'SPOILER_FREE',
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update review');
        }

        showToast('Review updated successfully!', 'success');
      } else {
        // Create new review
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            animeId,
            title: trimmedTitle,
            body: trimmedBody,
            rating,
            spoilerLevel,
            containsSpoiler: spoilerLevel !== 'SPOILER_FREE',
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to publish review');
        }

        showToast('Review published successfully!', 'success');
      }

      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while saving your review.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!initialReview?.id) return;
    if (!confirm('Are you sure you want to delete this review?')) return;

    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${initialReview.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete review');
      }

      showToast('Review deleted', 'info');
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to delete review');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <div className={styles.headerBadgeRow}>
              <h2 className={styles.headerTitle}>
                {isEditing ? 'Edit Your Review' : 'Write a Review'}
              </h2>
              {isEditing && <span className={styles.editingTag}>Editing</span>}
            </div>
            <p className={styles.headerSubtitle}>{animeTitle}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.errorBox}>{error}</div>}

          {/* Rating Section (0.5 - 10.0 scale, with clearable null state) */}
          <div className={styles.inputGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label}>
                Rating <span className={styles.optionalTag}>(Optional)</span>
              </label>
              <div className={styles.ratingValueBadge}>
                {rating !== null ? (
                  <span className={styles.ratingVal}>
                    <Star size={13} fill="#F59E0B" stroke="#F59E0B" />
                    <strong>{rating.toFixed(1)}</strong> / 10
                  </span>
                ) : (
                  <span className={styles.noRatingVal}>No score selected</span>
                )}
                {rating !== null && (
                  <button
                    type="button"
                    className={styles.clearRatingBtn}
                    onClick={() => setRating(null)}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className={styles.sliderContainer}>
              <input
                type="range"
                min="0.5"
                max="10"
                step="0.5"
                value={rating ?? 5}
                onChange={(e) => setRating(parseFloat(e.target.value))}
                className={styles.rangeSlider}
              />
              <div className={styles.ratingChipsRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <button
                    key={score}
                    type="button"
                    className={`${styles.ratingChip} ${rating === score ? styles.ratingChipActive : ''}`}
                    onClick={() => setRating(score)}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Headline input */}
          <div className={styles.inputGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label}>Headline</label>
              <span className={styles.charCount}>{title.length}/120</span>
            </div>
            <input
              type="text"
              className={styles.input}
              placeholder="e.g. Masterpiece in pacing and emotional payoff"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 120))}
              required
              maxLength={120}
            />
          </div>

          {/* Body textarea */}
          <div className={styles.inputGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label}>Review Thoughts</label>
              <span
                className={`${styles.charCount} ${body.trim().length < 20 ? styles.charCountWarning : ''}`}
              >
                {body.length}/5,000 {body.trim().length < 20 ? '(min 20)' : ''}
              </span>
            </div>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              placeholder="What worked? How did the pacing, characters, music, and art hold up? Share your detailed critique..."
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 5000))}
              required
              rows={6}
            />
          </div>

          {/* 4-Tier Spoiler Selector */}
          <div className={styles.inputGroup}>
            <label className={styles.label}>Spoiler Warning Level</label>
            <div className={styles.spoilerGrid}>
              {SPOILER_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const isSelected = spoilerLevel === opt.level;
                return (
                  <button
                    key={opt.level}
                    type="button"
                    className={`${styles.spoilerCard} ${isSelected ? styles.spoilerCardActive : ''}`}
                    onClick={() => setSpoilerLevel(opt.level)}
                  >
                    <div className={styles.spoilerCardHeader}>
                      <Icon
                        size={14}
                        className={
                          opt.level === 'SPOILER_FREE'
                            ? styles.iconSafe
                            : opt.level === 'FULL_SPOILERS'
                            ? styles.iconFull
                            : styles.iconWarning
                        }
                      />
                      <span className={styles.spoilerLabel}>{opt.label}</span>
                    </div>
                    <span className={styles.spoilerDesc}>{opt.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modal Footer */}
          <div className={styles.footer}>
            {isEditing && (
              <button
                type="button"
                className={styles.deleteBtn}
                onClick={handleDelete}
                disabled={submitting || deleting}
              >
                <Trash2 size={14} />
                <span>{deleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            )}
            <div className={styles.footerRight}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={onClose}
                disabled={submitting || deleting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.submitBtn}
                disabled={submitting || deleting || body.trim().length < 20 || !title.trim()}
              >
                {submitting
                  ? isEditing
                    ? 'Updating...'
                    : 'Publishing...'
                  : isEditing
                  ? 'Update Review'
                  : 'Publish Review'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
