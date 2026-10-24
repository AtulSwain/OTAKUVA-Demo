import React from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import { AnimeCard } from '../../components/anime/AnimeCard';
import { searchCatalog } from '../../lib/search';
import { BROWSE_GENRES } from '../../lib/browse';
import styles from './search.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Search' };

type Params = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const SORTS = {
  popular: { label: 'Popular Anime', sortBy: 'popularity', sortOrder: 'asc' },
  score: { label: 'Top Rated', sortBy: 'score', sortOrder: 'desc' },
} as const;
type SortId = keyof typeof SORTS;

function href(q: string, genre: string | undefined, sort: SortId, page: number) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (genre) p.set('genre', genre);
  if (sort !== 'popular') p.set('sort', sort);
  if (page > 1) p.set('page', String(page));
  const s = p.toString();
  return s ? `/search?${s}` : '/search';
}

export default async function SearchPage({ searchParams }: { searchParams: Params }) {
  // Only allowlisted or length-limited values ever reach the query.
  const q = (first(searchParams.q) || '').trim().slice(0, 100);
  const genre = BROWSE_GENRES.find((g) => g === first(searchParams.genre));
  const sort: SortId = first(searchParams.sort) === 'score' ? 'score' : 'popular';
  const page = Math.min(50, Math.max(1, parseInt(first(searchParams.page) || '1', 10) || 1));

  const { items, pagination } = await searchCatalog({
    query: q || undefined,
    genre,
    sortBy: SORTS[sort].sortBy,
    sortOrder: SORTS[sort].sortOrder,
    page,
    limit: 24,
  });

  const heading = q ? `Results for “${q}”` : genre ? genre : SORTS[sort].label;

  return (
    <div className={styles.page}>
      {/* Plain GET form: works without JavaScript and keeps the genre filter. */}
      <form action="/search" method="get" role="search" className={styles.searchForm}>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search anime by title"
          aria-label="Search anime by title"
          className={styles.searchInput}
          maxLength={100}
        />
        {genre && <input type="hidden" name="genre" value={genre} />}
        <button type="submit" className={styles.searchBtn}>Search</button>
      </form>
      <h1>{heading}</h1>
      <p className={styles.count}>{pagination.total.toLocaleString()} {pagination.total === 1 ? 'title' : 'titles'}</p>

      {items.length > 0 ? (
        <div className={styles.grid}>
          {items.map((anime) => <AnimeCard key={anime.id} anime={anime as any} viewMode="list" />)}
        </div>
      ) : (
        <p className={styles.empty}>Nothing matched. Check the spelling or <Link href="/top-picks">see Top Picks</Link>.</p>
      )}

      {(page > 1 || pagination.hasNextPage) && (
        <nav className={styles.pager} aria-label="Pages">
          {page > 1 ? <Link href={href(q, genre, sort, page - 1)} className={styles.pageLink}>Previous</Link> : <span />}
          <span className={styles.pageInfo}>Page {page} of {Math.max(1, pagination.totalPages)}</span>
          {pagination.hasNextPage ? <Link href={href(q, genre, sort, page + 1)} className={styles.pageLink}>Next</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
