'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from './PremiereCountdown.module.css';

/** The bar fills across the final day before the premiere. */
const WINDOW_MS = 24 * 60 * 60 * 1000;

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Live countdown to an anime's first episode (same idea as the homepage's
 * "Premiering soon" bar). Calls `onArrived` once when the time is reached, so
 * the page can unlock rating without a reload.
 */
export function PremiereCountdown({ airingAt, episodeNumber, onArrived }: { airingAt: string; episodeNumber: number; onArrived: () => void }) {
  const target = new Date(airingAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  const fired = useRef(false);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const ms = now === null ? null : target - now;
  useEffect(() => {
    if (ms !== null && ms <= 0 && !fired.current) {
      fired.current = true;
      onArrived();
    }
  }, [ms, onArrived]);

  if (ms === null) return null;
  const p = parts(ms);
  const fill = Math.min(100, Math.max(0, 100 - (ms / WINDOW_MS) * 100));
  const local = new Date(target).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div className={styles.wrap} role="timer" aria-live="off">
      <div className={styles.row}>
        <span className={styles.label}>{ms > 0 ? `Episode ${episodeNumber} airs in` : `Episode ${episodeNumber} is airing now`}</span>
        <span className={styles.when}>{local}</span>
      </div>
      {ms > 0 && (
        <div className={styles.clock} aria-label={`${p.d} days ${p.h} hours ${p.m} minutes`}>
          {p.d > 0 && (
            <span>
              <strong>{p.d}</strong>d
            </span>
          )}
          <span>
            <strong>{pad(p.h)}</strong>h
          </span>
          <span>
            <strong>{pad(p.m)}</strong>m
          </span>
          <span>
            <strong>{pad(p.s)}</strong>s
          </span>
        </div>
      )}
      <div className={styles.bar} aria-hidden="true">
        <span style={{ width: `${ms > 0 ? fill : 100}%` }} />
      </div>
    </div>
  );
}
