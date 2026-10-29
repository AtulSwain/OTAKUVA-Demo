'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Check, Loader2, Pencil, Search } from 'lucide-react';
import { ImageField } from './ImageField';
import styles from './control.module.css';

export interface ImageListConfig<T> {
  kicker: string;
  title: string;
  endpoint: string; // GET list, PATCH `${endpoint}/:id`
  listKey: string; // e.g. 'people'
  imageKey: 'imageUrl' | 'logoUrl';
  missingValue: string; // e.g. 'photo'
  missingLabel: string; // e.g. 'No photo'
  kind: 'photo' | 'logo' | 'character';
  shape: 'poster' | 'square';
  searchPlaceholder: string;
  href: (row: T) => string | null;
  subtitle: (row: T) => string;
}

type BaseRow = { id: string; name: string; imageUrl?: string | null; logoUrl?: string | null };
const fmt = new Intl.NumberFormat('en-US');
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');

function Card<T extends BaseRow>({ row, cfg, onSaved }: { row: T; cfg: ImageListConfig<T>; onSaved: (id: string, url: string | null) => void }) {
  const current = (row[cfg.imageKey] as string | null | undefined) || '';
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const href = cfg.href(row);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${cfg.endpoint}/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [cfg.imageKey]: value.trim() || null }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Could not save.');
      onSaved(row.id, value.trim() || null);
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={styles.card}>
      <div className={`${styles.cardImg} ${cfg.shape === 'square' ? styles.cardImgSquare : ''}`}>
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current} alt="" loading="lazy" />
        ) : (
          <span>{initials(row.name)}</span>
        )}
      </div>
      <div className={styles.cardBody}>
        {href ? (
          <Link href={href} target="_blank" className={styles.cardName}>
            {row.name}
          </Link>
        ) : (
          <strong className={styles.cardName}>{row.name}</strong>
        )}
        <span className={styles.cardSub}>{cfg.subtitle(row)}</span>
        {!open ? (
          <button
            type="button"
            className={styles.secondary}
            onClick={() => {
              setValue(current);
              setOpen(true);
            }}
          >
            <Pencil size={13} /> {current ? 'Change image' : 'Add image'}
          </button>
        ) : (
          <div className={styles.cardEdit}>
            <ImageField label="Image" kind={cfg.kind} shape={cfg.shape} value={value} onChange={setValue} />
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.imageBtns}>
              <button type="button" className={styles.primary} onClick={save} disabled={busy}>
                {busy ? <Loader2 size={14} className={styles.spin} /> : <Check size={14} />} Save
              </button>
              <button type="button" className={styles.ghost} onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

export function ImageList<T extends BaseRow>({ cfg }: { cfg: ImageListConfig<T> }) {
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [missing, setMissing] = useState(params?.get('missing') === cfg.missingValue);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams({ page: String(page), limit: '24' });
    if (q.trim()) sp.set('q', q.trim());
    if (missing) sp.set('missing', cfg.missingValue);
    try {
      const res = await fetch(`${cfg.endpoint}?${sp}`);
      const d = await res.json();
      setRows(d[cfg.listKey] || []);
      setTotal(d.total || 0);
    } finally {
      setLoading(false);
    }
  }, [q, missing, page, cfg.endpoint, cfg.listKey, cfg.missingValue]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const pages = Math.max(1, Math.ceil(total / 24));

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.kicker}>{cfg.kicker}</p>
        <h1 className={styles.title}>{cfg.title}</h1>
      </header>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder={cfg.searchPlaceholder}
            aria-label={cfg.searchPlaceholder}
          />
        </label>
        <div className={styles.chips}>
          <button type="button" className={!missing ? styles.chipOn : styles.chip} onClick={() => { setMissing(false); setPage(1); }}>
            All
          </button>
          <button type="button" className={missing ? styles.chipOn : styles.chip} onClick={() => { setMissing(true); setPage(1); }}>
            {cfg.missingLabel}
          </button>
        </div>
      </div>
      <p className={styles.caption}>{loading ? 'Loading…' : `${fmt.format(total)} found`}</p>
      <ul className={styles.cards}>
        {rows.map((r) => (
          <Card
            key={r.id}
            row={r}
            cfg={cfg}
            onSaved={(id, url) => setRows((list) => list.map((x) => (x.id === id ? { ...x, [cfg.imageKey]: url } : x)))}
          />
        ))}
      </ul>
      {pages > 1 && (
        <nav className={styles.pager} aria-label="Pages">
          <button type="button" className={styles.secondary} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {fmt.format(pages)}
          </span>
          <button type="button" className={styles.secondary} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
