'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Plus, Search } from 'lucide-react';
import styles from '../control.module.css';

type Row = {
  id: string;
  slug: string;
  canonicalTitle: string;
  type: string | null;
  year: number | null;
  status: string | null;
  posterUrl: string;
  bannerUrl: string | null;
  trailerUrl: string | null;
  hasSynopsis: boolean;
  anilistId: number | null;
  malId: number | null;
  overrides: string[];
};

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'banner', label: 'No banner' },
  { value: 'trailer', label: 'No trailer' },
  { value: 'poster', label: 'No poster' },
  { value: 'synopsis', label: 'No synopsis' },
];
const fmt = new Intl.NumberFormat('en-US');

function AddAnime({ onAdded }: { onAdded: (id: string) => void }) {
  const [source, setSource] = useState<'anilistId' | 'malId'>('anilistId');
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = value.trim();
    // Accept a pasted AniList / MAL link too.
    const id = /(\d+)/.exec(raw)?.[1];
    if (!id) return;
    const src = /myanimelist\.net/i.test(raw) ? 'malId' : /anilist\.co/i.test(raw) ? 'anilistId' : source;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch('/api/control/anime', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [src]: id }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Could not add it.');
      setMsg({ ok: true, text: `${out.isNew ? 'Added' : 'Refreshed'}: ${out.title}` });
      setValue('');
      onAdded(out.animeId);
    } catch (err) {
      setMsg({ ok: false, text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={styles.addBox} onSubmit={add}>
      <div className={styles.addRow}>
        <select className={styles.select} value={source} onChange={(e) => setSource(e.target.value as 'anilistId' | 'malId')} aria-label="ID source">
          <option value="anilistId">AniList ID</option>
          <option value="malId">MyAnimeList ID</option>
        </select>
        <input className={styles.input} value={value} onChange={(e) => setValue(e.target.value)} placeholder="ID or link, e.g. 154587" inputMode="numeric" />
        <button type="submit" className={styles.primary} disabled={busy || !value.trim()}>
          {busy ? <Loader2 size={16} className={styles.spin} /> : <Plus size={16} />} Add anime
        </button>
      </div>
      {msg && <p className={msg.ok ? styles.okMsg : styles.error}>{msg.text}</p>}
    </form>
  );
}

function AnimeControl() {
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [missing, setMissing] = useState(params?.get('missing') || '');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams({ page: String(page), limit: '30' });
    if (q.trim()) sp.set('q', q.trim());
    if (missing) sp.set('missing', missing);
    try {
      const res = await fetch(`/api/control/anime?${sp}`);
      const d = await res.json();
      setRows(d.anime || []);
      setTotal(d.total || 0);
    } finally {
      setLoading(false);
    }
  }, [q, missing, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const pages = Math.max(1, Math.ceil(total / 30));

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.kicker}>Catalog</p>
        <h1 className={styles.title}>Anime</h1>
      </header>

      <div className={styles.headActions}>
        <Link href="/control/anime/new" className={styles.primary}>
          <Plus size={16} /> New anime (fill the form)
        </Link>
      </div>
      <AddAnime onAdded={(id) => router.push(`/control/anime/${id}`)} />

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Search title, or AniList / MAL ID"
            aria-label="Search anime"
          />
        </label>
        <div className={styles.chips}>
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={missing === f.value ? styles.chipOn : styles.chip}
              onClick={() => {
                setMissing(f.value);
                setPage(1);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <p className={styles.caption}>{loading ? 'Loading…' : `${fmt.format(total)} anime · most-watched first`}</p>

      <ul className={styles.list}>
        {rows.map((a) => (
          <li key={a.id}>
            <Link href={`/control/anime/${a.id}`} className={styles.rowBtn}>
              <span className={styles.thumb}>
                {a.posterUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.posterUrl} alt="" loading="lazy" />
                ) : null}
              </span>
              <span className={styles.rowText}>
                <strong>{a.canonicalTitle}</strong>
                <span>{[a.type, a.year, a.status].filter(Boolean).join(' · ')}</span>
                <span className={styles.tags}>
                  {!a.posterUrl && <em className={styles.miss}>No poster</em>}
                  {!a.bannerUrl && <em className={styles.miss}>No banner</em>}
                  {!a.trailerUrl && <em className={styles.miss}>No trailer</em>}
                  {!a.hasSynopsis && <em className={styles.miss}>No synopsis</em>}
                  {a.overrides.length > 0 && <em className={styles.badge}>Edited</em>}
                </span>
              </span>
            </Link>
          </li>
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

export default function ControlAnimePage() {
  return (
    <Suspense fallback={null}>
      <AnimeControl />
    </Suspense>
  );
}
