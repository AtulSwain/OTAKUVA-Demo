'use client';

/**
 * "Creators on this anime" (2026-10-24): creators who rated, reviewed or are
 * hyped for this anime — visible to everyone, followers or not, with a
 * Follow button on each. Biggest audience first. A notification link
 * (?creator=<username>#creators) highlights that creator's card.
 * Renders nothing when no creator has touched the anime.
 */
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Clapperboard, Flame, MessageSquare, Star } from 'lucide-react';
import { UserAvatar } from '../ui/UserAvatar';
import { FollowButton } from '../social/FollowButton';
import { getScoreColor } from '../../lib/rating/ratingTiers';
import styles from './AnimeCreators.module.css';

interface CreatorItem {
  username: string;
  displayName: string | null;
  channelName: string | null;
  avatarUrl: string | null;
  followerCount: number;
  rating: number | null;
  review: { id: string; title: string } | null;
  hyped: boolean;
  viewerFollows: boolean | null;
  isViewer: boolean;
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export function AnimeCreators({ animeId, animeTitle }: { animeId: string; animeTitle: string }) {
  const [items, setItems] = useState<CreatorItem[]>([]);
  const [highlight, setHighlight] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/anime/${encodeURIComponent(animeId)}/creators`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { creators: [] }))
      .then((d) => !cancelled && setItems(d.creators || []))
      .catch(() => {});
    setHighlight(new URLSearchParams(window.location.search).get('creator'));
    return () => {
      cancelled = true;
    };
  }, [animeId]);

  // Arriving from a notification: bring the section into view once it exists.
  useEffect(() => {
    if (items.length && window.location.hash === '#creators') rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <section ref={rootRef} id="creators" className={styles.section} aria-label={`Creators on ${animeTitle}`}>
      <div className={styles.head}>
        <h2 className={styles.title}>
          <Clapperboard size={18} aria-hidden="true" /> Creators on this anime
        </h2>
        <span className={styles.sub}>
          {items.length} creator{items.length === 1 ? '' : 's'} rated, reviewed or are hyped
        </span>
      </div>
      <ul className={styles.rail}>
        {items.map((c) => (
          <li key={c.username} className={`${styles.card} ${highlight === c.username ? styles.cardHighlight : ''}`}>
            <Link href={`/profile/${encodeURIComponent(c.username)}`} className={styles.person}>
              <UserAvatar username={c.displayName || c.username} avatarUrl={c.avatarUrl} size={52} />
              <span className={styles.names}>
                <strong>{c.channelName || c.displayName || c.username}</strong>
                <span>
                  @{c.username} · {compact.format(c.followerCount)} follower{c.followerCount === 1 ? '' : 's'}
                </span>
              </span>
            </Link>
            <div className={styles.did}>
              {c.rating != null && (
                <span className={styles.chip} style={{ color: getScoreColor(c.rating) }}>
                  <Star size={12} fill="currentColor" stroke="none" aria-hidden="true" /> {c.rating.toFixed(1)}
                </span>
              )}
              {c.review && (
                <a href={`#review-${c.review.id}`} className={styles.chip} title={c.review.title}>
                  <MessageSquare size={12} aria-hidden="true" /> Reviewed
                </a>
              )}
              {c.hyped && (
                <span className={`${styles.chip} ${styles.chipHype}`}>
                  <Flame size={12} aria-hidden="true" /> Hyped
                </span>
              )}
            </div>
            {!c.isViewer && (
              <FollowButton
                username={c.username}
                following={Boolean(c.viewerFollows)}
                size="sm"
                onChange={(following, followerCount) =>
                  setItems((prev) =>
                    prev.map((x) =>
                      x.username === c.username
                        ? {
                            ...x,
                            viewerFollows: following,
                            followerCount: followerCount ?? Math.max(0, x.followerCount + (following === Boolean(x.viewerFollows) ? 0 : following ? 1 : -1)),
                          }
                        : x
                    )
                  )
                }
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
