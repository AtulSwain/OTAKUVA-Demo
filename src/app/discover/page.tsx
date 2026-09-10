'use client';

import React, { useState, useEffect } from 'react';
import { Search, RotateCcw } from 'lucide-react';
import { Anime } from '../../types/anime';
import { AnimeCard } from '../../components/ui/AnimeCard';
import { AnimeGrid } from '../../components/ui/AnimeGrid';
import { EmptyState } from '../../components/ui/EmptyState';
import { AnimeCardSkeleton } from '../../components/ui/Skeleton';
import styles from './discover.module.css';

export default function DiscoverPage() {
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('All');
  const [selectedType, setSelectedType] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedSeason, setSelectedSeason] = useState('All');
  const [selectedYear, setSelectedYear] = useState('All');
  const [selectedDecade, setSelectedDecade] = useState('All');
  const [sortBy, setSortBy] = useState<'score' | 'popularity' | 'title' | 'year'>('score');
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const genres = [
    'All',
    'Action',
    'Adventure',
    'Comedy',
    'Drama',
    'Fantasy',
    'Mystery',
    'Romance',
    'Sci-Fi',
    'Supernatural',
    'Suspense',
    'Sports',
    'Slice of Life',
    'Horror',
    'Psychological',
    'Cyberpunk',
    'Isekai',
    'Mecha',
  ];
  const types = ['All', 'TV', 'Movie', 'ONA', 'OVA', 'Special'];
  const statuses = ['All', 'Airing', 'Finished', 'Not Yet Aired'];
  const seasons = ['All', 'Winter', 'Spring', 'Summer', 'Fall'];
  const years = ['All', '2026', '2025', '2024', '2023', '2022', '2021', '2020', '2019', '2016', '2011', '1998'];
  const decades = ['All', '2020s', '2010s', '2000s', '1990s', '1980s', '1970s', '1960s', '1900s'];

  useEffect(() => {
    let isCancelled = false;
    const fetchCatalog = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('q', search.trim());
        if (selectedGenre !== 'All') params.set('genre', selectedGenre);
        if (selectedType !== 'All') params.set('type', selectedType);
        if (selectedStatus !== 'All') params.set('status', selectedStatus);
        if (selectedSeason !== 'All') params.set('season', selectedSeason);
        if (selectedYear !== 'All') params.set('year', selectedYear);
        if (selectedDecade !== 'All') params.set('decade', selectedDecade);
        params.set('sortBy', sortBy);

        const res = await fetch(`/api/anime?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            const list = data.data || data.animes || [];
            setAnimes(list);
          }
        }
      } catch (err) {
        console.error('Failed to fetch anime catalog:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchCatalog, 200);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [search, selectedGenre, selectedType, selectedStatus, selectedSeason, selectedYear, selectedDecade, sortBy]);

  const handleResetFilters = () => {
    setSearch('');
    setSelectedGenre('All');
    setSelectedType('All');
    setSelectedStatus('All');
    setSelectedSeason('All');
    setSelectedYear('All');
    setSelectedDecade('All');
    setSortBy('score');
  };

  const hasActiveFilters =
    Boolean(search) ||
    selectedGenre !== 'All' ||
    selectedType !== 'All' ||
    selectedStatus !== 'All' ||
    selectedSeason !== 'All' ||
    selectedYear !== 'All' ||
    selectedDecade !== 'All';

  return (
    <div className={styles.discoverPage}>
      {/* Editorial Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>DISCOVER</h1>
          <p className={styles.subtitle}>Find something worth watching.</p>
        </div>

        {hasActiveFilters && (
          <button type="button" className={styles.resetBtn} onClick={handleResetFilters}>
            <RotateCcw size={12} />
            <span>Reset filters</span>
          </button>
        )}
      </header>

      {/* Filter Control Bar */}
      <div className={styles.filterSection}>
        <div className={styles.searchRow}>
          <div className={styles.inputWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search catalog..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.selectGroup}>
            <select
              className={styles.filterSelect}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              aria-label="Filter by format"
            >
              {types.map((t) => (
                <option key={t} value={t}>
                  {t === 'All' ? 'All Formats' : t}
                </option>
              ))}
            </select>

            <select
              className={styles.filterSelect}
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              aria-label="Filter by status"
            >
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {s === 'All' ? 'All Statuses' : s}
                </option>
              ))}
            </select>

            <select
              className={styles.filterSelect}
              value={selectedDecade}
              onChange={(e) => setSelectedDecade(e.target.value)}
              aria-label="Filter by decade"
            >
              {decades.map((d) => (
                <option key={d} value={d}>
                  {d === 'All' ? 'All Decades' : d}
                </option>
              ))}
            </select>

            <select
              className={styles.filterSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              aria-label="Sort catalog by"
            >
              <option value="score">Highest Score</option>
              <option value="popularity">Popularity</option>
              <option value="year">Newest First</option>
              <option value="title">Alphabetical</option>
            </select>
          </div>
        </div>

        {/* Monochrome Genre Chips */}
        <div className={styles.genreChipsRow} role="tablist" aria-label="Filter by genre">
          {genres.map((g) => {
            const isSelected = selectedGenre === g;
            return (
              <button
                key={g}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`${styles.genreChip} ${isSelected ? styles.genreChipActive : ''}`}
                onClick={() => setSelectedGenre(g)}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      {/* Catalog Results Grid */}
      <div className={styles.resultsHeader}>
        <span className={styles.resultsCount}>
          {isLoading ? 'Scanning catalog...' : `${animes.length} titles available`}
        </span>
      </div>

      {isLoading ? (
        <AnimeGrid columns="auto">
          {Array.from({ length: 12 }).map((_, i) => (
            <AnimeCardSkeleton key={i} />
          ))}
        </AnimeGrid>
      ) : animes.length > 0 ? (
        <AnimeGrid columns="auto">
          {animes.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </AnimeGrid>
      ) : (
        <EmptyState
          icon={Search}
          title="No matching titles found"
          description="Try broadening your search criteria or resetting filters to discover more anime."
          actionLabel="Reset all filters"
          onAction={handleResetFilters}
        />
      )}
    </div>
  );
}
