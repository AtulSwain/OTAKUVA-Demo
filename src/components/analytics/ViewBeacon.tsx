'use client';

import { useEffect } from 'react';

/**
 * Counts one page view for the control center's analytics: once per page per
 * browser session (so refreshes don't inflate it), fire-and-forget. Nothing
 * about the visitor is sent — just which page.
 */
export function ViewBeacon({ kind, id }: { kind: 'anime' | 'news' | 'article' | 'collection' | 'chart' | 'studio' | 'person'; id: string | null | undefined }) {
  useEffect(() => {
    if (!id) return;
    const key = `otakuva-view:${kind}:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      /* storage blocked: still count once per mount */
    }
    const body = JSON.stringify({ kind, id });
    try {
      if (navigator.sendBeacon?.('/api/track/view', new Blob([body], { type: 'application/json' }))) return;
    } catch {
      /* fall through to fetch */
    }
    void fetch('/api/track/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
  }, [kind, id]);
  return null;
}
