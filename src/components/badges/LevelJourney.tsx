'use client';

import { useEffect, useRef, useState } from 'react';
import { TIERS, progressToNext, tierIndex } from '../../lib/badges/tiers';
import { glossFor } from '../../lib/badges/strings';
import Seal from './Seal';
import BadgeTooltip from './BadgeTooltip';
import { tierVars } from './tierStyle';
import styles from './LevelJourney.module.css';

/**
 * Every reviewer level on one path: earned seals in colour, the current one
 * raised and glowing, the next one showing how close it is, later ones
 * waiting greyed out. Plays its fill-in animation once, the first time it
 * scrolls into view. Thresholds come from tiers.ts — nothing is hard-coded.
 */
/** The rail's colour runs through every earned tier's own colour, from tiers.ts. */
const RAIL_GRADIENT = `linear-gradient(90deg, ${TIERS.filter((t) => t.fill)
  .map((t) => (t.special ? t.stroke ?? t.fill : t.dark?.stroke ?? t.dark?.fill ?? t.fill))
  .join(', ')})`;

/** A stable, slightly crooked angle per level — a hand-pressed stamp is never perfectly straight. */
const STAMP_TILT = [0, -7, 5, -4, 8, -6, 3, -8, 6];

export default function LevelJourney({ count, celebrateFor }: { count: number; celebrateFor?: string }) {
  const progress = progressToNext(count);
  const cur = tierIndex(progress.current);
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
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

  // How far along the whole path the line is filled: every earned step, plus the part-way step to the next.
  const steps = TIERS.length - 1;
  const filled = progress.next ? (cur + progress.fraction) / steps : 1;

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
            <CountUp to={progress.remaining} run={visible} /> {progress.remaining === 1 ? 'review' : 'reviews'} to{' '}
            <strong>{progress.next.name}</strong>
          </span>
        ) : (
          <span className={styles.nextHint}>Every level unlocked. Legendary.</span>
        )}
      </div>

      <div ref={trackRef} className={styles.scroller}>
        <div className={styles.inner} style={{ ['--fill' as string]: String(filled), ['--rail-gradient' as string]: RAIL_GRADIENT }}>
        <span className={styles.rail} aria-hidden="true">
          <span className={styles.railFill} />
        </span>
        <ol className={styles.track}>
        {TIERS.map((t, i) => {
          const state = i < cur ? 'earned' : i === cur ? 'current' : i === cur + 1 ? 'next' : 'locked';
          // Every level reached with ink (not the starting level) carries its stamp.
          const stamped = i <= cur && t.fill !== null;
          return (
            <li
              key={t.key}
              className={`${styles.step} ${styles[state]} ${stamped ? styles.stamped : ''} ${fresh === i ? styles.fresh : ''}`}
              style={{ ...tierVars(t), ['--i' as string]: String(i), ['--tilt' as string]: `${STAMP_TILT[i] ?? 0}deg` }}
              data-current={state === 'current' ? 'true' : undefined}
            >
              <BadgeTooltip tier={t}>
                <span className={styles.sealWrap}>
                  {state === 'current' && <span className={styles.halo} aria-hidden="true" />}
                  {fresh === i && <span className={styles.ink} aria-hidden="true" />}
                  <span className={styles.stamp}>
                    <Seal
                      tier={t}
                      size={state === 'current' ? 60 : 44}
                      blank={i > cur}
                      decorative={state !== 'current'}
                      count={state === 'current' ? count : undefined}
                    />
                  </span>
                </span>
              </BadgeTooltip>
              <span className={styles.name}>{t.name}</span>
              <span className={styles.req}>
                {state === 'current' ? (
                  <span className={styles.here}>You</span>
                ) : state === 'earned' ? (
                  glossFor(t.glossKey)
                ) : t.min === 0 ? (
                  'Start'
                ) : (
                  `${t.min.toLocaleString('en-US')} reviews`
                )}
              </span>
            </li>
          );
        })}
        </ol>
        </div>
      </div>
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
