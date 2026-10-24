'use client';

import React, { useEffect, useRef, useState } from 'react';
import { notifyCommunityScoresChanged } from '../../lib/rating/useCommunityScore';
import { X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { promptPhoneVerification } from '../auth/VerifyPhonePrompt';
import type { EpisodeRetentionSummary } from '../rating/EpisodeRetentionModal';
import { retentionColor, retentionSoftColor } from '../../lib/rating/retentionTone';
import styles from './RetentionSlider.module.css';

/**
 * One episode's retention, always visible in its Episode Guide row: a
 * segmented 0–100% capsule the member drags (steps of 5, one segment each,
 * coloured by `retentionTone`). It saves by itself a moment after they let
 * go. A notch marks everyone's average (redesigned 2026-10-21).
 */
const SEGMENTS = Array.from({ length: 20 }, (_, i) => i + 1);

export function RetentionSlider({
  animeId,
  episodeNumber,
  mine,
  community,
  onSaved,
}: {
  animeId: string;
  episodeNumber: number;
  mine: number | null;
  community: { value: number | null; count: number };
  onSaved: (summary: EpisodeRetentionSummary) => void;
}) {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const [value, setValue] = useState<number | null>(mine);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSent = useRef<number | null>(mine);

  // Follow the server's value when it changes (another tab, a removal…).
  useEffect(() => {
    setValue(mine);
    lastSent.current = mine;
  }, [mine]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const request = async (method: 'POST' | 'DELETE', v: number | null) => {
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
      setTimeout(() => setState('idle'), 1400);
    } catch {
      showToast('Could not reach the server. Please try again.', 'error');
      setValue(lastSent.current);
      setState('idle');
    }
  };

  const change = (v: number) => {
    setValue(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (v !== lastSent.current) request('POST', v);
    }, 600);
  };

  const guard = (e: React.SyntheticEvent) => {
    if (!user) {
      e.preventDefault();
      openAuthModal('login');
      return true;
    }
    return false;
  };

  const shown = value ?? 0;
  const tone = value === null ? null : retentionColor(value);
  return (
    <div className={styles.wrap} onClick={(e) => e.stopPropagation()}>
      {/* A capsule of twenty 5% segments that light up in the retention's
          colour; the real range input sits on top for drag/keyboard/a11y. */}
      <div
        className={`${styles.capsule} ${value === null ? styles.capsuleIdle : ''}`}
        style={{
          ['--tone' as string]: tone ?? 'rgba(255,255,255,0.5)',
          ['--avg' as string]: community.value !== null ? retentionColor(community.value) : 'transparent',
        }}
      >
        <span className={styles.segments} aria-hidden="true">
          {SEGMENTS.map((i) => (
            <span
              key={i}
              className={
                value !== null && shown >= i * 5
                  ? styles.segOn
                  : community.value !== null && community.value >= i * 5
                  ? `${styles.seg} ${styles.segAvg}`
                  : styles.seg
              }
            />
          ))}
          {community.value !== null && (
            <span
              className={styles.mark}
              style={{ left: `${community.value}%`, ['--mark' as string]: retentionColor(community.value) }}
              title={`Everyone: ${community.value}% (${community.count})`}
              aria-hidden="true"
            />
          )}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={shown}
          onPointerDown={guard}
          onKeyDown={(e) => {
            if (!user) guard(e);
          }}
          onChange={(e) => change(Number(e.target.value))}
          className={`${styles.slider} ${value === null ? styles.unset : ''}`}
          aria-label={`Episode ${episodeNumber} retention, percent`}
          aria-valuetext={value === null ? 'Not rated' : `${value}%`}
        />
      </div>
      <div className={styles.readout}>
        <strong
          className={value === null ? styles.pillIdle : styles.pill}
          style={value === null ? undefined : { color: retentionColor(value), background: retentionSoftColor(value) }}
        >
          {value === null ? (
            'Rate'
          ) : (
            <>
              <i style={{ background: tone! }} aria-hidden="true" />
              {value}%
            </>
          )}
        </strong>
        <span className={styles.everyone}>
          {state === 'saving' ? (
            'Saving…'
          ) : state === 'saved' ? (
            'Saved ✓'
          ) : community.value !== null ? (
            <>
              <span className={styles.dot} style={{ background: retentionColor(community.value) }} aria-hidden="true" />
              Avg {community.value}%
            </>
          ) : (
            'No ratings yet'
          )}
        </span>
      </div>
      {value !== null && (
        <button
          type="button"
          className={styles.clear}
          onClick={() => {
            if (timer.current) clearTimeout(timer.current);
            if (lastSent.current === null) setValue(null);
            else request('DELETE', null).then(() => setValue(null));
          }}
          aria-label={`Remove your retention for episode ${episodeNumber}`}
          title="Remove"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
