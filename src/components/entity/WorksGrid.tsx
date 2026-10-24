'use client';

import React, { useMemo, useState } from 'react';
import { CommunityScoreBadge } from '../rating/CommunityScoreBadge';
import Link from 'next/link';

import styles from './Entity.module.css';

export interface GridWork {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  type: string | null;
  year: number | null;
  score: number | null;
  members: number | null;
  /** What this entity did on it: roles for a creator, the credit for a studio. */
  tags: string[];
}

type Sort = 'newest' | 'oldest' | 'popular' | 'score';

/**
 * Every work of a studio or creator, filterable (by format or role) and
 * sortable. Same grid on both pages.
 */
export function WorksGrid({
  works,
  filters,
  filterBy,
  filterLabel,
  pageSize = 24,
}: {
  works: GridWork[];
  /** Chip options with counts, e.g. formats ("TV", "Movie") or roles ("Director"). */
  filters: { value: string; count: number }[];
  /** Which field the chips filter on. */
  filterBy: 'type' | 'tags';
  filterLabel: string;
  pageSize?: number;
}) {
  const [filter, setFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('newest');
  const [showAll, setShowAll] = useState(false);

  const list = useMemo(() => {
    const filtered = !filter ? works : works.filter((w) => (filterBy === 'type' ? w.type === filter : w.tags.includes(filter)));
    const sorted = [...filtered];
    if (sort === 'oldest') sorted.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
    else if (sort === 'popular') sorted.sort((a, b) => (b.members ?? 0) - (a.members ?? 0));
    else if (sort === 'score') sorted.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
    else sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0));
    return sorted;
  }, [works, filter, filterBy, sort]);

  const visible = showAll ? list : list.slice(0, pageSize);

  return (
    <>
      <div className={styles.tools}>
        {filters.length > 1 && (
          <div className={styles.chips} role="group" aria-label={filterLabel}>
            <button type="button" className={!filter ? styles.chipOn : ''} aria-pressed={!filter} onClick={() => setFilter(null)}>
              All <span>{works.length}</span>
            </button>
            {filters.map((f) => (
              <button key={f.value} type="button" className={filter === f.value ? styles.chipOn : ''} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
                {f.value} <span>{f.count}</span>
              </button>
            ))}
          </div>
        )}
        <label className={styles.sort}>
          <span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="popular">Most popular</option>
            <option value="score">Highest score</option>
          </select>
        </label>
      </div>

      <ul className={styles.worksGrid}>
        {visible.map((w) => (
          <li key={w.id}>
            <Link href={`/anime/${w.slug}`} className={styles.workCard}>
              <span className={styles.workPoster}>
                {w.posterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.posterUrl} alt="" loading="lazy" decoding="async" />
                )}
                {/* Members' OTAKUVA score + retention (not the provider score). */}
                <CommunityScoreBadge animeId={w.id} variant="overlay" />
              </span>
              <strong>{w.title}</strong>
              <span className={styles.workMeta}>{[w.type, w.year].filter(Boolean).join(' · ')}</span>
              {w.tags.length > 0 && <span className={styles.workTags}>{w.tags.slice(0, 2).join(', ')}</span>}
            </Link>
          </li>
        ))}
      </ul>
      {list.length > pageSize && (
        <button type="button" className={styles.showMore} onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${list.length}`}
        </button>
      )}
    </>
  );
}
