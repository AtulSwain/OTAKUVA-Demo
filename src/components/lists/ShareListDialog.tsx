'use client';

import React, { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Globe, Link2, Lock, RefreshCw, Share2, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import styles from './lists.module.css';

type Visibility = 'PRIVATE' | 'LINK' | 'PUBLIC';

interface ShareListDialogProps {
  isOpen: boolean;
  onClose: () => void;
  listId: string;
  listName: string;
  visibility: Visibility;
  shareToken: string | null;
  /** Called with the server's updated list after any change. */
  onChange: (next: { visibility: Visibility; shareToken: string | null }) => void;
}

const OPTIONS: { value: Visibility; icon: typeof Lock; title: string; desc: string }[] = [
  { value: 'PRIVATE', icon: Lock, title: 'Private', desc: 'Only you can see this list.' },
  { value: 'LINK', icon: Link2, title: 'Anyone with the link', desc: 'Friends can open it from the link. It isn’t listed anywhere.' },
  { value: 'PUBLIC', icon: Globe, title: 'Public', desc: 'Anyone with the link, and it shows on your profile.' },
];

export function ShareListDialog({ isOpen, onClose, listId, listName, visibility, shareToken, onChange }: ShareListDialogProps) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const shareUrl = shareToken && typeof window !== 'undefined' ? `${window.location.origin}/l/${shareToken}` : null;

  const save = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/lists/${listId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      onChange({ visibility: data.list.visibility, shareToken: data.list.shareToken });
      return data.list;
    } catch (e: any) {
      showToast(e?.message || "Couldn't update sharing", 'error');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Copy failed — select the link and copy it manually.', 'error');
    }
  };

  const nativeShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.share({ title: listName, text: `${listName} — an anime list on OTAKUVA`, url: shareUrl });
    } catch {
      // Cancelled by the user.
    }
  };

  return (
    <div className={styles.dialogOverlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="share-list-title">
        <header className={styles.dialogHeader}>
          <h2 id="share-list-title" className={styles.dialogTitle}>Share “{listName}”</h2>
          <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className={styles.options} role="radiogroup" aria-label="Who can see this list">
          {OPTIONS.map((o) => {
            const Icon = o.icon;
            const active = visibility === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={active}
                className={`${styles.option} ${active ? styles.optionActive : ''}`}
                onClick={() => !active && save({ visibility: o.value })}
                disabled={busy}
              >
                <span className={styles.optionIcon}>
                  <Icon size={18} aria-hidden="true" />
                </span>
                <span className={styles.optionText}>
                  <strong>{o.title}</strong>
                  <span>{o.desc}</span>
                </span>
                <span className={`${styles.radio} ${active ? styles.radioOn : ''}`} aria-hidden="true" />
              </button>
            );
          })}
        </div>

        {shareUrl ? (
          <div className={styles.linkBox}>
            <input className={styles.linkInput} value={shareUrl} readOnly onFocus={(e) => e.currentTarget.select()} aria-label="Share link" />
            <div className={styles.linkActions}>
              <button type="button" className={styles.primaryBtn} onClick={copy}>
                {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button type="button" className={styles.ghostBtn} onClick={nativeShare}>
                  <Share2 size={16} aria-hidden="true" /> Share
                </button>
              )}
              <a href={shareUrl} target="_blank" rel="noopener noreferrer" className={styles.ghostBtn}>
                <ExternalLink size={16} aria-hidden="true" /> Preview
              </a>
            </div>
            <button
              type="button"
              className={styles.resetLink}
              disabled={busy}
              onClick={async () => {
                if (!window.confirm('Make a new link? The current link will stop working for anyone who has it.')) return;
                if (await save({ regenerateLink: true })) showToast('New link created. The old one no longer works.', 'success');
              }}
            >
              <RefreshCw size={13} aria-hidden="true" /> Reset link
            </button>
          </div>
        ) : (
          <p className={styles.dialogNote}>Choose “Anyone with the link” to get a link you can send to friends.</p>
        )}
      </div>
    </div>
  );
}
