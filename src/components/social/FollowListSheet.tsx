'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { X, Clapperboard } from 'lucide-react';
import { UserAvatar } from '../ui/UserAvatar';
import { FollowButton } from './FollowButton';
import styles from './FollowListSheet.module.css';

export type FollowListKind = 'followers' | 'following';

interface Person {
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  viewerFollows: boolean | null;
  isViewer: boolean;
  isCreator?: boolean;
  channelName?: string | null;
}

interface FollowListSheetProps {
  username: string;
  kind: FollowListKind | null;
  counts: { followers: number; following: number };
  onKindChange: (kind: FollowListKind) => void;
  onClose: () => void;
  /** The viewer followed / unfollowed someone from this list. */
  onViewerFollowChange?: (username: string, following: boolean) => void;
}

/** Followers / Following of a member, with a follow button on every row. */
export function FollowListSheet({ username, kind, counts, onKindChange, onClose, onViewerFollowChange }: FollowListSheetProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(
    async (which: FollowListKind, before: string | null) => {
      setLoading(true);
      setError(false);
      try {
        const qs = before ? `?before=${encodeURIComponent(before)}` : '';
        const res = await fetch(`/api/users/${encodeURIComponent(username)}/${which}${qs}`, { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setPeople((prev) => (before ? [...prev, ...data.items] : data.items));
        setCursor(data.nextCursor);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [username]
  );

  useEffect(() => {
    if (!kind) return;
    setPeople([]);
    setCursor(null);
    load(kind, null);
  }, [kind, load]);

  useEffect(() => {
    if (!kind) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [kind, onClose]);

  if (!kind || typeof document === 'undefined') return null;

  const tabs: Array<{ key: FollowListKind; label: string; count: number }> = [
    { key: 'followers', label: 'Followers', count: counts.followers },
    { key: 'following', label: 'Following', count: counts.following },
  ];

  return createPortal(
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={`@${username} — ${kind}`}>
        <div className={styles.head}>
          <div className={styles.tabs} role="tablist">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={kind === t.key}
                className={`${styles.tab} ${kind === t.key ? styles.tabOn : ''}`}
                onClick={() => onKindChange(t.key)}
              >
                {t.label} <span className={styles.tabCount}>{t.count.toLocaleString('en-US')}</span>
              </button>
            ))}
          </div>
          <button ref={closeRef} type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <ul className={styles.list}>
          {people.map((p) => (
            <li key={p.username} className={styles.row}>
              <Link href={`/profile/${encodeURIComponent(p.username)}`} className={styles.person} onClick={onClose}>
                <UserAvatar username={p.displayName || p.username} avatarUrl={p.avatarUrl} size={44} />
                <span className={styles.names}>
                  <strong>
                    {p.displayName || p.username}
                    {p.isCreator && (
                      <span className={styles.creator}>
                        <Clapperboard size={11} aria-hidden="true" /> Creator
                      </span>
                    )}
                  </strong>
                  <span>
                    @{p.username}
                    {p.isCreator && p.channelName ? ` · ${p.channelName}` : ''}
                  </span>
                  {p.bio && <em>{p.bio}</em>}
                </span>
              </Link>
              {!p.isViewer && (
                <FollowButton
                  username={p.username}
                  following={Boolean(p.viewerFollows)}
                  size="sm"
                  onChange={(following) => {
                    setPeople((prev) => prev.map((x) => (x.username === p.username ? { ...x, viewerFollows: following } : x)));
                    onViewerFollowChange?.(p.username, following);
                  }}
                />
              )}
            </li>
          ))}
        </ul>

        {!loading && !error && people.length === 0 && (
          <p className={styles.empty}>
            {kind === 'followers' ? `No one follows @${username} yet.` : `@${username} isn't following anyone yet.`}
          </p>
        )}
        {error && (
          <p className={styles.empty}>
            Couldn&apos;t load this list.{' '}
            <button type="button" className={styles.more} onClick={() => load(kind, null)}>
              Try again
            </button>
          </p>
        )}
        {loading && <p className={styles.empty}>Loading…</p>}
        {!loading && cursor && (
          <button type="button" className={styles.more} onClick={() => load(kind, cursor)}>
            Load more
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
