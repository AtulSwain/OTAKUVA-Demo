'use client';

import React from 'react';
import { retentionColor, retentionLabel, retentionSoftColor } from '../../lib/rating/retentionTone';
import styles from './RetentionSummary.module.css';

/** Ring gauge for a percentage, coloured by the retention bands. */
function Gauge({ value, label, sub }: { value: number | null; label: string; sub: string }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const pct = value ?? 0;
  return (
    <div className={styles.gauge}>
      <svg viewBox="0 0 84 84" className={styles.ring} aria-hidden="true">
        <circle cx="42" cy="42" r={r} className={styles.ringTrack} />
        {value !== null && (
          <circle
            cx="42"
            cy="42"
            r={r}
            className={styles.ringValue}
            stroke={retentionColor(value)}
            strokeDasharray={`${(pct / 100) * c} ${c}`}
            transform="rotate(-90 42 42)"
          />
        )}
      </svg>
      <div className={styles.gaugeCenter}>
        <strong style={value !== null ? { color: retentionColor(value) } : undefined}>{value !== null ? `${value}%` : '—'}</strong>
      </div>
      <div className={styles.gaugeText}>
        <span className={styles.label}>{label}</span>
        {value !== null && (
          <span className={styles.band} style={{ color: retentionColor(value), background: retentionSoftColor(value) }}>
            {retentionLabel(value)}
          </span>
        )}
        <span className={styles.meta}>{sub}</span>
      </div>
    </div>
  );
}

/**
 * Retention for the whole anime, beside the Community Rating: the community
 * figure (each member's average across the episodes they rated, averaged over
 * members) and the viewer's own, as ring gauges — plus every episode's
 * retention as a small coloured bar chart. Rated per episode in the Episode
 * Guide.
 */
export function RetentionSummary({
  community,
  mine,
  released,
  signedIn,
  episodes = [],
  onRate,
}: {
  community: { value: number | null; members: number } | null | undefined;
  mine: { value: number | null; episodes: number } | null | undefined;
  released: number;
  signedIn: boolean;
  /** Per-episode community retention, for the mini chart. */
  episodes?: { number: number; retention: number | null; retentionCount: number }[];
  /** Opens the rating window for the next episode worth rating. */
  onRate?: () => void;
}) {
  const rated = episodes.filter((e) => e.retention !== null);
  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h3 className={styles.title}>Retention</h3>
        <span className={styles.sub}>How well each episode kept people watching</span>
      </div>

      <div className={styles.gauges}>
        <Gauge
          value={community?.value ?? null}
          label="Community"
          sub={community?.value != null ? `${community.members} ${community.members === 1 ? 'member' : 'members'}` : 'No episode ratings yet'}
        />
        <Gauge
          value={mine?.value ?? null}
          label="You"
          sub={
            mine?.value != null
              ? `${mine.episodes} of ${released} ${released === 1 ? 'episode' : 'episodes'}`
              : signedIn
                ? 'Rate an episode below'
                : 'Sign in to rate episodes'
          }
        />
      </div>

      {/* Every episode at a glance */}
      {released > 1 && (
        <div className={styles.chartBlock}>
          <div className={styles.chart} role="img" aria-label={`Retention by episode: ${rated.length} of ${released} episodes rated`}>
            {episodes.map((e) => (
              <span
                key={e.number}
                className={styles.col}
                title={e.retention !== null ? `Episode ${e.number}: ${e.retention}% (${e.retentionCount})` : `Episode ${e.number}: not rated yet`}
              >
                <span
                  className={e.retention !== null ? styles.barFill : styles.barEmpty}
                  style={e.retention !== null ? { height: `${Math.max(6, e.retention)}%`, background: retentionColor(e.retention) } : undefined}
                />
              </span>
            ))}
          </div>
          <div className={styles.axis} aria-hidden="true">
            <span>EP 1</span>
            <span>EP {episodes.length ? episodes[episodes.length - 1].number : released}</span>
          </div>
          <div className={styles.legend} aria-hidden="true">
            <span><i style={{ background: '#22C55E' }} /> 40%+</span>
            <span><i style={{ background: '#FACC15' }} /> under 40%</span>
            <span><i style={{ background: '#EF4444' }} /> 20% or less</span>
          </div>
        </div>
      )}

      {onRate && released > 0 && (
        <button type="button" className={styles.cta} onClick={onRate}>
          {mine?.value != null ? 'Rate another episode' : 'Rate episode retention'}
        </button>
      )}
    </div>
  );
}
