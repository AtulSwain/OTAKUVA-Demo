'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { promptPhoneVerification } from '../auth/VerifyPhonePrompt';
import { ACTIVE_RATING_CATEGORIES, CATEGORY_LABELS, type RatingCategoryType } from '../../lib/rating/ratingEngine';
import { RATING_TIERS } from '../../lib/rating/ratingTiers';
import { VIBE_GRADES, VIBE_GRADE_LABEL, type VibeGrade, type VibeSummary } from '../../lib/rating/vibeGrades';
import styles from './VibeModal.module.css';

const HINT: Record<RatingCategoryType, string> = {
  STORY: 'Plot, twists, how it all comes together',
  CHARACTERS: 'Cast you care about, growth, chemistry',
  ANIMATION: 'Art, motion, fights, visual style',
  MUSIC: 'Soundtrack, openings, endings, voice work',
  PACING: 'Moves at the right speed, no dragging',
  WORLD_BUILDING: 'Setting, lore, how real the world feels',
  ENJOYMENT: 'Plain fun — did you have a good time?',
  DIRECTION: '',
};
const tierColor = (g: VibeGrade) => RATING_TIERS.find((t) => t.id === g)?.color ?? '#a1a1aa';
const tierSoft = (g: VibeGrade) => RATING_TIERS.find((t) => t.id === g)?.colorSoft ?? 'rgba(255,255,255,0.08)';

/**
 * "What's your vibe about this anime?" (2026-10-25): one row per aspect, tap
 * a grade (Worst → Great). Untouched aspects aren't sent; tapping the chosen
 * grade again clears it. Saves the member's own grades only.
 */
export function VibeModal({
  isOpen,
  onClose,
  animeId,
  animeTitle,
  mine,
  onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  animeId: string;
  animeTitle: string;
  mine: VibeSummary['mine'];
  onSaved: (summary: VibeSummary) => void;
}) {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const [grades, setGrades] = useState<Partial<Record<RatingCategoryType, VibeGrade | null>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) setGrades({ ...mine });
  }, [isOpen, mine]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const changed = ACTIVE_RATING_CATEGORIES.filter((c) => (grades[c] ?? null) !== (mine[c] ?? null));
  const picked = ACTIVE_RATING_CATEGORIES.filter((c) => grades[c]).length;

  const save = async () => {
    if (!user) {
      onClose();
      return openAuthModal('login');
    }
    if (changed.length === 0) return onClose();
    setSaving(true);
    try {
      const res = await fetch(`/api/anime/${encodeURIComponent(animeId)}/vibe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grades: Object.fromEntries(changed.map((c) => [c, grades[c] ?? null])) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.code === 'PHONE_NOT_VERIFIED') {
          onClose();
          return promptPhoneVerification('rate');
        }
        throw new Error(body.error || 'Could not save your vibe.');
      }
      onSaved(body as VibeSummary);
      showToast('Your vibe is saved', 'success');
      onClose();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true" aria-label={`Your vibe about ${animeTitle}`}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <header className={styles.head}>
          <div>
            <span className={styles.kicker}>{animeTitle}</span>
            <h3 className={styles.title}>What&apos;s your vibe about this anime?</h3>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <ul className={styles.rows}>
          {ACTIVE_RATING_CATEGORIES.map((cat) => (
            <li key={cat} className={styles.row}>
              <div className={styles.aspect}>
                <strong>{CATEGORY_LABELS[cat]}</strong>
                <small>{HINT[cat]}</small>
              </div>
              <div className={styles.grades} role="radiogroup" aria-label={CATEGORY_LABELS[cat]}>
                {VIBE_GRADES.map((g) => {
                  const on = grades[cat] === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={`${styles.grade} ${on ? styles.gradeOn : ''}`}
                      style={on ? { color: tierColor(g), background: tierSoft(g), borderColor: tierColor(g) } : undefined}
                      onClick={() => setGrades((prev) => ({ ...prev, [cat]: on ? null : g }))}
                    >
                      {VIBE_GRADE_LABEL[g]}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>

        <footer className={styles.foot}>
          <span className={styles.count}>
            {picked} of {ACTIVE_RATING_CATEGORIES.length} picked
          </span>
          <div className={styles.actions}>
            <button type="button" className={styles.ghost} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" className={styles.primary} onClick={save} disabled={saving || (user ? changed.length === 0 : false)}>
              {saving ? 'Saving…' : user ? 'Save my vibe' : 'Sign in to rate'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
