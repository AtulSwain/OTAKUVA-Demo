'use client';

import React, { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

/** Native share sheet on phones; otherwise copies the page link and says so. */
export function CopyLinkButton({ title, className }: { title: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `${title} — an anime list on OTAKUVA`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Cancelled, or clipboard unavailable.
    }
  };

  return (
    <button type="button" className={className} onClick={share}>
      {copied ? <Check size={16} aria-hidden="true" /> : <Share2 size={16} aria-hidden="true" />}
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}
