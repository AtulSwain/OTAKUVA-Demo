'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Clock, Lock, Plus } from 'lucide-react';
import { CommunityImage } from '../ui/CommunityImage';
import styles from './CommunityEntrySplash.module.css';

interface Props {
  community: {
    name: string;
    description: string;
    iconUrl?: string | null;
    bannerUrl?: string | null;
    memberCount: number;
    discussionCount: number;
    category: string;
    visibility: string;
    membershipStatus?: string | null;
    owner?: { username: string } | null;
  };
  needsApproval: boolean;
  onJoin: () => Promise<void>;
  onDone: () => void;
}

/** How long members see the welcome card before it gets out of the way. */
const MEMBER_AUTO_DISMISS_MS = 2200;

/**
 * Full-bleed banner + logo shown only on entering a community. Members pass
 * straight through after a moment; visitors get a choice to join or just
 * look around. After this, the workspace shows only the small icon + name.
 */
export function CommunityEntrySplash({ community, needsApproval, onJoin, onDone }: Props) {
  const [leaving, setLeaving] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const enterBtnRef = useRef<HTMLButtonElement>(null);
  const isMember = community.membershipStatus === 'ACTIVE';
  const isPending = community.membershipStatus === 'PENDING';
  const isBanned = community.membershipStatus === 'BANNED';

  const dismiss = React.useCallback(() => {
    setLeaving(true);
    const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(onDone, reduced ? 0 : 280);
  }, [onDone]);

  useEffect(() => {
    enterBtnRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && dismiss();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dismiss]);

  useEffect(() => {
    if (!isMember) return;
    const t = window.setTimeout(dismiss, MEMBER_AUTO_DISMISS_MS);
    return () => window.clearTimeout(t);
  }, [isMember, dismiss]);

  const handleJoin = async () => {
    setIsJoining(true);
    try {
      await onJoin();
    } finally {
      setIsJoining(false);
    }
  };

  return (
    <div
      className={`${styles.overlay} ${leaving ? styles.leaving : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="community-entry-name"
    >
      <div className={styles.banner} aria-hidden="true">
        <CommunityImage src={community.bannerUrl} type="banner" communityName={community.name} priority />
        <div className={styles.scrim} />
      </div>

      <div className={styles.card}>
        <div className={styles.icon}>
          <CommunityImage src={community.iconUrl} type="icon" communityName={community.name} />
        </div>
        <p className={styles.kicker}>
          {community.category}
          {community.visibility !== 'PUBLIC' && (
            <>
              {' · '}
              <Lock size={11} aria-hidden="true" /> {community.visibility.replace(/_/g, ' ').toLowerCase()}
            </>
          )}
        </p>
        <h1 id="community-entry-name" className={styles.name}>
          {community.name}
        </h1>
        {community.description && <p className={styles.description}>{community.description}</p>}
        <p className={styles.stats}>
          <span>
            <span className={styles.dot} aria-hidden="true" />
            {community.memberCount.toLocaleString()} {community.memberCount === 1 ? 'member' : 'members'}
          </span>
          <span>{community.discussionCount.toLocaleString()} discussions</span>
          {community.owner?.username && <span>by @{community.owner.username}</span>}
        </p>

        <div className={styles.actions}>
          {!isMember && !isPending && !isBanned && (
            <button type="button" className={styles.primary} onClick={handleJoin} disabled={isJoining}>
              <Plus size={16} aria-hidden="true" />
              {isJoining ? 'Joining…' : needsApproval ? 'Request to join' : 'Join community'}
            </button>
          )}
          {isPending && (
            <span className={styles.status}>
              <Clock size={14} aria-hidden="true" /> Request pending
            </span>
          )}
          <button
            ref={enterBtnRef}
            type="button"
            className={isMember ? styles.primary : styles.secondary}
            onClick={dismiss}
          >
            {isMember ? 'Enter' : 'Just look around'}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
