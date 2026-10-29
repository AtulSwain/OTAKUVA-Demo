'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Search, X } from 'lucide-react';
import styles from './control.module.css';

export interface PickedAnime {
  id: string;
  title: string;
  posterUrl?: string | null;
  slug?: string;
  type?: string | null;
  year?: number | null;
  note?: string | null;
}

/** Search the catalog and pick an anime (or a studio with kind="studios"). */
export function SearchPicker({
  kind = 'anime',
  placeholder,
  onPick,
  exclude = [],
}: {
  kind?: 'anime' | 'studios';
  placeholder: string;
  onPick: (item: PickedAnime) => void;
  exclude?: string[];
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PickedAnime[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/control/lookup?kind=${kind}&q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const d = await res.json();
        setResults(
          (d.results || []).map((r: { id: string; title?: string; name?: string; posterUrl?: string | null; slug?: string; type?: string; year?: number }) => ({
            id: r.id,
            title: r.title ?? r.name ?? '',
            posterUrl: r.posterUrl ?? null,
            slug: r.slug,
            type: r.type ?? null,
            year: r.year ?? null,
          })),
        );
        setOpen(true);
      } catch {
        /* aborted */
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, kind]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const shown = results.filter((r) => !exclude.includes(r.id));

  return (
    <div className={styles.picker} ref={box}>
      <label className={styles.search}>
        <Search size={16} aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => results.length && setOpen(true)} placeholder={placeholder} aria-label={placeholder} />
      </label>
      {open && shown.length > 0 && (
        <ul className={styles.pickerList} role="listbox">
          {shown.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className={styles.pickerItem}
                onClick={() => {
                  onPick(r);
                  setQ('');
                  setResults([]);
                  setOpen(false);
                }}
              >
                {kind === 'anime' && (
                  <span className={styles.pickerThumb}>
                    {r.posterUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.posterUrl} alt="" />
                    ) : null}
                  </span>
                )}
                <span className={styles.rowText}>
                  <strong>{r.title}</strong>
                  {kind === 'anime' && <span>{[r.type, r.year].filter(Boolean).join(' · ')}</span>}
                </span>
                <Plus size={16} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A ranked list of anime: move up/down, remove, optional note per entry. */
export function OrderedAnimeList({
  items,
  onChange,
  withNotes = false,
  max,
}: {
  items: PickedAnime[];
  onChange: (items: PickedAnime[]) => void;
  withNotes?: boolean;
  max?: number;
}) {
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    const j = i + d;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className={styles.ordered}>
      {(max === undefined || items.length < max) && (
        <SearchPicker placeholder="Search an anime to add" exclude={items.map((i) => i.id)} onPick={(a) => onChange([...items, a])} />
      )}
      {max !== undefined && (
        <p className={styles.caption}>
          {items.length} of {max}
        </p>
      )}
      <ol className={styles.orderedList}>
        {items.map((a, i) => (
          <li key={a.id} className={styles.orderedRow}>
            <span className={styles.orderedRank}>{i + 1}</span>
            <span className={styles.pickerThumb}>
              {a.posterUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.posterUrl} alt="" />
              ) : null}
            </span>
            <span className={styles.orderedBody}>
              <strong>{a.title}</strong>
              {withNotes && (
                <input
                  className={styles.inputSm}
                  value={a.note ?? ''}
                  maxLength={280}
                  placeholder="Note (optional) — why it's here"
                  onChange={(e) => onChange(items.map((x, k) => (k === i ? { ...x, note: e.target.value } : x)))}
                />
              )}
            </span>
            <span className={styles.orderedBtns}>
              <button type="button" className={styles.iconBtnSm} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
                <ArrowUp size={14} />
              </button>
              <button type="button" className={styles.iconBtnSm} onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label="Move down">
                <ArrowDown size={14} />
              </button>
              <button type="button" className={styles.iconBtnSm} onClick={() => onChange(items.filter((_, k) => k !== i))} aria-label="Remove">
                <X size={14} />
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** A titled block of a form. */
export function FormSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className={styles.formSection}>
      <header className={styles.formSectionHead}>
        <h2>{title}</h2>
        {hint && <p>{hint}</p>}
      </header>
      <div className={styles.formGrid}>{children}</div>
    </section>
  );
}

/** One labelled field. `wide` spans the whole row. */
export function Field({ label, hint, wide, badge, children }: { label: string; hint?: string; wide?: boolean; badge?: string; children: React.ReactNode }) {
  return (
    <div className={`${styles.field} ${wide ? styles.fieldWide : ''}`}>
      <span className={styles.fieldLabel}>
        {label} {badge && <em className={styles.badge}>{badge}</em>}
      </span>
      {children}
      {hint && <span className={styles.fieldHint}>{hint}</span>}
    </div>
  );
}

/** Save-state line + error, used at the bottom of every form. */
export function SaveBar({ busy, label, msg, onSave, extra }: { busy: boolean; label: string; msg: { ok: boolean; text: string } | null; onSave: () => void; extra?: React.ReactNode }) {
  return (
    <div className={styles.saveBar}>
      {msg && <p className={msg.ok ? styles.okMsg : styles.error}>{msg.text}</p>}
      <div className={styles.saveBtns}>
        {extra}
        <button type="button" className={styles.primary} onClick={onSave} disabled={busy}>
          {busy ? 'Saving…' : label}
        </button>
      </div>
    </div>
  );
}
