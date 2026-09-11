'use client';

import React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import styles from './CommunityTeaser.module.css';

interface DiscussionThread {
  id: string;
  title?: string;
  author?: {
    username?: string;
  };
  replyCount?: number;
  createdAt?: string;
}

interface CommunityTeaserProps {
  animeTitle: string;
  discussions?: DiscussionThread[];
}

const relativeTime = (iso?: string) => {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const minutes = Math.round((Date.now() - then) / 60_000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return rtf.format(-days, 'day');
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Real discussion threads about this anime, or an empty state. It used to
 * fall back to two invented threads ("What did you think of the ending?",
 * 1,240 replies) by invented users, and to "42 replies" for any thread
 * without a count.
 */
export const CommunityTeaser: React.FC<CommunityTeaserProps> = ({ animeTitle, discussions = [] }) => {
  const items = discussions.filter((d) => d && d.id).slice(0, 3);

  return (
    <div className={styles.card} role="region" aria-label="Community Discussions">
      <div className={styles.headerRow}>
        <h3 className={styles.headerTitle}>Community Discussions</h3>
        <Link href="/discussions" className={styles.viewAllLink}>
          <span>View All</span>
          <ChevronRight size={12} aria-hidden="true" />
        </Link>
      </div>

      {items.length === 0 ? (
        <p className={styles.discussionMeta}>No discussions about {animeTitle} yet.</p>
      ) : (
        <div className={styles.discussionsList}>
          {items.map((disc) => {
            const author = disc.author?.username || null;
            const replies = typeof disc.replyCount === 'number' ? disc.replyCount : null;
            const when = relativeTime(disc.createdAt);
            const meta = [
              author ? `by ${author}` : null,
              replies !== null ? `${replies} ${replies === 1 ? 'reply' : 'replies'}` : null,
              when,
            ].filter(Boolean).join(' · ');

            return (
              <Link key={disc.id} href={`/discussions/${disc.id}`} className={styles.discussionItem}>
                <div className={styles.itemLeft}>
                  <div className={styles.avatar} aria-hidden="true">
                    <span>{(author || '?').slice(0, 2).toUpperCase()}</span>
                  </div>
                  <div className={styles.textBlock}>
                    <span className={styles.discussionTitle}>{disc.title || 'Untitled discussion'}</span>
                    {meta && <span className={styles.discussionMeta}>{meta}</span>}
                  </div>
                </div>
                {replies !== null && (
                  <span className={styles.repliesBadge} aria-hidden="true">
                    {new Intl.NumberFormat(undefined, { notation: 'compact' }).format(replies)}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
