'use client';

import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { TIERS, progressToNext, tierIndex } from '../../lib/badges/tiers';
import { glossFor } from '../../lib/badges/strings';
import Seal from './Seal';
import BadgeInfoSheet from './BadgeInfoSheet';
import type { Tier } from '../../lib/badges/tiers';
import { tierVars } from './tierStyle';
import styles from './LevelJourney.module.css';

/**
 * Every reviewer level on one path: reached seals in their own colour (with a
 * soft glow), the current one raised, levels not reached yet left blank.
 * Between two seals sits a short connector — never a line running under the
 * seals (2026-10-27) — filled in the colour of the level it leads to: full
 * once reached, part-way for the level you're working toward, dashed after.
 * Plays its fill-in animation once, the first time it scrolls into view.
 * Thresholds and colours come from tiers.ts — nothing is hard-coded.
 */
const SEAL_SIZE = { current: 60, other: 44 };

/** A stable, slightly crooked angle per level — a hand-pressed stamp is never perfectly straight. */
const STAMP_TILT = [0, -7, 5, -4, 8, -6, 3, -8, 6];

export default function LevelJourney({ count, celebrateFor }: { count: number; celebrateFor?: string }) {
  const progress = progressToNext(count);
  const cur = tierIndex(progress.current);
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  // Tap a badge (earned or not) to read what it is and takes (2026-10-27).
  const [info, setInfo] = useState<Tier | null>(null);
  // The owner's newest stamp, pressed on once: the first visit after reaching it.
  const [fresh, setFresh] = useState<number | null>(null);
  useEffect(() => {
    if (!celebrateFor || cur < 1) return;
    const key = `otakuva:stamp-seen:${celebrateFor}`;
    try {
      const seen = Number(localStorage.getItem(key) ?? -1);
      if (cur > seen) setFresh(cur);
      localStorage.setItem(key, String(cur));
    } catch {
      /* storage blocked: no celebration, nothing else changes */
    }
  }, [celebrateFor, cur]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // On narrow screens the path scrolls sideways: bring the current level into view.
  useEffect(() => {
    const track = trackRef.current;
    const here = track?.querySelector<HTMLElement>('[data-current="true"]');
    if (!track || !here) return;
    track.scrollLeft = here.offsetLeft - track.clientWidth / 2 + here.clientWidth / 2;
  }, [cur]);

  const radius = (i: number) => (i === cur ? SEAL_SIZE.current : SEAL_SIZE.other) / 2;

  return (
    <div ref={rootRef} className={`${styles.journey} ${visible ? styles.play : ''}`}>
      <div className={styles.summary}>
        <span className={styles.levelNo}>
          Level <strong>{cur + 1}</strong> of {TIERS.length}
        </span>
        {fresh !== null && (
          <span className={styles.freshNote} style={tierVars(TIERS[fresh])} role="status">
            Stamp earned: <strong>{TIERS[fresh].name}</strong>
          </span>
        )}
        {progress.next ? (
          <span className={styles.nextHint} style={tierVars(progress.next)}>
            <CountUp to={progress.remaining} run={visible} /> more {progress.remaining === 1 ? 'review or rating' : 'reviews or ratings'} to{' '}
            <strong>{progress.next.name}</strong>
          </span>
        ) : (
          <span className={styles.nextHint}>Every level unlocked. Legendary.</span>
        )}
      </div>

      <div ref={trackRef} className={styles.scroller}>
        <div className={styles.inner}>
        <ol className={styles.track}>
        {TIERS.map((t, i) => {
          const state = i < cur ? 'earned' : i === cur ? 'current' : i === cur + 1 ? 'next' : 'locked';
          // Every level reached with ink (not the starting level) carries its stamp.
          const stamped = i <= cur && t.fill !== null;
          // The connector into this level: full once reached, part-way for the next one.
          const part = i <= cur ? 1 : i === cur + 1 && progress.next ? progress.fraction : 0;
          return (
            <li
              key={t.key}
              className={`${styles.step} ${styles[state]} ${i <= cur ? styles.reached : ''} ${stamped ? styles.stamped : ''} ${fresh === i ? styles.fresh : ''}`}
              style={{
                ...tierVars(t),
                ['--i' as string]: String(i),
                ['--tilt' as string]: `${STAMP_TILT[i] ?? 0}deg`,
                ['--r' as string]: `${radius(i)}px`,
                ['--pr' as string]: `${i > 0 ? radius(i - 1) : 0}px`,
                ['--part' as string]: String(part),
              }}
              data-current={state === 'current' ? 'true' : undefined}
            >
              {i > 0 && (
                <span className={`${styles.link} ${part === 0 ? styles.linkLocked : ''}`} aria-hidden="true">
                  <span className={styles.linkFill} />
                </span>
              )}
              <button type="button" className={styles.sealBtn} onClick={() => setInfo(t)} aria-label={`About the ${t.name} badge`}>
                <span className={styles.sealWrap}>
                  {state === 'current' && <span className={styles.halo} aria-hidden="true" />}
                  {fresh === i && <span className={styles.ink} aria-hidden="true" />}
                  {i > 0 && i <= cur && (
                    <span className={styles.collectedTick} title="Collected" aria-label="Collected">
                      <Check size={10} strokeWidth={3.5} aria-hidden="true" />
                    </span>
                  )}
                  <span className={styles.stamp}>
                    <Seal
                      tier={t}
                      size={state === 'current' ? SEAL_SIZE.current : SEAL_SIZE.other}
                      blank={i > cur}
                      decorative={state !== 'current'}
                      count={state === 'current' ? count : undefined}
                    />
                  </span>
                </span>
              </button>
              <span className={styles.name}>{t.name}</span>
              <span className={styles.req}>
                {state === 'current' ? (
                  <span className={styles.here}>You</span>
                ) : state === 'earned' ? (
                  i > 0 ? <span className={styles.collectedLabel}>Collected</span> : glossFor(t.glossKey)
                ) : t.min === 0 ? (
                  'Start'
                ) : (
                  `At ${t.min.toLocaleString('en-US')}`
                )}
              </span>
            </li>
          );
        })}
        </ol>
        </div>
      </div>
      {info && <BadgeInfoSheet tier={info} count={count} onClose={() => setInfo(null)} />}
    </div>
  );
}

/** Counts up from 0 to `to` once `run` turns true (instantly with reduced motion). */
function CountUp({ to, run }: { to: number; run: boolean }) {
  const [n, setN] = useState(to);
  useEffect(() => {
    if (!run) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches || to <= 0) {
      setN(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = 900;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setN(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, run]);
  return <span className={styles.num}>{n.toLocaleString('en-US')}</span>;
}
