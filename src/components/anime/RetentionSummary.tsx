'use client';

import React from 'react';
import { RetentionBadge } from '../rating/RetentionBadge';
import { RETENTION_BADGES, type RetentionBadgeKey, type RetentionStatus } from '../../lib/rating/retentionScore';
import { retentionColor, retentionLabel } from '../../lib/rating/retentionTone';
import styles from './RetentionSummary.module.css';

type Community = {
  value: number | null;
  members: number;
  ratedEpisodes?: number;
  totalRatings?: number;
  status?: RetentionStatus;
  badge?: RetentionBadgeKey | null;
  needs?: { raters: number; ratedEpisodes: number };
};

/** Ring gauge (the earlier design, back 2026-10-25): the ring fills to the value in its band colour. */
function Ring({ value }: { value: number | null }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className={styles.ringWrap}>
      <svg viewBox="0 0 100 100" className={styles.ring} aria-hidden="true">
        <circle cx="50" cy="50" r={r} className={styles.ringTrack} />
        {value !== null && (
          <circle
            cx="50"
            cy="50"
            r={r}
            className={styles.ringValue}
            stroke={retentionColor(value)}
            strokeDasharray={`${(value / 100) * c} ${c}`}
            transform="rotate(-90 50 50)"
          />
        )}
      </svg>
      <div className={styles.ringCenter}>
        <strong style={value !== null ? { color: retentionColor(value) } : undefined}>{value !== null ? `${value}%` : '—'}</strong>
      </div>
    </div>
  );
}

/**
 * The anime's Retention (replaced the 1–10 "Community Rating" block):
 *  - Community — the ring: the anime score (mean of its rated episodes'
 *    community scores) with its badge once there's enough data, else
 *    Provisional / Not rated;
 *  - You — your own average across the episodes you rated, as a big number;
 *  - By episode — every aired episode's community score, coloured by band
 *    (green → lime → yellow → orange → red), highest and lowest named.
 * Episodes are rated in the Episode Guide (tick watched → rate → Submit).
 */
export function RetentionSummary({
  community,
  mine,
  released,
  signedIn,
  episodes = [],
  onRate,
}: {
  community: Community | null | undefined;
  mine: { value: number | null; episodes: number } | null | undefined;
  released: number;
  signedIn: boolean;
  episodes?: { number: number; retention: number | null; retentionCount: number }[];
  onRate?: () => void;
}) {
  const status: RetentionStatus = community?.status ?? (community?.value != null ? 'provisional' : 'unrated');
  const rated = episodes.filter((e) => e.retention !== null);
  const best = rated.length > 1 ? rated.reduce((a, b) => (b.retention! > a.retention! ? b : a)) : null;
  const worst = rated.length > 1 ? rated.reduce((a, b) => (b.retention! < a.retention! ? b : a)) : null;
  const ratedEps = community?.ratedEpisodes ?? rated.length;
  const totalRatings = community?.totalRatings ?? rated.reduce((s, e) => s + e.retentionCount, 0);
  const members = community?.members ?? 0;
  const needs = community?.needs;

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h3 className={styles.title}>Retention</h3>
        <span className={styles.sub}>How well each episode kept members watching, as members rated it</span>
      </div>

      <div className={styles.pair}>
        {/* Community: everyone's retention for the anime */}
        <div className={styles.community}>
          <Ring value={community?.value ?? null} />
          <div className={styles.side}>
            <span className={styles.label}>Community</span>
            <RetentionBadge status={status} badge={community?.badge ?? null} value={community?.value ?? null} size="sm" />
            <span className={styles.meta}>
              {status === 'unrated'
                ? 'No episode rated yet'
                : `${ratedEps} rated ${ratedEps === 1 ? 'episode' : 'episodes'} · ${totalRatings} ${totalRatings === 1 ? 'rating' : 'ratings'} · ${members} ${members === 1 ? 'member' : 'members'}`}
            </span>
          </div>
        </div>

        {/* You: your own average, kept apart from the community's */}
        <div className={styles.you}>
          <span className={styles.label}>You</span>
          {mine?.value != null ? (
            <>
              <strong className={styles.big} style={{ color: retentionColor(mine.value) }}>
                {mine.value}
                <span className={styles.pct}>%</span>
              </strong>
              <span className={styles.meta}>
                {retentionLabel(mine.value)} · {mine.episodes} of {released} {released === 1 ? 'episode' : 'episodes'} rated
              </span>
            </>
          ) : (
            <>
              <strong className={`${styles.big} ${styles.bigEmpty}`}>—</strong>
              <span className={styles.meta}>
                {signedIn ? 'Tick an episode you watched in the Episode Guide, then rate it.' : 'Sign in to rate episodes.'}
              </span>
            </>
          )}
        </div>
      </div>


      {/* Episode by episode, coloured by band */}
      {released > 1 && (
        <div className={styles.chartBlock}>
          <div className={styles.chartHead}>
            <span>By episode</span>
            {best && worst && best.number !== worst.number && (
              <span className={styles.extremes}>
                Highest <strong style={{ color: retentionColor(best.retention!) }}>Ep {best.number} · {best.retention}% {retentionLabel(best.retention!)}</strong>
                <i aria-hidden="true">·</i>
                Lowest <strong style={{ color: retentionColor(worst.retention!) }}>Ep {worst.number} · {worst.retention}% {retentionLabel(worst.retention!)}</strong>
              </span>
            )}
          </div>
          <div className={styles.chart} role="img" aria-label={`Retention by episode: ${rated.length} of ${released} episodes rated`}>
            {episodes.map((e) => (
              <span
                key={e.number}
                className={styles.col}
                title={
                  e.retention !== null
                    ? `Episode ${e.number}: ${e.retention}% (${retentionLabel(e.retention)}) · ${e.retentionCount} ${e.retentionCount === 1 ? 'rating' : 'ratings'}`
                    : `Episode ${e.number}: not rated yet`
                }
              >
                {e.retention !== null ? (
                  <span className={styles.barFill} style={{ height: `${Math.max(4, e.retention)}%`, background: retentionColor(e.retention) }} />
                ) : (
                  <span className={styles.barEmpty} />
                )}
              </span>
            ))}
          </div>
          <div className={styles.axis} aria-hidden="true">
            <span>EP 1</span>
            <span>EP {episodes.length ? episodes[episodes.length - 1].number : released}</span>
          </div>
          <div className={styles.legend} aria-hidden="true">
            {RETENTION_BADGES.map((b) => (
              <span key={b.key}>
                <i style={{ background: b.color }} />
                {b.label} {b.from === 0 ? '1–19' : b.key === 'HOOKED' ? '90+' : `${b.from}–${b.from === 70 ? 89 : b.from === 40 ? 69 : 39}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {onRate && released > 0 && (
        <button type="button" className={styles.cta} onClick={onRate}>
          {mine?.value != null ? 'Rate another episode' : 'Rate an episode'}
        </button>
      )}
    </div>
  );
}
