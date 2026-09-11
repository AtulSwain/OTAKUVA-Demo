'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Heart, MoreHorizontal } from 'lucide-react';
import type { CommentDto } from '../../../lib/engine/community/commentService';
import { relativeTime } from '../../../lib/format/relativeTime';
import { UserAvatar } from '../../ui/UserAvatar';
import { SpoilerBlock } from '../SpoilerBlock';
import { CommentMediaGrid } from './CommentMediaGrid';
import styles from './Comments.module.css';

export interface CommentProps {
  comment: CommentDto;
  /** 0 = top-level comment, 1 = reply. The only visual difference is indentation. */
  depth: 0 | 1;
  viewerId?: string | null;
  animeSlug?: string | null;
  onReply?: (comment: CommentDto) => void;
  onToggleLike?: (comment: CommentDto) => void;
  onDelete?: (comment: CommentDto) => void;
  onReport?: (comment: CommentDto) => void;
  /** "12 replies" / "Hide replies" control, rendered in the action row. */
  repliesControl?: React.ReactNode;
}

/**
 * The one comment component. Top-level comments and replies both render
 * through it; replies pass depth={1}. There is no separate reply card,
 * media comment or GIF comment — media is just part of the body.
 */
export const Comment: React.FC<CommentProps> = ({
  comment,
  depth,
  viewerId,
  animeSlug,
  onReply,
  onToggleLike,
  onDelete,
  onReport,
  repliesControl,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [menuOpen]);

  const isOwn = Boolean(viewerId && comment.author?.id === viewerId);
  const when = new Date(comment.createdAt);
  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#comment-${comment.id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    setMenuOpen(false);
  };

  return (
    <article id={`comment-${comment.id}`} className={`${styles.comment} ${depth === 1 ? styles.reply : ''}`}>
      <UserAvatar username={comment.author?.username} avatarUrl={comment.author?.avatarUrl} size={depth === 1 ? 24 : 28} />

      <div className={styles.commentMain}>
        <header className={styles.metaRow}>
          {comment.author ? (
            <Link href={`/profile/${encodeURIComponent(comment.author.username)}`} className={styles.author}>
              {comment.author.username}
            </Link>
          ) : (
            <span className={styles.authorDeleted}>[deleted]</span>
          )}
          <span className={styles.dot} aria-hidden="true">·</span>
          <time className={styles.time} dateTime={comment.createdAt} title={when.toLocaleString()}>
            {relativeTime(comment.createdAt)}
          </time>

          {!comment.isDeleted && (onDelete || onReport) && (
            <div className={styles.menuWrap} ref={menuRef}>
              <button
                type="button"
                className={styles.moreBtn}
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <MoreHorizontal size={16} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div className={styles.menu} role="menu">
                  <button type="button" role="menuitem" onClick={copyLink}>Copy link</button>
                  {!isOwn && onReport && (
                    <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onReport(comment); }}>
                      Report
                    </button>
                  )}
                  {comment.canDelete && onDelete && (
                    <button type="button" role="menuitem" className={styles.menuDanger} onClick={() => { setMenuOpen(false); onDelete(comment); }}>
                      Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </header>

        {comment.isDeleted ? (
          <p className={styles.deletedBody}>This comment was deleted.</p>
        ) : (
          <SpoilerBlock spoilerLevel={comment.spoilerLevel} animeSlug={animeSlug} variant="inline">
            {comment.body && <p className={styles.body}>{comment.body}</p>}
            <CommentMediaGrid media={comment.media} forceSpoiler={comment.spoilerLevel !== 'NO_SPOILER'} />
          </SpoilerBlock>
        )}

        <div className={styles.actions}>
          {!comment.isDeleted && (
            <button
              type="button"
              className={`${styles.action} ${comment.likedByViewer ? styles.actionActive : ''}`}
              onClick={() => onToggleLike?.(comment)}
              aria-pressed={comment.likedByViewer}
              aria-label={`${comment.likedByViewer ? 'Unlike' : 'Like'} (${comment.likeCount})`}
            >
              <Heart size={13} fill={comment.likedByViewer ? 'currentColor' : 'none'} aria-hidden="true" />
              {comment.likeCount > 0 && <span>{comment.likeCount.toLocaleString()}</span>}
            </button>
          )}
          {!comment.isDeleted && onReply && (
            <button type="button" className={styles.action} onClick={() => onReply(comment)}>
              Reply
            </button>
          )}
          {repliesControl}
        </div>
      </div>
    </article>
  );
};
