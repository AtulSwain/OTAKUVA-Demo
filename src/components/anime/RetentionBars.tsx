'use client';

import React, { useEffect, useState } from 'react';
import { Check, Lock, MessageSquare, Pencil, Trash2, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { promptPhoneVerification } from '../auth/VerifyPhonePrompt';
import { notifyCommunityScoresChanged } from '../../lib/rating/useCommunityScore';
import { RetentionSegments } from '../rating/RetentionSegments';
import { retentionColor, retentionLabel } from '../../lib/rating/retentionTone';
import type { EpisodeRetentionSummary } from '../rating/EpisodeRetentionModal';
import styles from './RetentionBars.module.css';

/**
 * One episode's retention in its Episode Guide row (2026-10-25 rebuild):
 *
 *   [ 20-segment bar ]  72   [Submit]
 *   Community 64% · 5 ratings
 *
 * Pick any whole number 1–100 on the bar (or with the keys), then press
 * Save (or Enter) — nothing saves on its own. Once saved the bar is locked
 * (owner, 2026-10-27: an accidental touch must not change it); "Edit"
 * unlocks it, then Save / Cancel (Escape) / Remove. Your number and the
 * community average are shown separately. Locked ("Watch first") until the
 * episode is ticked as watched. Name kept for its call sites.
 */
export function RetentionBars({
  animeId,
  episodeNumber,
  mine,
  myComment = null,
  community,
  onSaved,
  compact = false,
  locked = false,
}: {
  animeId: string;
  episodeNumber: number;
  /** The viewer's saved rating for this episode. */
  mine: number | null;
  /** The viewer's optional comment on this episode (≤280 chars). */
  myComment?: string | null;
  /** Community average (whole percent) and how many ratings it's from. */
  community: { value: number | null; count: number };
  onSaved: (summary: EpisodeRetentionSummary) => void;
  compact?: boolean;
  /** Not marked watched yet: can't be rated (owner, 2026-10-21). */
  locked?: boolean;
}) {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<number | null>(mine);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [commentOpen, setCommentOpen] = useState(false);
  // A saved rating is read-only until Edit is pressed.
  const [editing, setEditing] = useState(false);
  const frozen = mine !== null && !editing;
  const [commentDraft, setCommentDraft] = useState(myComment ?? '');
  useEffect(() => setCommentDraft(myComment ?? ''), [myComment]);

  // A fresh saved value from the server (or another tab) replaces the draft.
  useEffect(() => setDraft(mine), [mine]);

  const dirty = draft !== null && draft !== mine;
  const cancelEdit = () => {
    setDraft(mine);
    setEditing(false);
  };

  const explainLock = () => {
    if (!user) return openAuthModal('login');
    showToast(`Tick episode ${episodeNumber} as watched first, then rate it.`, 'info');
  };

  const request = async (method: 'POST' | 'DELETE') => {
    const base = `/api/anime/${encodeURIComponent(animeId)}/episode-ratings`;
    const res = await fetch(method === 'POST' ? base : `${base}?episodeNumber=${episodeNumber}&what=retention`, {
      method,
      headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
      body: method === 'POST' ? JSON.stringify({ episodeNumber, retention: draft }) : undefined,
    });
    const body = await res.json().catch(() => ({} as { error?: string; code?: string; summary?: EpisodeRetentionSummary }));
    if (!res.ok) {
      if (body.code === 'PHONE_NOT_VERIFIED') promptPhoneVerification('rate');
      else showToast(body.error || 'Could not save your rating.', 'error');
      return null;
    }
    return body.summary ?? null;
  };

  const submit = async () => {
    if (!user) return openAuthModal('login');
    if (locked) return explainLock();
    if (state === 'saving') return;
    if (!dirty) {
      if (editing) setEditing(false);
      return;
    }
    setState('saving');
    try {
      const summary = await request('POST');
      if (!summary) {
        setState('idle');
        return;
      }
      notifyCommunityScoresChanged();
      onSaved(summary);
      setEditing(false);
      setState('saved');
      setTimeout(() => setState('idle'), 1600);
    } catch {
      showToast('Could not reach the server. Please try again.', 'error');
      setState('idle');
    }
  };

  const saveComment = async () => {
    if (mine === null || state === 'saving') return;
    setState('saving');
    try {
      const res = await fetch(`/api/anime/${encodeURIComponent(animeId)}/episode-ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episodeNumber, retention: mine, comment: commentDraft }),
      });
      const body = await res.json().catch(() => ({} as { error?: string; summary?: EpisodeRetentionSummary }));
      if (!res.ok) {
        showToast(body.error || 'Could not save your comment.', 'error');
        setState('idle');
        return;
      }
      if (body.summary) onSaved(body.summary);
      setCommentOpen(false);
      setState('saved');
      setTimeout(() => setState('idle'), 1600);
    } catch {
      showToast('Could not reach the server. Please try again.', 'error');
      setState('idle');
    }
  };

  const remove = async () => {
    if (state === 'saving') return;
    setState('saving');
    try {
      const summary = await request('DELETE');
      if (summary) {
        notifyCommunityScoresChanged();
        onSaved(summary);
        setEditing(false);
      }
    } catch {
      showToast('Could not reach the server. Please try again.', 'error');
    } finally {
      setState('idle');
    }
  };

  const shown = draft;

  return (
    <div className={`${styles.wrap} ${compact ? styles.compact : ''}`}>
      <div className={styles.row}>
        <div className={styles.bar}>
          <RetentionSegments
            value={shown}
            onChange={(v) => {
              if (!user) return openAuthModal('login');
              setDraft(v);
            }}
            onEnter={submit}
            onEscape={cancelEdit}
            disabled={locked}
            readOnly={!locked && frozen}
            onDisabledAttempt={locked ? explainLock : () => showToast('Your rating is saved. Tap Edit to change it.', 'info')}
            label={`Episode ${episodeNumber} retention, 1 to 100`}
            color={shown !== null ? retentionColor(shown) : null}
          />
        </div>
        <span
          className={`${styles.value} ${shown === null ? styles.valueEmpty : ''}`}
          style={shown !== null ? { color: retentionColor(shown) } : undefined}
          title={shown !== null ? retentionLabel(shown) : undefined}
          aria-live="polite"
        >
          {shown ?? ''}
        </span>
        {!locked && (dirty || editing) ? (
          <span className={styles.actions}>
            <button type="button" className={styles.submit} onClick={submit} disabled={state === 'saving' || !dirty}>
              {state === 'saving' ? 'Saving…' : 'Save'}
            </button>
            {editing && (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={remove}
                aria-label={`Remove your rating for episode ${episodeNumber}`}
                title="Remove your rating"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button type="button" className={styles.iconBtn} onClick={cancelEdit} aria-label="Cancel" title="Cancel">
              <X size={13} />
            </button>
          </span>
        ) : state === 'saved' ? (
          <span className={styles.saved}>
            <Check size={12} strokeWidth={3} aria-hidden="true" /> Saved
          </span>
        ) : mine !== null && !locked ? (
          <button
            type="button"
            className={styles.editBtn}
            onClick={() => setEditing(true)}
            aria-label={`Edit your rating for episode ${episodeNumber}`}
          >
            <Pencil size={12} aria-hidden="true" /> Edit
          </button>
        ) : (
          <span className={styles.actionSpacer} aria-hidden="true" />
        )}
      </div>
      <span className={styles.meta}>
        {!user ? (
          <span className={styles.locked}>Sign in to rate</span>
        ) : locked ? (
          <span className={styles.locked}>
            <Lock size={10} aria-hidden="true" /> Tick it as watched to rate
          </span>
        ) : mine !== null ? (
          <span className={styles.you}>
            You {mine} · {retentionLabel(mine)}
          </span>
        ) : null}
        {mine !== null && !locked && !commentOpen && (
          <button type="button" className={styles.commentLink} onClick={() => setCommentOpen(true)}>
            <MessageSquare size={11} aria-hidden="true" /> {myComment ? 'Edit comment' : 'Comment'}
          </button>
        )}
        <span className={compact ? styles.communityInline : undefined}>
          {community.value !== null
            ? `Community ${community.value}% · ${community.count} ${community.count === 1 ? 'rating' : 'ratings'} · ${retentionLabel(community.value)}`
            : 'Community: not rated yet'}
        </span>
      </span>
      {commentOpen ? (
        <div className={styles.commentBox}>
          <input
            className={styles.commentInput}
            value={commentDraft}
            maxLength={280}
            placeholder={`Say something about episode ${episodeNumber} (optional)`}
            onChange={(e) => setCommentDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveComment();
              if (e.key === 'Escape') setCommentOpen(false);
            }}
            autoFocus
          />
          <button type="button" className={styles.submit} onClick={saveComment} disabled={state === 'saving'}>
            Save
          </button>
          <button type="button" className={styles.iconBtn} onClick={() => setCommentOpen(false)} aria-label="Cancel">
            <X size={13} />
          </button>
        </div>
      ) : (
        myComment && <p className={styles.comment}>“{myComment}”</p>
      )}
    </div>
  );
}
