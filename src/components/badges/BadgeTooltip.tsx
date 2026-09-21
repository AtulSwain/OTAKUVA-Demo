'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { getTier, type Tier, type TierKey } from '../../lib/badges/tiers';
import { BADGE_STRINGS, glossFor } from '../../lib/badges/strings';
import styles from './BadgeTooltip.module.css';

export interface BadgeTooltipProps {
  tier: TierKey | Tier;
  children: ReactNode;
  /** Open below the trigger instead of above (near the top of a container). */
  below?: boolean;
}

/**
 * Hover + keyboard-focus + tap tooltip for a seal or chip. Shows kanji,
 * romaji, English meaning and the reviews required. Tap toggles it on touch
 * devices; Escape or an outside tap closes it.
 */
export default function BadgeTooltip({ tier, children, below }: BadgeTooltipProps) {
  const t = typeof tier === 'string' ? getTier(tier) : tier;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  return (
    <span
      ref={ref}
      className={styles.wrap}
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={close}
      onFocus={() => setOpen(true)}
      onBlur={close}
      onClick={() => setOpen((v) => !v)}
    >
      {children}
      {open && (
        <span id={id} role="tooltip" className={`${styles.tip} ${below ? styles.below : ''}`}>
          <span className={styles.kanji} lang="ja">{t.kanjiFull}</span>
          <span className={styles.name}>{t.name}</span>
          <span className={styles.meaning}>{glossFor(t.glossKey)}</span>
          <span className={styles.req}>{BADGE_STRINGS.tooltipRequires(t.min)}</span>
        </span>
      )}
    </span>
  );
}
