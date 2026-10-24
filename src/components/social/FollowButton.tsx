'use client';

import React, { useState } from 'react';
import { Check, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import styles from './FollowButton.module.css';

interface FollowButtonProps {
  username: string;
  following: boolean;
  /** They already follow the viewer — the button reads "Follow back". */
  followsYou?: boolean;
  size?: 'md' | 'sm';
  onChange?: (following: boolean, followerCount?: number) => void;
}

/**
 * Follow / Following toggle. Following someone means you're notified when
 * they review, write an article, publish a collection or start a public
 * discussion. Optimistic, rolls back on failure; signed-out viewers get the
 * sign-in window.
 */
export function FollowButton({ username, following, followsYou = false, size = 'md', onChange }: FollowButtonProps) {
  const { user, openAuthModalWithIntent } = useAuth();
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (!user) {
      openAuthModalWithIntent({ type: 'CUSTOM', description: `follow @${username}` }, `Sign in to follow @${username}.`);
      return;
    }
    if (busy) return;
    const next = !following;
    setBusy(true);
    onChange?.(next);
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/follow`, { method: next ? 'POST' : 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
      onChange?.(next, typeof data.followerCount === 'number' ? data.followerCount : undefined);
    } catch (err) {
      onChange?.(!next);
      showToast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const label = following ? 'Following' : followsYou ? 'Follow back' : 'Follow';
  return (
    <button
      type="button"
      className={`${styles.btn} ${following ? styles.on : styles.off} ${size === 'sm' ? styles.sm : ''}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={following}
      aria-label={following ? `Unfollow @${username}` : `Follow @${username}`}
    >
      {following ? <Check size={size === 'sm' ? 13 : 15} aria-hidden="true" /> : <UserPlus size={size === 'sm' ? 13 : 15} aria-hidden="true" />}
      <span className={styles.label}>{label}</span>
      {following && <span className={styles.hoverLabel} aria-hidden="true">Unfollow</span>}
    </button>
  );
}
