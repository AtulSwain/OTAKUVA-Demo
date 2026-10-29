'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import { StudioLogo } from '../entity/StudioLogo';
import type { DirectorySort, DirectoryStatus, DirectoryStudio, FoundingDecade } from '../../lib/studios/studioDirectory';
import styles from './StudiosDirectory.module.css';

const SORTS: { value: DirectorySort; label: string }[] = [
  { value: 'works', label: 'Most works' },
  { value: 'active', label: 'Recently active' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'A–Z' },
];
const STATUSES: { value: DirectoryStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'closed', label: 'Closed' },
];
const PAGE = 48;
const whole = new Intl.NumberFormat('en-US');

export function StudioCard({ s }: { s: DirectoryStudio }) {
  const span = s.firstYear && s.latestYear ? (s.firstYear === s.latestYear ? `${s.firstYear}` : `${s.firstYear}–${s.latestYear}`) : null;
  return (
    <Link href={`/studio/${s.slug}`} className={styles.card}>
      <span className={styles.stage} aria-hidden="true">
        {s.posters.length > 0 ? (
          <span className={styles.fan} data-count={s.posters.length}>
            {s.posters.map((p, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p} src={p} alt="" loading="lazy" decoding="async" className={styles.fanPoster} style={{ ['--i' as string]: i }} />
            ))}
          </span>
        ) : null}
        <span className={styles.stageShade} />
      </span>
      <span className={styles.logoSlot}>
        <StudioLogo name={s.name} src={s.logoUrl} size="sm" />
      </span>
      <span className={styles.body}>
        <span className={styles.nameRow}>
          <strong className={styles.name}>{s.name}</strong>
          {s.closed && <span className={styles.closed}>Closed</span>}
        </span>
        {s.nativeName && (
          <span className={styles.native} lang="ja">
            {s.nativeName}
          </span>
        )}
        <span className={styles.meta}>
          {s.foundedYear ? <span>Est. {s.foundedYear}</span> : null}
          {s.city ? <span>{s.city}</span> : null}
          {span ? <span className={styles.metaSpan}>Active {span}</span> : null}
        </span>
        <span className={styles.foot}>
          <span className={styles.works}>
            <b>{whole.format(s.works)}</b> {s.works === 1 ? 'work' : 'works'}
          </span>
          {s.knownFor && <span className={styles.known}>{s.knownFor}</span>}
        </span>
      </span>
    </Link>
  );
}

/** A grid of studio cards (the homepage uses it too). */
export function StudioCardGrid({ studios }: { studios: DirectoryStudio[] }) {
  return (
    <div className={styles.grid}>
      {studios.map((s) => (
        <StudioCard key={s.id} s={s} />
      ))}
    </div>
  );
}

export function FoundingTimeline({ decades }: { decades: FoundingDecade[] }) {
  if (decades.length < 2) return null;
  return (
    <ol className={styles.decades}>
      {decades.map((d) => (
        <li key={d.decade} className={styles.decade}>
          <span className={styles.decadeHead}>
            <span className={styles.decadeYear}>{d.decade}s</span>
            <span className={styles.decadeCount}>
              {d.count} {d.count === 1 ? 'studio' : 'studios'}
            </span>
          </span>
          <span className={styles.decadeLine} aria-hidden="true" />
          <ul className={styles.decadeList}>
            {d.studios.map((s) => (
              <li key={s.slug}>
                <Link href={`/studio/${s.slug}`} className={styles.decadeStudio}>
                  <span className={styles.decadeLogo}>
                    <StudioLogo name={s.name} src={s.logoUrl} size="sm" />
                  </span>
                  <span>
                    <strong>{s.name}</strong>
                    <span>{s.foundedYear}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}

export function StudiosDirectory({ initial, total: initialTotal }: { initial: DirectoryStudio[]; total: number }) {
  const [studios, setStudios] = useState(initial);
  const [total, setTotal] = useState(initialTotal);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<DirectorySort>('works');
  const [status, setStatus] = useState<DirectoryStatus>('all');
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);
  const first = useRef(true);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(
    async (offset: number, replace: boolean) => {
      const id = ++reqId.current;
      setLoading(true);
      try {
        const params = new URLSearchParams({ sort, status, offset: String(offset), limit: String(PAGE) });
        if (q.trim()) params.set('q', q.trim());
        const res = await fetch(`/api/studios/directory?${params}`);
        if (!res.ok) return;
        const data: { total: number; studios: DirectoryStudio[] } = await res.json();
        if (id !== reqId.current) return;
        setTotal(data.total);
        setStudios((prev) => (replace ? data.studios : [...prev, ...data.studios.filter((s) => !prev.some((p) => p.id === s.id))]));
      } catch {
        /* keep what is shown */
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [q, sort, status],
  );

  // New search / sort / filter → first page again (debounced for typing).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => load(0, true), q ? 220 : 0);
    return () => clearTimeout(t);
  }, [q, sort, status, load]);

  // Infinite scroll.
  const hasMore = studios.length < total;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && !loading) load(studios.length, false);
    }, { rootMargin: '600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, load, studios.length]);

  return (
    <div className={styles.directory}>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={17} aria-hidden="true" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search studios"
            aria-label="Search studios"
            autoComplete="off"
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear search">
              <X size={15} />
            </button>
          )}
        </label>
        <div className={styles.chips} role="group" aria-label="Sort studios">
          {SORTS.map((o) => (
            <button key={o.value} type="button" className={sort === o.value ? styles.chipOn : styles.chip} aria-pressed={sort === o.value} onClick={() => setSort(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
        <div className={styles.segment} role="group" aria-label="Filter by status">
          {STATUSES.map((o) => (
            <button key={o.value} type="button" className={status === o.value ? styles.segOn : styles.seg} aria-pressed={status === o.value} onClick={() => setStatus(o.value)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <p className={styles.count} aria-live="polite">
        {whole.format(total)} {total === 1 ? 'studio' : 'studios'}
      </p>

      {studios.length === 0 && !loading ? (
        <p className={styles.empty}>No studio matches “{q}”.</p>
      ) : (
        <div className={`${styles.grid} ${loading && studios.length === 0 ? styles.dim : ''}`}>
          {studios.map((s) => (
            <StudioCard key={s.id} s={s} />
          ))}
        </div>
      )}

      {hasMore && (
        <div ref={sentinel} className={styles.more}>
          <button type="button" onClick={() => load(studios.length, false)} disabled={loading}>
            {loading ? 'Loading…' : 'Show more studios'}
          </button>
        </div>
      )}
    </div>
  );
}
