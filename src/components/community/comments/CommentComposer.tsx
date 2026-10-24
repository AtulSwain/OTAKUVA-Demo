'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Laugh, X, EyeOff } from 'lucide-react';
import type { CommentDto } from '../../../lib/engine/community/commentService';
import { useAuth } from '../../../context/AuthContext';
import { GifPicker, type PickedGif } from './GifPicker';
import { Composer } from '../../ui/Composer';
import styles from './Comments.module.css';

const MAX_ATTACHMENTS = 4;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif';

type Attachment =
  | { key: string; kind: 'upload'; previewUrl: string; status: 'uploading' | 'ready' | 'error'; mediaId?: string; error?: string }
  | { key: string; kind: 'gif'; previewUrl: string; gifId: string };

export interface ReplyTarget {
  commentId: string;
  username: string;
}

interface CommentComposerProps {
  discussionId: string;
  replyTo?: ReplyTarget | null;
  onCancelReply?: () => void;
  onPosted: (comment: CommentDto) => void;
  /** "sheet" docks to the bottom of the screen (mobile replies). */
  variant?: 'inline' | 'sheet';
  autoFocus?: boolean;
  /** Spoiler level applied when the reader switches Spoiler on. */
  spoilerLevel?: string;
  /** When the viewer can't post here (not a member, locked…), say why. */
  blockedReason?: string | null;
  /** Seed text, e.g. "@username " when replying to a reply. */
  initialText?: string;
}

let keySeq = 0;
const nextKey = () => `a${Date.now().toString(36)}${(keySeq++).toString(36)}`;

