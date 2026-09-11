'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import styles from './Comments.module.css';

export interface PickedGif {
  id: string;
  previewUrl: string;
  width: number | null;
  height: number | null;
}

interface GifPickerProps {
  onPick: (gif: PickedGif) => void;
  onClose: () => void;
}

type State =
  | { kind: 'loading' }
  | { kind: 'ready'; results: PickedGif[] }
  | { kind: 'unconfigured' }
  | { kind: 'error'; message: string };

/**
 * Compact GIF search through /api/gifs/search (the provider key stays on the
 * server). Selecting a GIF only records its provider id; the server resolves
 * the real URLs from the provider when the comment is posted.
 */
export const GifPicker: React.FC<GifPickerProps> = ({ onPick, onClose }) => {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<State>({ kind: 'loading' });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setState({ kind: 'loading' });
      try {
        const res = await fetch(`/api/gifs/search?q=${encodeURIComponent(query)}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) return setState({ kind: 'error', message: data.error || 'GIF search failed' });
        if (data.configured === false) return setState({ kind: 'unconfigured' });
        setState({
          kind: 'ready',
          results: (data.results || []).map((g: any) => ({ id: g.id, previewUrl: g.previewUrl, width: g.width, height: g.height })),
        });
      } catch {
        if (!cancelled) setState({ kind: 'error', message: 'GIF search failed. Check your connection.' });
      }
    }, query ? 350 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div className={styles.gifPicker} role="dialog" aria-label="Choose a GIF">
      <div className={styles.gifSearchRow}>
        <Search size={14} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          className={styles.gifSearchInput}
          placeholder="Search GIFs"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search GIFs"
        />
        <button type="button" className={styles.iconBtn} onClick={onClose} aria-label="Close GIF picker">
          <X size={15} aria-hidden="true" />
        </button>
      </div>

      {state.kind === 'loading' && <p className={styles.pickerNote}>Loading GIFs…</p>}
      {state.kind === 'unconfigured' && (
        <p className={styles.pickerNote}>
          GIF search isn’t set up yet. You can still attach a GIF by choosing <strong>Image</strong> and picking a .gif file.
        </p>
      )}
      {state.kind === 'error' && <p className={styles.pickerNote}>{state.message}</p>}
      {state.kind === 'ready' && state.results.length === 0 && <p className={styles.pickerNote}>No GIFs found.</p>}
      {state.kind === 'ready' && state.results.length > 0 && (
        <>
          <div className={styles.gifGrid}>
            {state.results.map((g) => (
              <button key={g.id} type="button" className={styles.gifOption} onClick={() => onPick(g)} aria-label="Attach this GIF">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.previewUrl} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          <p className={styles.gifCredit}>Powered by GIPHY</p>
        </>
      )}
    </div>
  );
};
