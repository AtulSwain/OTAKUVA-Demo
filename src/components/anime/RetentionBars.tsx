'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Lock, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { promptPhoneVerification } from '../auth/VerifyPhonePrompt';
import { notifyCommunityScoresChanged } from '../../lib/rating/useCommunityScore';
import { retentionColor, retentionLabel } from '../../lib/rating/retentionTone';
import type { EpisodeRetentionSummary } from '../rating/EpisodeRetentionModal';
import styles from './RetentionBars.module.css';

const STEPS = 20; // one bar per 5%
const snap = (v: number) => Math.max(0, Math.min(100, Math.round(v / 5) * 5));

/**
 * One episode's retention, rated in its Episode Guide line (v5, 2026-10-22 —
 * owner: "make it unique so people like to use it"): a "signal ramp" of 20
 * slim bars, each 5%, rising in height left to right. Bars up to your value
 * light up in its band colour (retentionTone.ts); the top lit bar is capped
 * white; everyone's average is a small caret under the ramp. The value and
 * its band word ("Hooked", "Drifting"…) sit beside it. Slide or tap; saves
 * when you let go (a wave runs through the lit bars). Arrow keys (+/-5),
 * Home / End and Delete work too. Locked (dimmed, "Watch first") until the
 * member marks the episode watched. Name kept for its call sites.
 */