export const CommentComposer: React.FC<CommentComposerProps> = ({
  discussionId,
  replyTo = null,
  onCancelReply,
  onPosted,
  variant = 'inline',
  autoFocus = false,
  spoilerLevel = 'ANIME_SPOILER',
  blockedReason = null,
  initialText = '',
}) => {
  const { user, openAuthModal } = useAuth();
  const [text, setText] = useState(initialText);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);

  // Object URLs are previews only; release them when the composer goes away.
  useEffect(() => () => objectUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  if (!user) {
    return (
      <div className={`${styles.composerWrap} ${variant === 'sheet' ? styles.composerSheet : ''}`}>
        <button type="button" className={styles.signInPrompt} onClick={() => openAuthModal('login')}>
          Sign in to join the conversation
        </button>
      </div>
    );
  }

  if (blockedReason) {
    return (
      <div className={`${styles.composerWrap} ${variant === 'sheet' ? styles.composerSheet : ''}`}>
        <p className={styles.blockedNote}>{blockedReason}</p>
        {replyTo && onCancelReply && (
          <button type="button" className={styles.linkBtn} onClick={onCancelReply}>Close</button>
        )}
      </div>
    );
  }

  const uploadsInFlight = attachments.some((a) => a.kind === 'upload' && a.status === 'uploading');
  const hasContent = text.trim().length > 0 || attachments.some((a) => a.kind === 'gif' || a.status === 'ready');
  const room = MAX_ATTACHMENTS - attachments.length;

  const uploadFile = async (file: File) => {
    const key = nextKey();
    const previewUrl = URL.createObjectURL(file);
    objectUrls.current.push(previewUrl);
    setAttachments((prev) => [...prev, { key, kind: 'upload', previewUrl, status: 'uploading' }]);

    const fail = (message: string) =>
      setAttachments((prev) => prev.map((a) => (a.key === key && a.kind === 'upload' ? { ...a, status: 'error', error: message } : a)));

    if (file.size > MAX_FILE_BYTES) return fail('Over 10 MB');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/uploads/comment-media', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return fail(data.error || 'Upload failed');
      setAttachments((prev) =>
        prev.map((a) => (a.key === key && a.kind === 'upload' ? { ...a, status: 'ready', mediaId: data.media.id } : a))
      );
    } catch {
      fail('Upload failed');
    }
  };

  const onFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).slice(0, room).forEach(uploadFile);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeAttachment = (a: Attachment) => {
    setAttachments((prev) => prev.filter((x) => x.key !== a.key));
    // An unposted upload is deleted from storage right away.
    if (a.kind === 'upload' && a.mediaId) {
      fetch(`/api/uploads/comment-media/${a.mediaId}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  const pickGif = (g: PickedGif) => {
    if (room <= 0) return;
    setAttachments((prev) => [...prev, { key: nextKey(), kind: 'gif', previewUrl: g.previewUrl, gifId: g.id }]);
    setGifOpen(false);
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!hasContent || posting || uploadsInFlight) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch(`/api/discussions/${discussionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: text.trim(),
          parentId: replyTo?.commentId,
          spoilerLevel: isSpoiler ? spoilerLevel : 'NO_SPOILER',
          mediaIsSpoiler: isSpoiler,
          mediaIds: attachments.flatMap((a) => (a.kind === 'upload' && a.status === 'ready' && a.mediaId ? [a.mediaId] : [])),
          gifIds: attachments.flatMap((a) => (a.kind === 'gif' ? [a.gifId] : [])),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Nothing is shown as posted unless the server confirmed it.
        setError(data.error || 'Could not post. Please try again.');
        return;
      }
      setText('');
      setAttachments([]);
      setIsSpoiler(false);
      onPosted(data.comment);
    } catch {
      setError('Could not post. Check your connection and try again.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className={`${styles.composerWrap} ${variant === 'sheet' ? styles.composerSheet : ''}`}>
      <Composer
        value={text}
        onChange={setText}
        onSubmit={() => submit()}
        onCancel={
          replyTo && onCancelReply
            ? onCancelReply
            : () => {
                setText('');
                attachments.forEach(removeAttachment);
                setIsSpoiler(false);
              }
        }
        submitting={posting}
        submitLabel={replyTo ? 'Reply' : 'Post'}
        maxLength={5000}
        placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
        replyingTo={replyTo?.username ?? null}
        autoFocus={autoFocus || Boolean(replyTo)}
        canSubmit={hasContent && !uploadsInFlight}
        forceOpen={attachments.length > 0 || gifOpen}
        compact={Boolean(replyTo)}
        tools={
          <>
            <input ref={fileRef} type="file" accept={ACCEPT} multiple hidden onChange={(e) => onFiles(e.target.files)} />
            <button type="button" className={styles.tool} onClick={() => fileRef.current?.click()} disabled={room <= 0} aria-label="Attach an image">
              <ImagePlus size={15} aria-hidden="true" />
              <span className={styles.toolLabel}>Image</span>
            </button>
            <button type="button" className={styles.tool} onClick={() => setGifOpen((v) => !v)} disabled={room <= 0} aria-expanded={gifOpen} aria-label="Attach a GIF">
              <span className={styles.gifGlyph} aria-hidden="true">GIF</span>
            </button>
            {/* A meme is an image; this opens the same picker with a clearer label. */}
            <button type="button" className={styles.tool} onClick={() => fileRef.current?.click()} disabled={room <= 0} aria-label="Attach a meme">
              <Laugh size={15} aria-hidden="true" />
              <span className={styles.toolLabel}>Meme</span>
            </button>
            <button
              type="button"
              className={`${styles.tool} ${isSpoiler ? styles.toolActive : ''}`}
              onClick={() => setIsSpoiler((v) => !v)}
              aria-pressed={isSpoiler}
              aria-label="Mark as spoiler"
            >
              <EyeOff size={15} aria-hidden="true" />
              <span className={styles.toolLabel}>Spoiler</span>
            </button>
          </>
        }
      />

      {attachments.length > 0 && (
        <ul className={styles.attachments} aria-label="Attachments">
          {attachments.map((a) => (
            <li key={a.key} className={styles.attachment}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.previewUrl} alt="" />
              {a.kind === 'upload' && a.status === 'uploading' && <span className={styles.attachmentState}>Uploading…</span>}
              {a.kind === 'upload' && a.status === 'error' && <span className={`${styles.attachmentState} ${styles.attachmentError}`}>{a.error}</span>}
              {a.kind === 'gif' && <span className={styles.gifBadge} aria-hidden="true">GIF</span>}
              <button type="button" className={styles.attachmentRemove} onClick={() => removeAttachment(a)} aria-label="Remove attachment">
                <X size={12} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {gifOpen && <GifPicker onPick={pickGif} onClose={() => setGifOpen(false)} />}

      {error && <p className={styles.composerError} role="alert">{error}</p>}
    </div>
  );
};
