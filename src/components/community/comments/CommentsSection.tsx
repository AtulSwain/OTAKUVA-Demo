'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { CommentDto } from '../../../lib/engine/community/commentService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { CommentComposer, type ReplyTarget } from './CommentComposer';
import { CommentThread, type CommentThreadHandle } from './CommentThread';
import { ReportDialog } from './ReportDialog';
import styles from './Comments.module.css';

interface CommentsSectionProps {
  discussionId: string;
  animeSlug?: string | null;
  /** Total from the discussion payload, shown before the first page loads. */
  initialCount?: number;
  /** Why the viewer can't post (locked, not a member…); null when they can. */
  blockedReason?: string | null;
  /** Spoiler level used when a commenter switches Spoiler on. */
  spoilerLevel?: string;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const q = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(q.matches);
    update();
    q.addEventListener('change', update);
    return () => q.removeEventListener('change', update);
  }, []);
  return isMobile;
}

/** Keeps the docked reply sheet above the on-screen keyboard (iOS/Android). */
function useKeyboardOffset(active: boolean) {
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!active || !vv) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty('--keyboard-offset', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      root.style.removeProperty('--keyboard-offset');
    };
  }, [active]);
}

type LoadState = 'loading' | 'ready' | 'error';

export const CommentsSection: React.FC<CommentsSectionProps> = ({
  discussionId,
  animeSlug,
  initialCount = 0,
  blockedReason = null,
  spoilerLevel = 'ANIME_SPOILER',
}) => {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const isMobile = useIsMobile();

  const [sort, setSort] = useState<'top' | 'newest'>('top');
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(initialCount);
  const [state, setState] = useState<LoadState>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [replyTarget, setReplyTarget] = useState<(ReplyTarget & { rootId: string; prefill: string }) | null>(null);
  const [reporting, setReporting] = useState<CommentDto | null>(null);
  const threads = useRef(new Map<string, CommentThreadHandle>());

  useKeyboardOffset(isMobile && Boolean(replyTarget));

  const load = useCallback(
    async (after: string | null) => {
      if (after) setLoadingMore(true);
      else setState('loading');
      try {
        const qs = new URLSearchParams({ sort });
        if (after) qs.set('cursor', after);
        const res = await fetch(`/api/discussions/${discussionId}/comments?${qs}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not load comments');
        setComments((prev) => {
          if (!after) return data.comments;
          const seen = new Set(prev.map((c) => c.id));
          return [...prev, ...(data.comments as CommentDto[]).filter((c) => !seen.has(c.id))];
        });
        setCursor(data.nextCursor);
        setTotal(data.totalComments);
        setState('ready');
      } catch (e: any) {
        if (after) showToast(e.message || 'Could not load more comments', 'error');
        else setState('error');
      } finally {
        setLoadingMore(false);
      }
    },
    [discussionId, sort, showToast]
  );

  // Reload when the discussion, sort or signed-in viewer changes (likes and
  // delete rights are per viewer).
  useEffect(() => {
    load(null);
  }, [load, user?.id]);

  const patchRoot = (id: string) => (patch: Partial<CommentDto> | null) =>
    setComments((prev) => (patch === null ? prev.filter((c) => c.id !== id) : prev.map((c) => (c.id === id ? { ...c, ...patch } : c))));

  const handleReply = (target: CommentDto) => {
    if (!user) return openAuthModal('login');
    const rootId = target.parentId ?? target.id;
    const username = target.author?.username ?? 'user';
    setReplyTarget({ commentId: target.id, username, rootId, prefill: target.parentId ? `@${username} ` : '' });
  };

  const handleToggleLike = async (comment: CommentDto, apply: (patch: Partial<CommentDto>) => void) => {
    if (!user) return openAuthModal('login');
    const before = { likedByViewer: comment.likedByViewer, likeCount: comment.likeCount };
    // Optimistic, then settled to the server's numbers — or rolled back.
    apply({ likedByViewer: !before.likedByViewer, likeCount: Math.max(0, before.likeCount + (before.likedByViewer ? -1 : 1)) });
    try {
      const res = await fetch(`/api/comments/${comment.id}/like`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update like');
      apply({ likedByViewer: data.liked, likeCount: data.likeCount });
    } catch (e: any) {
      apply(before);
      showToast(e.message || 'Could not update like', 'error');
    }
  };

  const handleDelete = async (comment: CommentDto, apply: (patch: Partial<CommentDto> | null) => void) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      const res = await fetch(`/api/comments/${comment.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not delete comment');
      // A comment that still has replies stays as a placeholder so the thread holds.
      apply(comment.replyCount > 0 ? { isDeleted: true, body: null, author: null, media: [], canDelete: false } : null);
      setTotal((t) => Math.max(0, t - 1));
    } catch (e: any) {
      showToast(e.message || 'Could not delete comment', 'error');
    }
  };

  const onTopLevelPosted = (comment: CommentDto) => {
    setComments((prev) => [comment, ...prev]);
    setTotal((t) => t + 1);
  };

  const onReplyPosted = (reply: CommentDto) => {
    if (!replyTarget) return;
    threads.current.get(replyTarget.rootId)?.addReply(reply);
    setTotal((t) => t + 1);
    setReplyTarget(null);
  };

  const replyComposer = replyTarget ? (
    <ReplyComposerWithPrefill
      key={replyTarget.commentId}
      discussionId={discussionId}
      target={replyTarget}
      variant={isMobile ? 'sheet' : 'inline'}
      blockedReason={blockedReason}
      spoilerLevel={spoilerLevel}
      onCancel={() => setReplyTarget(null)}
      onPosted={onReplyPosted}
    />
  ) : null;

  return (
    <section className={styles.section} aria-label="Comments">
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>
          Comments <span className={styles.count}>{total.toLocaleString()}</span>
        </h2>
        <div className={styles.tabs} role="tablist" aria-label="Sort comments">
          {(['top', 'newest'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sort === s}
              className={`${styles.tab} ${sort === s ? styles.tabActive : ''}`}
              onClick={() => setSort(s)}
            >
              {s === 'top' ? 'Top' : 'Newest'}
            </button>
          ))}
        </div>
      </div>

      <CommentComposer discussionId={discussionId} onPosted={onTopLevelPosted} blockedReason={blockedReason} spoilerLevel={spoilerLevel} />

      {state === 'loading' && (
        <div className={styles.skeletonList} aria-busy="true" aria-label="Loading comments">
          {[0, 1, 2].map((i) => (
            <div key={i} className={styles.skeletonRow}>
              <span className={styles.skeletonAvatar} />
              <span className={styles.skeletonLines} />
            </div>
          ))}
        </div>
      )}

      {state === 'error' && (
        <div className={styles.emptyState}>
          <p>Comments couldn’t be loaded.</p>
          <button type="button" className={styles.linkBtn} onClick={() => load(null)}>Try again</button>
        </div>
      )}

      {state === 'ready' && comments.length === 0 && (
        <div className={styles.emptyState}>
          <p>No comments yet. Start the conversation.</p>
        </div>
      )}

      {state === 'ready' && comments.length > 0 && (
        <div className={styles.list}>
          {comments.map((c) => (
            <CommentThread
              key={c.id}
              ref={(h) => {
                if (h) threads.current.set(c.id, h);
                else threads.current.delete(c.id);
              }}
              discussionId={discussionId}
              root={c}
              viewerId={user?.id}
              animeSlug={animeSlug}
              onReply={handleReply}
              onToggleLike={handleToggleLike}
              onDelete={handleDelete}
              onReport={(cm) => (user ? setReporting(cm) : openAuthModal('login'))}
              onRootChange={patchRoot(c.id)}
              composer={!isMobile && replyTarget?.rootId === c.id ? replyComposer : null}
            />
          ))}
          {cursor && (
            <button type="button" className={styles.loadMore} onClick={() => load(cursor)} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more comments'}
            </button>
          )}
        </div>
      )}

      {isMobile && replyComposer && (
        <>
          <div className={styles.sheetBackdrop} onClick={() => setReplyTarget(null)} aria-hidden="true" />
          {replyComposer}
        </>
      )}

      {reporting && <ReportDialog targetType="COMMENT" targetId={reporting.id} onClose={() => setReporting(null)} />}
    </section>
  );
};

/** Reply composer that seeds "@username " when replying to a reply. */
function ReplyComposerWithPrefill({
  discussionId,
  target,
  variant,
  blockedReason,
  spoilerLevel,
  onCancel,
  onPosted,
}: {
  discussionId: string;
  target: ReplyTarget & { prefill: string };
  variant: 'inline' | 'sheet';
  blockedReason: string | null;
  spoilerLevel: string;
  onCancel: () => void;
  onPosted: (c: CommentDto) => void;
}) {
  return (
    <CommentComposer
      discussionId={discussionId}
      replyTo={{ commentId: target.commentId, username: target.username }}
      initialText={target.prefill}
      onCancelReply={onCancel}
      onPosted={onPosted}
      variant={variant}
      autoFocus
      blockedReason={blockedReason}
      spoilerLevel={spoilerLevel}
    />
  );
}
