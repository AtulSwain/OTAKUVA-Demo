'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Send, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { UserAvatar } from './UserAvatar';
import styles from './Composer.module.css';

/**
 * The site's one comment box (2026-10-19). At rest it's just an avatar and a
 * line with an underline, blended into the page; focused (or holding text)
 * it opens up — growing text area, gradient underline, a toolbar with a
 * character count, Cancel and Post. Logic stays with the caller: it gets the
 * text and decides what posting means.
 */
export function Composer({
  value,
  onChange,
  onSubmit,
  onCancel,
  placeholder = 'Add a comment…',
  submitLabel = 'Post',
  submitting = false,
  maxLength = 2000,
  autoFocus = false,
  replyingTo,
  tools,
  canSubmit,
  compact = false,
  ariaLabel,
  forceOpen = false,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void | Promise<unknown>;
  /** Shown as "Cancel"; also clears and collapses. Escape does the same. */
  onCancel?: () => void;
  placeholder?: string;
  submitLabel?: string;
  submitting?: boolean;
  maxLength?: number;
  autoFocus?: boolean;
  /** "Replying to @name" chip. */
  replyingTo?: string | null;
  /** Extra buttons for the toolbar (attachments, spoiler toggle…). */
  tools?: React.ReactNode;
  /** Override when there's postable content besides text (e.g. an attachment). */
  canSubmit?: boolean;
  /** Smaller avatar/text for replies. */
  compact?: boolean;
  ariaLabel?: string;
  /** Keep the box open regardless of focus (e.g. while attachments are pending). */
  forceOpen?: boolean;
}) {
  const { user, openAuthModal } = useAuth();
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const open = forceOpen || focused || value.length > 0 || autoFocus || Boolean(replyingTo);
  const ready = canSubmit ?? value.trim().length > 0;

  useEffect(() => {
    if (autoFocus && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(ref.current.value.length, ref.current.value.length);
    }
  }, [autoFocus]);

  // Grow with the text, up to about ten lines.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, open ? 240 : 44)}px`;
  }, [value, open]);

  if (!user) {
    return (
      <button type="button" className={styles.signIn} onClick={() => openAuthModal('login')}>
        <span className={styles.signInAvatar} aria-hidden="true" />
        <span>Sign in to join the conversation</span>
      </button>
    );
  }

  const send = () => {
    if (!ready || submitting) return;
    void onSubmit();
  };
  const cancel = () => {
    onCancel?.();
    ref.current?.blur();
    setFocused(false);
  };
  const left = maxLength - value.length;

  return (
    <form
      className={`${styles.composer} ${open ? styles.open : ''} ${compact ? styles.compact : ''}`}
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      // Open while focus is anywhere inside (text area or toolbar), not just the text area.
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
      aria-label={ariaLabel ?? (replyingTo ? `Reply to ${replyingTo}` : 'Write a comment')}
    >
      <UserAvatar username={user.username} avatarUrl={user.avatarUrl} size={compact ? 28 : 36} />
      <div className={styles.body}>
        {replyingTo && (
          <span className={styles.replying}>
            Replying to <strong>@{replyingTo}</strong>
          </span>
        )}
        <textarea
          ref={ref}
          className={styles.input}
          rows={1}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
            if (e.key === 'Escape') cancel();
          }}
        />
        <span className={styles.line} aria-hidden="true" />
        <div className={styles.toolbar} aria-hidden={!open}>
          <div className={styles.tools}>{tools}</div>
          <span className={`${styles.count} ${left < 100 ? styles.countLow : ''}`}>{left < 300 ? `${left} left` : 'Ctrl + Enter to post'}</span>
          {(onCancel || value.length > 0) && (
            <button
              type="button"
              className={styles.cancel}
              // Keep focus from leaving before the click lands.
              onMouseDown={(e) => e.preventDefault()}
              onClick={cancel}
              tabIndex={open ? 0 : -1}
            >
              <X size={14} aria-hidden="true" /> Cancel
            </button>
          )}
          <button type="submit" className={styles.submit} disabled={!ready || submitting} tabIndex={open ? 0 : -1} onMouseDown={(e) => e.preventDefault()}>
            <Send size={13} aria-hidden="true" />
            {submitting ? 'Posting…' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
