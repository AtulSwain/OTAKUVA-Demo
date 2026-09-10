'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Search, Compass } from 'lucide-react';
import { Anime } from '../../types/anime';
import { FIXTURE_ANIMES } from '../../fixtures/anime.fixture';
import { AnimeCard } from '../../components/ui/AnimeCard';
import { AnimeCardSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
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
  const [animes, setAnimes] = useState<Anime[]>(FIXTURE_ANIMES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnimes() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', '50');
        if (search.trim()) params.set('q', search.trim());
        if (selectedGenre !== 'All') params.set('genre', selectedGenre);

        const res = await fetch(`/api/anime?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.animes && data.animes.length > 0) {
            setAnimes(data.animes);
          } else if (data.data && data.data.length > 0) {
            setAnimes(data.data);
          }
        }
      } catch (e) {
        console.error('Failed to fetch explore anime:', e);
      } finally {
        setLoading(false);
      }
    }

    const timer = setTimeout(fetchAnimes, 200);
    return () => clearTimeout(timer);
  }, [selectedGenre, search]);

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
