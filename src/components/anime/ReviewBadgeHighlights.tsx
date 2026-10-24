'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import BadgeChip from '../badges/BadgeChip';
import BadgeDistribution from '../badges/BadgeDistribution';
import { UserAvatar } from '../ui/UserAvatar';
import { pluralize } from '../../lib/badges/format';
import type { AnimeReviewHighlights, HighlightReview } from '../../lib/badges/reviewHighlights';
import styles from './ReviewBadgeHighlights.module.css';

type View = 'top' | 'critics';

interface Props {
  animeId: string;
  animeTitle: string;
}

function ReviewRow({ r }: { r: HighlightReview }) {
  return (
    <li className={styles.row}>
      <UserAvatar username={r.user.username} avatarUrl={r.user.avatarUrl} size={36} />
      <div className={styles.rowBody}>
        <div className={styles.rowHead}>
          <Link href={`/profile/${r.user.username}`} className={styles.name}>
            {r.user.username}
          </Link>
          <BadgeChip tier={r.user.tier} count={r.user.reviewCount} />
          <span className={styles.count}>{pluralize(r.user.reviewCount, 'review')}</span>
        </div>
        <p className={styles.snippet}>{r.snippet}</p>
      </div>
    </li>
  );
}

/**
 * Badge-aware summary above the full review list: how many reviews come from
 * each reviewer badge (cached counts), top reviews with a Critics filter, and
 * a "rising" slot so newer reviewers are not buried. A badge hints at
 * experience; it does not certify a review as correct.
 */
export function ReviewBadgeHighlights({ animeId, animeTitle }: Props) {
  const [view, setView] = useState<View>('top');
  const [data, setData] = useState<AnimeReviewHighlights | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    fetch(`/api/anime/${encodeURIComponent(animeId)}/review-highlights?view=${view}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [animeId, view]);

  if (failed || !data) return null;
  const hasBadgedReviews = Object.values(data.distribution).some((n) => n > 0);
  // Nothing worth a panel (no badge breakdown, no top or rising reviews): show
  // nothing rather than an empty "No counted reviews yet." box. Once someone
  // has switched to Critics, keep the panel so they can switch back.
  if (!hasBadgedReviews && data.reviews.length === 0 && data.rising.length === 0 && view === 'top') return null;

  return (
    <section className={styles.wrap} aria-label="Reviews by reviewer badge">
      <header className={styles.header}>
        <h3 className={styles.title}>{animeTitle}</h3>
        <span className={styles.total}>{pluralize(data.totalWritten, 'written review')}</span>
      </header>

      {hasBadgedReviews && (
        <div className={styles.block}>
          <h4 className={styles.blockTitle}>Reviews by reviewer badge</h4>
          <BadgeDistribution counts={data.distribution} />
        </div>
      )}

      <div className={styles.block}>
        <div className={styles.blockHead}>
          <h4 className={styles.blockTitle}>{view === 'critics' ? 'Critics' : 'Top reviews'}</h4>
          <div className={styles.seg} role="tablist" aria-label="Review filter">
            {(['top', 'critics'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className={`${styles.segBtn} ${view === v ? styles.segBtnOn : ''}`}
                onClick={() => setView(v)}
              >
                {v === 'top' ? 'Top' : 'Critics'}
              </button>
            ))}
          </div>
        </div>
        {data.reviews.length > 0 ? (
          <ul className={styles.list}>
            {data.reviews.map((r) => (
              <ReviewRow key={r.id} r={r} />
            ))}
          </ul>
        ) : (
          <p className={styles.empty}>
            {view === 'critics' ? 'No critics have reviewed this yet.' : 'No counted reviews yet.'}
          </p>
        )}
      </div>

      {data.rising.length > 0 && (
        <div className={styles.block}>
          <h4 className={styles.blockTitle}>Rising reviews</h4>
          <ul className={styles.list}>
            {data.rising.map((r) => (
              <ReviewRow key={r.id} r={r} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
