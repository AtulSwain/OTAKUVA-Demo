'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Building2, Search, User, X } from 'lucide-react';
import { ErrorState } from '../../components/ui/ErrorState';
import styles from './artists.module.css';

/**
 * Creators — everyone credited on anime in the catalog (directors, original
 * creators, writers, composers, designers, animators, voice actors), most
 * credited first. Studios have their own page (/studios).
 */
const ROLES = [
  { id: 'ALL', label: 'All creators' },
  { id: 'DIRECTOR', label: 'Directors' },
  { id: 'ORIGINAL_CREATOR', label: 'Original creators' },
  { id: 'WRITER', label: 'Writers' },
  { id: 'MUSIC', label: 'Music' },
  { id: 'CHARACTER_DESIGN', label: 'Character design' },
  { id: 'ANIMATION', label: 'Animation' },
  { id: 'VOICE_ACTOR', label: 'Voice actors' },
] as const;

const PAGE_SIZE = 48;

interface Creator {
  id: string;
  name: string;
  slug: string;
  nativeName: string | null;
  imageUrl: string | null;
  occupations?: string[];
  creditCount?: number;
  voiceRoleCount?: number;
  topStaffRoles: { role: string; anime: { canonicalTitle: string } | null }[];
  topVoiceRoles: { character: { name: string } | null }[];
}

const cleanRole = (r: string) => r.split(/,(?![^(]*\))/)[0].replace(/\s*\([^)]*\)/g, '').trim();

function CreatorCard({ c }: { c: Creator }) {
  const [failed, setFailed] = useState(false);
  const role = c.occupations?.[0] || (c.topStaffRoles[0] ? cleanRole(c.topStaffRoles[0].role) : c.topVoiceRoles.length ? 'Voice actor' : null);
  const known = c.topStaffRoles.map((s) => s.anime?.canonicalTitle).filter(Boolean).slice(0, 2).join(', ')
    || c.topVoiceRoles.map((v) => v.character?.name).filter(Boolean).slice(0, 2).join(', ');
  const counts = [
    c.creditCount ? `${c.creditCount} ${c.creditCount === 1 ? 'credit' : 'credits'}` : null,
    c.voiceRoleCount ? `${c.voiceRoleCount} voice ${c.voiceRoleCount === 1 ? 'role' : 'roles'}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <Link href={`/person/${c.slug}`} className={styles.card}>
      <span className={styles.photo}>
        {c.imageUrl && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.imageUrl} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />
        ) : (
          <User size={28} aria-hidden="true" />
        )}
      </span>
      <span className={styles.cardText}>
        {role && <span className={styles.role}>{role}</span>}
        <strong>{c.name}</strong>
        {c.nativeName && <span className={styles.native} lang="ja">{c.nativeName}</span>}
        {known && <span className={styles.known}>{known}</span>}
        {counts && <span className={styles.counts}>{counts}</span>}
      </span>
    </Link>
  );
}

export default function CreatorsPage() {
  const [role, setRole] = useState<string>('ALL');
  const [sort, setSort] = useState<'popular' | 'name'>('popular');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Creator[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reload, setReload] = useState(0);
  const requestId = useRef(0);

  const load = useCallback(async (nextPage: number, append: boolean) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(nextPage), role });
      if (sort === 'popular') params.set('sort', 'popular');
      if (query.trim()) params.set('q', query.trim());
      const res = await fetch(`/api/people?${params}`);
      if (!res.ok) throw new Error('people request failed');
      const data = await res.json();
      if (id !== requestId.current) return;
      setItems((prev) => (append ? [...prev, ...(data.people || [])] : data.people || []));
      setTotal(data.totalCount || 0);
      setHasMore(Boolean(data.hasMore));
      setPage(nextPage);
    } catch {
      if (id === requestId.current) setError(true);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [role, sort, query]);

  useEffect(() => {
    const t = setTimeout(() => load(1, false), query.trim() ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, query, reload]);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1>Creators</h1>
          <p>The directors, writers, composers, designers, animators and voice actors behind the anime in the catalog.</p>
        </div>
        <Link href="/studios" className={styles.studiosLink}>
          <Building2 size={16} aria-hidden="true" /> Studios
        </Link>
      </header>

      <nav className={styles.roles} aria-label="Filter by role">
        {ROLES.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`${styles.roleChip} ${role === r.id ? styles.roleChipActive : ''}`}
            aria-pressed={role === r.id}
            onClick={() => setRole(r.id)}
          >
            {r.label}
          </button>
        ))}
      </nav>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search creators by name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search creators"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={14} />
            </button>
          )}
        </label>
        <label className={styles.sort}>
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as 'popular' | 'name')}>
            <option value="popular">Most credited</option>
            <option value="name">A–Z</option>
          </select>
        </label>
      </div>

      {!error && (
        <p className={styles.meta} aria-live="polite">
          {loading && items.length === 0 ? 'Loading creators…' : `${total.toLocaleString()} ${total === 1 ? 'creator' : 'creators'}`}
        </p>
      )}

      {error ? (
        <ErrorState title="Couldn't load creators" message="The creators directory is temporarily unavailable." onRetry={() => setReload((n) => n + 1)} />
      ) : items.length > 0 ? (
        <>
          <div className={styles.grid}>
            {items.map((c) => <CreatorCard key={c.id} c={c} />)}
          </div>
          {hasMore && (
            <button type="button" className={styles.more} onClick={() => load(page + 1, true)} disabled={loading}>
              {loading ? 'Loading…' : 'Load more'}
            </button>
          )}
        </>
      ) : !loading ? (
        <p className={styles.empty}>
          {query.trim() ? `No creators match “${query.trim()}”.` : 'No creators recorded for this role yet.'}
        </p>
      ) : null}
    </div>
  );
}
