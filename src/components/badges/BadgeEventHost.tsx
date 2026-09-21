'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import { isTierKey, type TierKey } from '../../lib/badges/tiers';
import { BADGE_STRINGS } from '../../lib/badges/strings';
import BadgeUnlockToast from './BadgeUnlockToast';
import styles from './BadgeEventHost.module.css';

interface BadgeEvent {
  id: string;
  type: 'TIER_EARNED' | 'MILESTONE';
  tierKey?: string;
  title: string;
  body?: string;
}

export interface CompletedDetail {
  slug: string;
  title?: string;
}

/** Fired by LibraryContext when the user marks a series completed. */
export const COMPLETED_EVENT = 'otakuva:anime-completed';

/**
 * Shows unseen tier-earned / milestone events once (marking them seen as soon
 * as they are displayed), and offers a "write a review" prompt when a series
 * is marked completed. Mounted once in the app shell.
 */
export function BadgeEventHost() {
  const { user } = useAuth();
  const pathname = usePathname();
  const [queue, setQueue] = useState<BadgeEvent[]>([]);
  const [prompt, setPrompt] = useState<CompletedDetail | null>(null);
  const shown = useRef(new Set<string>());

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/me/badge-events');
      if (!res.ok) return;
      const { events } = (await res.json()) as { events: BadgeEvent[] };
      const fresh = events.filter((e) => !shown.current.has(e.id));
      if (!fresh.length) return;
      fresh.forEach((e) => shown.current.add(e.id));
      setQueue((q) => [...q, ...fresh]);
      // Seen as soon as displayed: an event never toasts twice, even after a reload.
      fetch('/api/me/badge-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: fresh.map((e) => e.id) }),
      }).catch(() => {});
    } catch {
      // Purely a nicety: never surface an error for it.
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load, pathname]);

  useEffect(() => {
    const onDone = (e: Event) => setPrompt((e as CustomEvent<CompletedDetail>).detail);
    window.addEventListener(COMPLETED_EVENT, onDone);
    return () => window.removeEventListener(COMPLETED_EVENT, onDone);
  }, []);

  const current = queue[0];
  const dismiss = useCallback(() => setQueue((q) => q.slice(1)), []);

  if (!user) return null;
  return (
    <div className={styles.host}>
      {current && (
        <BadgeUnlockToast
          key={current.id}
          tier={(current.type === 'TIER_EARNED' && isTierKey(current.tierKey) ? current.tierKey : 'shoshinsha') as TierKey}
          title={current.title}
          body={current.body}
          onClose={dismiss}
        />
      )}
      {prompt && (
        <div className={styles.prompt} role="status">
          <span>{BADGE_STRINGS.completedPrompt}</span>
          <Link href={`/anime/${encodeURIComponent(prompt.slug)}?write=1`} className={styles.promptLink} onClick={() => setPrompt(null)}>
            Write a review
          </Link>
          <button type="button" className={styles.promptClose} onClick={() => setPrompt(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
