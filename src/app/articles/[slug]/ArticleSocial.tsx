'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Heart, MessageCircle, Trash2, CornerDownRight, ChevronDown } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { UserAvatar } from '../../../components/ui/UserAvatar';
import { Composer } from '../../../components/ui/Composer';
import styles from './articleSocial.module.css';

interface CommentItem {
  id: string;
  parentId: string | null;
  deleted: boolean;
  body: string;
  createdAt: string;
  user: { id: string; username: string; avatarUrl: string | null } | null;
  canDelete: boolean;
  likeCount: number;
  liked: boolean;
  replies: CommentItem[];
}

type Sort = 'top' | 'newest' | 'oldest';

const MAX = 2000;
const WHEN = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
/** Replies shown before "View N more replies". */
const REPLIES_PREVIEW = 2;

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`;
  return WHEN.format(new Date(iso));
}

const countAll = (list: CommentItem[]) => list.reduce((n, c) => n + (c.deleted ? 0 : 1) + c.replies.length, 0);

/** Like button + threaded discussion (comments, one level of replies, likes) under a member article. */
export function ArticleSocial({ slug, initialLikeCount, initialLiked, initialCommentCount }: { slug: string; initialLikeCount: number; initialLiked: boolean; initialCommentCount: number }) {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [likeBusy, setLikeBusy] = useState(false);
  const [comments, setComments] = useState<CommentItem[] | null>(null);
  const [sort, setSort] = useState<Sort>('top');
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);

  const base = `/api/articles/${encodeURIComponent(slug)}/comments`;

  useEffect(() => {
    let cancelled = false;
    fetch(`${base}?sort=${sort}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { comments: [] }))
      .then((d) => { if (!cancelled) setComments(d.comments || []); })
      .catch(() => { if (!cancelled) setComments([]); });
    return () => { cancelled = true; };
  }, [base, sort, user?.id]);

  const toggleLike = async () => {
    if (!user) return openAuthModal('login');
    if (likeBusy) return;
    const next = !liked;
    setLikeBusy(true);
    setLiked(next);
    setLikeCount((n) => Math.max(0, n + (next ? 1 : -1)));
    try {
      const res = await fetch(`/api/articles/${encodeURIComponent(slug)}/like`, { method: next ? 'POST' : 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update your like.');
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } catch (err) {
      setLiked(!next);
      setLikeCount((n) => Math.max(0, n + (next ? -1 : 1)));
      showToast((err as Error).message, 'error');
    } finally {
      setLikeBusy(false);
    }
  };

  /** Posts a comment or reply; returns the created item, or null on failure (already toasted). */
  const submit = useCallback(
    async (body: string, parentId?: string): Promise<CommentItem | null> => {
      if (!user) {
        openAuthModal('login');
        return null;
      }
      try {
        const res = await fetch(base, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body, parentId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Could not post your comment.');
        return data.comment as CommentItem;
      } catch (err) {
        showToast((err as Error).message, 'error');
        return null;
      }
    },
    [base, user, openAuthModal, showToast]
  );

  const post = async () => {
    const body = draft.trim();
    if (!body || posting) return;
    setPosting(true);
    const created = await submit(body);
    if (created) {
      setComments((prev) => [{ ...created, replies: [] }, ...(prev || [])]);
      setDraft('');
    }
    setPosting(false);
  };

  const addReply = (threadId: string, reply: CommentItem) =>
    setComments((prev) => (prev || []).map((t) => (t.id === threadId ? { ...t, replies: [...t.replies, reply] } : t)));

  const patch = (id: string, fn: (c: CommentItem) => CommentItem) =>
    setComments((prev) =>
      (prev || []).map((t) => (t.id === id ? fn(t) : { ...t, replies: t.replies.map((r) => (r.id === id ? fn(r) : r)) }))
    );

  const likeComment = async (c: CommentItem) => {
    if (!user) return openAuthModal('login');
    const next = !c.liked;
    patch(c.id, (x) => ({ ...x, liked: next, likeCount: Math.max(0, x.likeCount + (next ? 1 : -1)) }));
    try {
      const res = await fetch(`${base}/${c.id}/like`, { method: next ? 'POST' : 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update your like.');
      patch(c.id, (x) => ({ ...x, liked: data.liked, likeCount: data.likeCount }));
    } catch (err) {
      patch(c.id, (x) => ({ ...x, liked: !next, likeCount: Math.max(0, x.likeCount + (next ? -1 : 1)) }));
      showToast((err as Error).message, 'error');
    }
  };

  const remove = async (c: CommentItem) => {
    if (!window.confirm(c.user?.id === user?.id ? 'Delete your comment?' : 'Hide this comment?')) return;
    try {
      const res = await fetch(`${base}/${c.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not remove the comment.');
      setComments((prev) =>
        (prev || [])
          .map((t) => {
            if (t.id !== c.id) return { ...t, replies: t.replies.filter((r) => r.id !== c.id) };
            // A thread with replies keeps a placeholder so the replies keep their context.
            return t.replies.length ? { ...t, deleted: true, body: '', user: null, canDelete: false } : null;
          })
          .filter((t): t is CommentItem => t !== null)
      );
    } catch (err) {
      showToast((err as Error).message, 'error');
    }
  };

  const count = comments ? countAll(comments) : initialCommentCount;

  return (
    <section className={styles.social} aria-labelledby="discuss-title">
      <div className={styles.bar}>
        <button
          type="button"
          className={`${styles.likeBtn} ${liked ? styles.liked : ''}`}
          onClick={toggleLike}
          aria-pressed={liked}
          disabled={likeBusy}
        >
          <Heart size={17} fill={liked ? 'currentColor' : 'none'} aria-hidden="true" className={liked ? styles.pop : ''} />
          <span>{liked ? 'Liked' : 'Like'}</span>
          <span className={styles.num}>{likeCount}</span>
        </button>
        <a href="#discuss-title" className={styles.commentCount}>
          <MessageCircle size={17} aria-hidden="true" /> {count} {count === 1 ? 'comment' : 'comments'}
        </a>
      </div>

      <div className={styles.discussHead}>
        <h2 id="discuss-title" className={styles.title}>Discussion</h2>
        <div className={styles.sortTabs} role="tablist" aria-label="Sort comments">
          {(['top', 'newest', 'oldest'] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sort === s}
              className={`${styles.sortTab} ${sort === s ? styles.sortActive : ''}`}
              onClick={() => setSort(s)}
            >
              {s === 'top' ? 'Top' : s === 'newest' ? 'Newest' : 'Oldest'}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.form}>
        <Composer
          value={draft}
          onChange={(v) => setDraft(v.slice(0, MAX))}
          onSubmit={post}
          onCancel={() => setDraft('')}
          submitting={posting}
          submitLabel="Comment"
          maxLength={MAX}
          placeholder="Share your thoughts on this article…"
        />
      </div>

      {comments === null ? (
        <p className={styles.empty}>Loading comments…</p>
      ) : comments.length === 0 ? (
        <p className={styles.empty}>No comments yet. Start the discussion.</p>
      ) : (
        <ul className={styles.list}>
          {comments.map((t) => (
            <Thread
              key={t.id}
              thread={t}
              canReply={Boolean(user)}
              onNeedAuth={() => openAuthModal('login')}
              onLike={likeComment}
              onRemove={remove}
              onReply={async (body, target) => {
                const created = await submit(body, target.id);
                if (created) addReply(t.id, created);
                return Boolean(created);
              }}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Thread({
  thread,
  canReply,
  onNeedAuth,
  onLike,
  onRemove,
  onReply,
}: {
  thread: CommentItem;
  canReply: boolean;
  onNeedAuth: () => void;
  onLike: (c: CommentItem) => void;
  onRemove: (c: CommentItem) => void;
  onReply: (body: string, target: CommentItem) => Promise<boolean>;
}) {
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null);
  const [expanded, setExpanded] = useState(false);
  const hidden = thread.replies.length - REPLIES_PREVIEW;
  const shown = expanded || hidden <= 0 ? thread.replies : thread.replies.slice(0, REPLIES_PREVIEW);

  const startReply = (c: CommentItem) => {
    if (!canReply) return onNeedAuth();
    setReplyTo(c);
    setExpanded(true);
  };

  return (
    <li className={styles.thread}>
      <Comment c={thread} onLike={onLike} onRemove={onRemove} onReply={startReply} />

      {(thread.replies.length > 0 || replyTo) && (
        <div className={styles.replies}>
          {shown.map((r) => (
            <Comment key={r.id} c={r} isReply onLike={onLike} onRemove={onRemove} onReply={startReply} />
          ))}
          {!expanded && hidden > 0 && (
            <button type="button" className={styles.moreReplies} onClick={() => setExpanded(true)}>
              <ChevronDown size={14} aria-hidden="true" /> View {hidden} more {hidden === 1 ? 'reply' : 'replies'}
            </button>
          )}
          {replyTo && (
            <ReplyBox
              key={replyTo.id}
              target={replyTo}
              onCancel={() => setReplyTo(null)}
              onSubmit={async (body) => {
                const ok = await onReply(body, replyTo);
                if (ok) setReplyTo(null);
                return ok;
              }}
            />
          )}
        </div>
      )}
    </li>
  );
}

function Comment({
  c,
  isReply = false,
  onLike,
  onRemove,
  onReply,
}: {
  c: CommentItem;
  isReply?: boolean;
  onLike: (c: CommentItem) => void;
  onRemove: (c: CommentItem) => void;
  onReply: (c: CommentItem) => void;
}) {
  if (c.deleted || !c.user) {
    return (
      <div id={`comment-${c.id}`} className={`${styles.comment} ${styles.removed}`}>
        <span className={styles.removedDot} aria-hidden="true" />
        <p className={styles.removedText}>This comment was removed.</p>
      </div>
    );
  }
  const avatar = isReply ? 28 : 34;
  return (
    <div id={`comment-${c.id}`} className={`${styles.comment} ${isReply ? styles.reply : ''}`}>
      <Link href={`/profile/${encodeURIComponent(c.user.username)}`} aria-label={`@${c.user.username}`}>
        <UserAvatar username={c.user.username} avatarUrl={c.user.avatarUrl} size={avatar} />
      </Link>
      <div className={styles.commentMain}>
        <div className={styles.commentHead}>
          <Link href={`/profile/${encodeURIComponent(c.user.username)}`} className={styles.commentAuthor}>@{c.user.username}</Link>
          <time dateTime={c.createdAt} title={WHEN.format(new Date(c.createdAt))}>{timeAgo(c.createdAt)}</time>
        </div>
        <p className={styles.commentBody}>{c.body}</p>
        <div className={styles.commentActions}>
          <button
            type="button"
            className={`${styles.actionBtn} ${c.liked ? styles.actionLiked : ''}`}
            onClick={() => onLike(c)}
            aria-pressed={c.liked}
            aria-label={c.liked ? 'Unlike comment' : 'Like comment'}
          >
            <Heart size={14} fill={c.liked ? 'currentColor' : 'none'} aria-hidden="true" className={c.liked ? styles.pop : ''} />
            {c.likeCount > 0 && <span>{c.likeCount}</span>}
          </button>
          <button type="button" className={styles.actionBtn} onClick={() => onReply(c)}>
            <CornerDownRight size={14} aria-hidden="true" /> Reply
          </button>
          {c.canDelete && (
            <button type="button" className={`${styles.actionBtn} ${styles.deleteBtn}`} onClick={() => onRemove(c)} aria-label="Remove comment">
              <Trash2 size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ReplyBox({ target, onCancel, onSubmit }: { target: CommentItem; onCancel: () => void; onSubmit: (body: string) => Promise<boolean> }) {
  // Replying to a reply: the thread stays one level deep, so name who you're answering.
  const [text, setText] = useState(target.parentId && target.user ? `@${target.user.username} ` : '');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    await onSubmit(body);
    setBusy(false);
  };
  return (
    <div className={styles.replyBox}>
      <Composer
        value={text}
        onChange={(v) => setText(v.slice(0, MAX))}
        onSubmit={send}
        onCancel={onCancel}
        submitting={busy}
        submitLabel="Reply"
        maxLength={MAX}
        placeholder={`Reply to @${target.user?.username ?? 'comment'}…`}
        replyingTo={target.user?.username ?? null}
        autoFocus
        compact
      />
    </div>
  );
}
