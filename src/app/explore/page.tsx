'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Compass } from 'lucide-react';
import { Anime } from '../../types/anime';
import { AnimeCard } from '../../components/ui/AnimeCard';
import { AnimeCardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import styles from './explore.module.css';

const GENRES = [
  'All',
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Supernatural',
  'Thriller',
];

function ExploreContent() {
  const searchParams = useSearchParams();
  const initialGenre = searchParams?.get('genre') || 'All';

  const [selectedGenre, setSelectedGenre] = useState(initialGenre);
  const [search, setSearch] = useState('');
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchAnimes() {
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams();
        params.set('limit', '50');
        if (search.trim()) params.set('q', search.trim());
        if (selectedGenre !== 'All') params.set('genre', selectedGenre);

        const res = await fetch(`/api/anime?${params.toString()}`);
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);

        const payload = await res.json();
        if (cancelled) return;
        // No results is a real answer — show the empty state, never a
        // stand-in catalog.
        setAnimes(payload.animes || payload.data || []);
      } catch (e) {
        console.error('Failed to fetch explore anime:', e);
        if (!cancelled) {
          setError(true);
          setAnimes([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timer = setTimeout(fetchAnimes, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedGenre, search, reloadToken]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Explore Anime</h1>
        <p className={styles.subtitle}>
          Discover your next masterpiece across genres, themes, and curated pathways.
        </p>
      </header>

      {/* Toolbar: Search + Genre Filter Pills */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search anime titles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className={styles.filterPills} role="tablist">
          {GENRES.map((genre) => (
            <button
              key={genre}
              type="button"
              role="tab"
              aria-selected={selectedGenre === genre}
              className={`${styles.filterPill} ${selectedGenre === genre ? styles.filterPillActive : ''}`}
              onClick={() => setSelectedGenre(genre)}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* Catalog Grid */}
      {loading ? (
        <div className={styles.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <AnimeCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn't load the catalog"
          message="Anime discovery is temporarily unavailable. Your library and tracking data are unaffected."
          onRetry={() => setReloadToken((t) => t + 1)}
        />
      ) : animes.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="No Anime Found"
          description={`No anime matched your query "${search || selectedGenre}". Try selecting another genre.`}
          actionLabel="Reset Filters"
          onAction={() => {
            setSelectedGenre('All');
            setSearch('');
          }}
        />
      ) : (
        <div className={styles.grid}>
          {animes.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense
      fallback={
        <div className={styles.container}>
          <header className={styles.header}>
            <h1 className={styles.title}>Explore Anime</h1>
          </header>
          <div className={styles.grid}>
            {Array.from({ length: 12 }).map((_, i) => (
              <AnimeCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <ExploreContent />
    </Suspense>
  );
}