export function RetentionBars({
  animeId,
  episodeNumber,
  mine,
  community,
  onSaved,
  compact = false,
  locked = false,
}: {
  animeId: string;
  episodeNumber: number;
  mine: number | null;
  community: { value: number | null; count: number };
  onSaved: (summary: EpisodeRetentionSummary) => void;
  /** One-line layout for the Episode Guide rows. */
  compact?: boolean;
  /** Not marked watched yet: retention can't be given (owner, 2026-10-21). */
  locked?: boolean;
}) {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const [value, setValue] = useState<number | null>(mine);
  const [hover, setHover] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [nudge, setNudge] = useState(0);
  const [wave, setWave] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef<number | null>(mine);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(mine);
    lastSent.current = mine;
  }, [mine]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const send = async (method: 'POST' | 'DELETE', v: number | null) => {
    setState('saving');
    try {
      const base = `/api/anime/${encodeURIComponent(animeId)}/episode-ratings`;
      const res = await fetch(method === 'POST' ? base : `${base}?episodeNumber=${episodeNumber}&what=retention`, {
        method,
        headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
        body: method === 'POST' ? JSON.stringify({ episodeNumber, retention: v }) : undefined,
      });
      const body = await res.json().catch(() => ({} as { error?: string; code?: string; summary?: EpisodeRetentionSummary }));
      if (!res.ok) {
        if (body.code === 'PHONE_NOT_VERIFIED') promptPhoneVerification('rate');
        else showToast(body.error || 'Could not save your rating.', 'error');
        setValue(lastSent.current);
        setState('idle');
        return;
      }
      lastSent.current = v;
      notifyCommunityScoresChanged();
      if (body.summary) onSaved(body.summary);
      setState('saved');
      if (v !== null) setWave((k) => k + 1);
      setTimeout(() => setState('idle'), 1400);
    } catch {
      showToast('Could not reach the server. Please try again.', 'error');
      setValue(lastSent.current);
      setState('idle');
    }
  };

  const pick = (v: number | null, delay = 450) => {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (v === lastSent.current) return;
      if (v === null) send('DELETE', null);
      else send('POST', v);
    }, delay);
  };

  const signedIn = () => {
    if (user) return true;
    openAuthModal('login');
    return false;
  };

  // Watched first: a locked ramp just says so (and gives a small shake).
  const allowed = () => {
    if (!signedIn()) return false;
    if (!locked) return true;
    setNudge((k) => k + 1);
    showToast(`Mark episode ${episodeNumber} as watched first, then rate it.`, 'info');
    return false;
  };

  // Pointer x → 0–100 in steps of 5. Touching a bar picks that bar's value;
  // the first few px left of the ramp mean 0%.
  const valueAt = (clientX: number) => {
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    const x = clientX - r.left;
    if (x < 4) return 0;
    return snap(Math.ceil((x / Math.max(1, r.width)) * STEPS) * 5);
  };

  const shown = value;
  const avg = community.value;
  const preview = !dragging && hover !== null && hover !== value ? hover : null;
  const tone = shown !== null ? retentionColor(shown) : null;
  const previewTone = preview !== null ? retentionColor(preview) : null;
  const litCount = shown !== null ? shown / 5 : 0;
  const previewCount = preview !== null ? preview / 5 : 0;

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      <div
        ref={trackRef}
        key={nudge}
        className={`${styles.track} ${dragging ? styles.trackActive : ''} ${locked ? styles.trackLocked : ''} ${nudge ? styles.trackNudge : ''}`}
        aria-disabled={locked || undefined}
        role="slider"
        tabIndex={0}
        aria-label={`Episode ${episodeNumber} retention`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value ?? undefined}
        aria-valuetext={value === null ? 'Not rated' : `${value}% — ${retentionLabel(value)}`}
        onPointerDown={(e) => {
          if (!allowed()) return;
          setDragging(true);
          setHover(null);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          pick(valueAt(e.clientX), 100_000); // saved on release
        }}
        onPointerMove={(e) => {
          const v = valueAt(e.clientX);
          if (dragging) {
            if (v !== value) setValue(v);
          } else if (e.pointerType === 'mouse' && !locked) setHover(v);
        }}
        onPointerUp={(e) => {
          if (!dragging) return;
          setDragging(false);
          pick(valueAt(e.clientX), 250);
        }}
        onPointerCancel={() => {
          setDragging(false);
          pick(value, 250);
        }}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(e) => {
          const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key as string];
          if (step === undefined && !['Home', 'End', 'Delete', 'Backspace'].includes(e.key)) return;
          e.preventDefault();
          if (!allowed()) return;
          if (e.key === 'Delete' || e.key === 'Backspace') return pick(null);
          if (e.key === 'Home') return pick(0);
          if (e.key === 'End') return pick(100);
          pick(snap((value ?? 0) + (step ?? 0)));
        }}
        style={{ ['--tone' as string]: tone ?? '#fff', ['--ptone' as string]: previewTone ?? '#fff' }}
      >
        <span className={styles.ramp} key={`w${wave}`} aria-hidden="true">
          {Array.from({ length: STEPS }, (_, i) => {
            const lit = i < litCount;
            const cap = lit && i === litCount - 1;
            const ghost = !lit && i < previewCount;
            const dim = lit && preview !== null && i >= previewCount;
            return (
              <span
                key={i}
                className={`${styles.bar} ${lit ? styles.barLit : ''} ${cap ? styles.barCap : ''} ${ghost ? styles.barGhost : ''} ${dim ? styles.barDim : ''} ${wave && lit ? styles.barWave : ''}`}
                style={{ ['--h' as string]: `${38 + (i / (STEPS - 1)) * 62}%`, ['--i' as string]: i }}
              />
            );
          })}
        </span>
        {avg !== null && (
          <span
            className={styles.avg}
            style={{ left: `${avg}%`, ['--avgc' as string]: retentionColor(avg) }}
            title={`Everyone: ${avg}% (${community.count})`}
            aria-hidden="true"
          />
        )}
      </div>

      <span className={styles.readout} aria-live="polite">
        {preview !== null ? (
          <>
            <strong style={{ color: previewTone! }} className={styles.previewValue}>{preview}%</strong>
            <span className={styles.word}>{retentionLabel(preview)}</span>
          </>
        ) : shown !== null ? (
          <>
            <strong style={{ color: tone! }}>{shown}%</strong>
            <span className={styles.word}>
              {state === 'saving' ? (
                'saving…'
              ) : state === 'saved' ? (
                <span className={styles.saved}>
                  <Check size={11} strokeWidth={3} /> saved
                </span>
              ) : (
                <>
                  {retentionLabel(shown)}
                  {avg !== null && <span className={styles.avgNote}> · avg {avg}%</span>}
                </>
              )}
            </span>
          </>
        ) : locked ? (
          <span className={styles.lockedNote}>
            <Lock size={11} aria-hidden="true" /> Watch first
          </span>
        ) : (
          <span className={styles.empty}>
            Slide to rate
            {avg !== null && <span className={styles.avgNote}> · avg {avg}%</span>}
          </span>
        )}
      </span>

      {value !== null && !locked && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => pick(null)}
          aria-label={`Remove your retention for episode ${episodeNumber}`}
          title="Remove"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
