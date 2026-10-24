'use client';

import React, { useState, useEffect } from 'react';
import { X, Star, AlertTriangle, ShieldCheck, ShieldAlert, Sparkles, Trash2 } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { REVIEW_TAGS, MAX_REVIEW_TAGS } from '../../lib/reviews/reviewTags';
import { promptPhoneVerification } from '../auth/VerifyPhonePrompt';
import styles from './WriteReviewModal.module.css';

export type SpoilerLevelType = 'SPOILER_FREE' | 'MILD_SPOILERS' | 'SPOILERS' | 'FULL_SPOILERS';

export interface InitialReviewData {
  id: string;
  title?: string;
  body: string;
  rating?: number | null;
  spoilerLevel?: SpoilerLevelType;
  tags?: string[];
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

  // Reviews don't collect a score; when editing, show the author's rating
  // from the rating section (the API sends it as initialReview.rating).
  const existingRating = typeof initialReview?.rating === 'number' ? initialReview.rating : null;
  const [tags, setTags] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [spoilerLevel, setSpoilerLevel] = useState<SpoilerLevelType>('SPOILER_FREE');
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialReview) {
        setTags(initialReview.tags || []);
        setBody(initialReview.body || '');
        setSpoilerLevel(initialReview.spoilerLevel || 'SPOILER_FREE');
      } else {
        setTags([]);
        setBody('');
        setSpoilerLevel('SPOILER_FREE');
      }
      setError(null);
    }
  }, [isOpen, initialReview]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedBody = body.trim();

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
            body: trimmedBody,
            tags,
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
            body: trimmedBody,
            tags,
            spoilerLevel,
            containsSpoiler: spoilerLevel !== 'SPOILER_FREE',
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          if (data.code === 'PHONE_NOT_VERIFIED') {
            onClose();
            promptPhoneVerification('review');
            return;
          }
          throw new Error(data.error || 'Failed to publish review');
        }

        showToast('Review published successfully!', 'success');
        if (data.tagsSaved === false) {
          showToast('Your review is live, but its tags could not be saved. Edit the review to add them again.', 'info', 6000);
        }
        // Badge nudge: explains whether this review can count and how far the next tier is.
        const b = data.badge;
        if (b) {
          const note =
            b.countState === 'PENDING'
              ? `Counts toward your badge after ${b.maturityHours} hours. ${b.message}.`
              : b.countState === 'INELIGIBLE'
                ? b.ineligibleReason === 'TOO_SHORT'
                  ? `Add ${b.wordsNeeded} more words for this review to count toward your badge.`
                  : b.ineligibleReason === 'NOT_WATCHED'
                    ? 'Mark this title as watching or completed for a review to count toward your badge.'
                    : null
                : null;
          if (note) showToast(note, 'info', 6000);
        }
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

          {/* No score here: a review's score is the author's rating from the rating section. */}
          <p className={styles.ratingNote}>
            <Star size={13} fill="#F59E0B" stroke="#F59E0B" aria-hidden="true" />
            {existingRating !== null ? (
              <span>
                Your rating <strong>{existingRating.toFixed(1)}</strong> / 10 appears with this review. Change it with
                the Rate button on the anime page.
              </span>
            ) : (
              <span>Your rating from the anime page appears with this review. Reviews don&apos;t have a separate score.</span>
            )}
          </p>

          {/* Body textarea */}
          <div className={styles.inputGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label}>Your review</label>
              <span
                className={`${styles.charCount} ${body.trim().length < 20 ? styles.charCountWarning : ''}`}
              >
                {body.length}/5,000 {body.trim().length < 20 ? '(min 20)' : ''}
              </span>
            </div>
            <textarea
              className={`${styles.input} ${styles.textarea}`}
              placeholder="What did you think? Story, characters, animation, music — anything worth telling other fans."
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, 5000))}
              required
              rows={6}
            />
          </div>

          {/* Community tags: fixed vocabulary, rolls up into the anime's tags */}
          <div className={styles.inputGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label} id="review-tags-label">
                Tags <span className={styles.optionalTag}>(Optional · up to {MAX_REVIEW_TAGS})</span>
              </label>
              <span className={styles.charCount}>{tags.length}/{MAX_REVIEW_TAGS}</span>
            </div>
            <div className={styles.tagPicker} role="group" aria-labelledby="review-tags-label">
              {REVIEW_TAGS.map((t) => {
                const on = tags.includes(t.key);
                const full = !on && tags.length >= MAX_REVIEW_TAGS;
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={`${styles.tagOption} ${on ? styles.tagOptionOn : ''}`}
                    aria-pressed={on}
                    disabled={full}
                    onClick={() => setTags((prev) => (on ? prev.filter((k) => k !== t.key) : [...prev, t.key]))}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
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
                disabled={submitting || deleting || body.trim().length < 20}
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
