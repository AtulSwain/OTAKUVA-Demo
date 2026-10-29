'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Check, Circle, Lock, Sparkles, X } from 'lucide-react';
import { TIERS, tierIndex, type Tier } from '../../lib/badges/tiers';
import { glossFor } from '../../lib/badges/strings';
import { TIER_ABOUT, tierCriteria, tierPerks } from '../../lib/badges/tierInfo';
import Seal from './Seal';
import { tierVars } from './tierStyle';
import styles from './BadgeInfoSheet.module.css';

/**
 * Tap any badge (earned or not) to read it (owner, 2026-10-27): the seal,
 * kanji, meaning, what it's about, the exact criteria (from the live rules),
 * what it unlocks, and where the member stands. A centred card on desktop, a
 * bottom sheet on phones. `count` = the member's level points, when known.
 */
export default function BadgeInfoSheet({ tier, count, onClose }: { tier: Tier; count?: number; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  const known = typeof count === 'number';
  const reached = known && count! >= tier.min;
  const idx = tierIndex(tier);
  const remaining = known ? Math.max(0, tier.min - count!) : null;
  const prevMin = idx > 0 ? TIERS[idx - 1].min : 0;
  const fraction = known && !reached ? Math.max(0, Math.min(1, (count! - prevMin) / Math.max(1, tier.min - prevMin))) : 1;
  const criteria = tierCriteria(tier, count);
  const perks = tierPerks(tier);

  return createPortal(
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-label={`${tier.name} badge`}
        style={tierVars(tier)}
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className={styles.hero}>
          <span className={styles.glow} aria-hidden="true" />
          <Seal tier={tier} size={104} decorative />
          <span className={styles.kanji} lang="ja">{tier.kanjiFull}</span>
          <h2 className={styles.name}>{tier.name}</h2>
          <p className={styles.gloss}>
            {glossFor(tier.glossKey)} · Level {idx + 1} of {TIERS.length}
          </p>
          {known &&
            (reached ? (
              <span className={`${styles.status} ${styles.statusOn}`}>
                <Check size={13} strokeWidth={3} aria-hidden="true" /> {tier.min === 0 ? 'Starting level' : 'Collected'}
              </span>
            ) : (
              <span className={styles.status}>
                <Lock size={12} aria-hidden="true" /> {remaining!.toLocaleString('en-US')} to go
              </span>
            ))}
        </div>

        {known && !reached && (
          <div className={styles.progress} aria-label={`${count} of ${tier.min} points`}>
            <span className={styles.bar}>
              <span style={{ width: `${Math.round(fraction * 100)}%` }} />
            </span>
            <span className={styles.progressText}>
              <strong>{count!.toLocaleString('en-US')}</strong> / {tier.min.toLocaleString('en-US')} points
            </span>
          </div>
        )}

        <p className={styles.about}>{TIER_ABOUT[tier.key]}</p>

        <h3 className={styles.h}>How to earn it</h3>
        <ul className={styles.list}>
          {criteria.map((c) => (
            <li key={c.key} className={c.met || reached ? styles.met : ''}>
              {c.met || reached ? <Check size={15} strokeWidth={3} aria-label="Met" /> : <Circle size={14} aria-hidden="true" />}
              <span>{c.text}</span>
            </li>
          ))}
        </ul>

        {perks.length > 0 && (
          <>
            <h3 className={styles.h}>What it gives you</h3>
            <ul className={styles.list}>
              {perks.map((p) => (
                <li key={p}>
                  <Sparkles size={14} aria-hidden="true" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
