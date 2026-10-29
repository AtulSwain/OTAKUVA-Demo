'use client';

import React, { useRef, useState } from 'react';
import { RETENTION_MAX, RETENTION_MIN } from '../../lib/rating/retentionScore';
import styles from './RetentionSegments.module.css';

const SEGMENTS = 20; // each segment covers 5 points
const clamp = (v: number) => Math.max(RETENTION_MIN, Math.min(RETENTION_MAX, Math.round(v)));

/**
 * The retention input (2026-10-25): 20 rounded segments, filled in the
 * value's band colour (red → orange → yellow → lime → green; silver when no
 * colour is given), graphite when not. Any whole number 1–100 can be picked — the last
 * segment fills partway (72 = 14 full segments + 40% of the 15th).
 *
 * Pointer: press and slide (or tap) anywhere on the bar. Keyboard: ←/→ ±1,
 * Shift+arrow or PageUp/PageDown ±10, Home = 1, End = 100, Enter = `onEnter`
 * (submit), Escape = `onEscape` (cancel). Picking only changes the value —
 * saving is the caller's explicit Submit.
 */
export function RetentionSegments({
  value,
  onChange,
  onEnter,
  onEscape,
  disabled = false,
  readOnly = false,
  onDisabledAttempt,
  size = 'sm',
  label,
  color,
}: {
  value: number | null;
  onChange: (value: number) => void;
  onEnter?: () => void;
  onEscape?: () => void;
  /** Dimmed and not interactive (e.g. episode not marked watched). */
  disabled?: boolean;
  /** Shown in full colour but can't be changed (a saved rating, until Edit). */
  readOnly?: boolean;
  /** Called when someone tries to use a disabled/read-only bar (to explain why). */
  onDisabledAttempt?: () => void;
  size?: 'sm' | 'md';
  label: string;
  /** Fill colour (the value's band colour); soft silver when omitted. */
  color?: string | null;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const blocked = disabled || readOnly;

  const valueAt = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return RETENTION_MIN;
    const r = el.getBoundingClientRect();
    return clamp(Math.ceil(((clientX - r.left) / Math.max(1, r.width)) * RETENTION_MAX));
  };

  const fill = (i: number) => {
    if (value === null) return 0;
    const per = RETENTION_MAX / SEGMENTS;
    return Math.max(0, Math.min(1, (value - i * per) / per));
  };

  return (
    <div
      ref={trackRef}
      className={`${styles.track} ${size === 'md' ? styles.md : ''} ${disabled ? styles.disabled : ''} ${readOnly ? styles.readOnly : ''} ${dragging ? styles.dragging : ''}`}
      style={color ? ({ ['--seg-on' as string]: color } as React.CSSProperties) : undefined}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-disabled={disabled || undefined}
      aria-readonly={readOnly || undefined}
      aria-valuemin={RETENTION_MIN}
      aria-valuemax={RETENTION_MAX}
      aria-valuenow={value ?? undefined}
      aria-valuetext={value === null ? 'Not rated' : `${value} out of 100`}
      onPointerDown={(e) => {
        if (blocked) return onDisabledAttempt?.();
        setDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        onChange(valueAt(e.clientX));
      }}
      onPointerMove={(e) => {
        if (dragging) onChange(valueAt(e.clientX));
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          if (!blocked) onEnter?.();
          return;
        }
        if (e.key === 'Escape') return onEscape?.();
        const big = e.shiftKey ? 10 : 1;
        const delta: Record<string, number> = { ArrowRight: big, ArrowUp: big, ArrowLeft: -big, ArrowDown: -big, PageUp: 10, PageDown: -10 };
        let next: number | null = null;
        if (e.key in delta) next = (value ?? 0) + delta[e.key];
        else if (e.key === 'Home') next = RETENTION_MIN;
        else if (e.key === 'End') next = RETENTION_MAX;
        if (next === null) return;
        e.preventDefault();
        if (blocked) return onDisabledAttempt?.();
        onChange(clamp(next));
      }}
    >
      {Array.from({ length: SEGMENTS }, (_, i) => (
        <span key={i} className={styles.seg} aria-hidden="true">
          <span className={styles.segFill} style={{ transform: `scaleX(${fill(i)})` }} />
        </span>
      ))}
    </div>
  );
}
