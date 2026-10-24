'use client';

import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';
import styles from '../collections.module.css';

/** Native share sheet where available, otherwise copies the link — and says so. */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // User cancelled the share sheet, or clipboard access was denied.
    }
  };

  return (
    <button type="button" className={styles.actionBtn} onClick={share}>
      {copied ? <Check size={14} aria-hidden="true" /> : <Share2 size={14} aria-hidden="true" />}
      <span>{copied ? 'Link copied' : 'Share'}</span>
    </button>
  );
}
