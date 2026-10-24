'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import type { CreatorCredit } from '../../../lib/people/creatorProfile';
import styles from './person.module.css';

type Sort = 'newest' | 'oldest' | 'popular';

/** All of a creator's projects, filterable by role and sortable. */
export function CreditsGrid({ credits, topRoles }: { credits: CreatorCredit[]; topRoles: { role: string; count: number }[] }) {
  const [role, setRole] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('newest');
  const [showAll, setShowAll] = useState(false);

  const list = useMemo(() => {
    const filtered = role ? credits.filter((c) => c.roles.includes(role)) : credits;
    const sorted = [...filtered];
    if (sort === 'oldest') sorted.sort((a, b) => (a.anime.year ?? 9999) - (b.anime.year ?? 9999));
    else if (sort === 'popular') sorted.sort((a, b) => (b.anime.members ?? 0) - (a.anime.members ?? 0));
    else sorted.sort((a, b) => (b.anime.year ?? 0) - (a.anime.year ?? 0));
    return sorted;
  }, [credits, role, sort]);

  const visible = showAll ? list : list.slice(0, 24);

  return (
    <>
      <div className={styles.creditTools}>
        {topRoles.length > 1 && (
          <div className={styles.roleFilter} role="group" aria-label="Filter by role">
            <button type="button" className={!role ? styles.filterActive : ''} aria-pressed={!role} onClick={() => setRole(null)}>
              All <span>{credits.length}</span>
            </button>
            {topRoles.map((r) => (
              <button key={r.role} type="button" className={role === r.role ? styles.filterActive : ''} aria-pressed={role === r.role} onClick={() => setRole(r.role)}>
                {r.role} <span>{r.count}</span>
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
          </select>
        </label>
      </div>

      <ul className={styles.creditGrid}>
        {visible.map((c) => (
          <li key={c.anime.id}>
            <Link href={`/anime/${c.anime.slug}`} className={styles.creditCard}>
              <span className={styles.creditPoster}>
                {c.anime.posterUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.anime.posterUrl} alt="" loading="lazy" decoding="async" />
                )}
              </span>
              <span className={styles.creditText}>
                <strong>{c.anime.title}</strong>
                <span className={styles.creditMeta}>{[c.anime.type, c.anime.year].filter(Boolean).join(' · ')}</span>
                <span className={styles.creditRoles}>{c.roles.join(', ')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {list.length > 24 && (
        <button type="button" className={styles.more} onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${list.length}`}
        </button>
      )}
    </>
  );
}
