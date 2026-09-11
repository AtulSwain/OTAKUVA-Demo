'use client';

import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import type { CommentDto } from '../../../lib/engine/community/commentService';
import { Comment } from './Comment';
import styles from './Comments.module.css';

export interface CommentThreadHandle {
  /** Adds a reply the viewer just posted and opens the thread. */
  addReply: (reply: CommentDto) => void;
}

interface CommentThreadProps {
  discussionId: string;
  root: CommentDto;
  viewerId?: string | null;
  animeSlug?: string | null;
  onReply: (target: CommentDto) => void;
  onToggleLike: (comment: CommentDto, apply: (patch: Partial<CommentDto>) => void) => void;
  onDelete: (comment: CommentDto, apply: (patch: Partial<CommentDto> | null) => void) => void;
  onReport: (comment: CommentDto) => void;
  onRootChange: (patch: Partial<CommentDto> | null) => void;
  /** Inline reply composer (desktop) rendered under the replies. */
  composer?: React.ReactNode;
}

/**
 * A top-level comment and its replies. Replies stay collapsed behind
 * "N replies" and load a page at a time, so long threads never arrive all
 * at once. Every comment here renders through the same <Comment>.
 */
export const CommentThread = forwardRef<CommentThreadHandle, CommentThreadProps>(function CommentThread(
  { discussionId, root, viewerId, animeSlug, onReply, onToggleLike, onDelete, onReport, onRootChange, composer },
  ref
) {
  const [replies, setReplies] = useState<CommentDto[]>([]);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReplies = useCallback(
    async (after: string | null) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ parentId: root.id });
        if (after) qs.set('cursor', after);
        const res = await fetch(`/api/discussions/${discussionId}/comments?${qs}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not load replies');
        setReplies((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...(data.comments as CommentDto[]).filter((r) => !seen.has(r.id))];
        });
        setCursor(data.nextCursor);
        setLoaded(true);
      } catch (e: any) {
        setError(e.message || 'Could not load replies');
      } finally {
        setLoading(false);
      }
    },
    [discussionId, root.id]
  );

  useImperativeHandle(ref, () => ({
    addReply: (reply) => {
      setReplies((prev) => (prev.some((r) => r.id === reply.id) ? prev : [...prev, reply]));
      setOpen(true);
      onRootChange({ replyCount: root.replyCount + 1 });
    },
  }));

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) loadReplies(null);
  };

  const patchReply = (id: string) => (patch: Partial<CommentDto> | null) =>
    setReplies((prev) => (patch === null ? prev.filter((r) => r.id !== id) : prev.map((r) => (r.id === id ? { ...r, ...patch } : r))));

  const repliesControl =
    root.replyCount > 0 ? (
      <button type="button" className={styles.action} onClick={toggle} aria-expanded={open}>
        {open ? 'Hide replies' : `${root.replyCount} ${root.replyCount === 1 ? 'reply' : 'replies'}`}
      </button>
    ) : null;

  const remainingOnServer = Math.max(0, root.replyCount - replies.length);

  return (
    <div className={styles.thread}>
      <Comment
        comment={root}
        depth={0}
        viewerId={viewerId}
        animeSlug={animeSlug}
        onReply={onReply}
        onToggleLike={(c) => onToggleLike(c, (p) => onRootChange(p))}
        onDelete={(c) => onDelete(c, (p) => onRootChange(p))}
        onReport={onReport}
        repliesControl={repliesControl}
      />

      {open && (
        <div className={styles.replies}>
          {replies.map((r) => (
            <Comment
              key={r.id}
              comment={r}
              depth={1}
              viewerId={viewerId}
              animeSlug={animeSlug}
              onReply={onReply}
              onToggleLike={(c) => onToggleLike(c, patchReply(r.id))}
              onDelete={(c) =>
                onDelete(c, (p) => {
                  patchReply(r.id)(p);
                  if (p === null || p.isDeleted) onRootChange({ replyCount: Math.max(0, root.replyCount - 1) });
                })
              }
              onReport={onReport}
            />
          ))}
          {loading && <p className={styles.threadNote}>Loading replies…</p>}
          {error && (
            <p className={styles.threadNote}>
              {error}{' '}
              <button type="button" className={styles.linkBtn} onClick={() => loadReplies(cursor)}>Retry</button>
            </p>
          )}
          {!loading && !error && loaded && cursor && remainingOnServer > 0 && (
            <button type="button" className={`${styles.linkBtn} ${styles.moreReplies}`} onClick={() => loadReplies(cursor)}>
              Show {Math.min(remainingOnServer, 10)} more {remainingOnServer === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
      )}

      {composer && <div className={styles.replies}>{composer}</div>}
    </div>
  );
});
