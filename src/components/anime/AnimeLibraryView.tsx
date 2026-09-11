'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, ArrowLeft, ArrowRight } from 'lucide-react';
import { AnimeCard, AnimeCardItem } from './AnimeCard';
import styles from './AnimeLibraryView.module.css';

const GENRE_OPTIONS = [
  'All',
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
];

const THEME_OPTIONS = [
  'All',
  'Cyberpunk',
  'Historical',
  'Isekai',
  'Mecha',
  'Military',
  'Music',
  'Mythology',
  'School',
  'Space',
  'Super Power',
  'Time Travel',
  'Vampire',
];

const TYPE_OPTIONS = ['All', 'TV', 'Movie', 'OVA', 'ONA', 'Special', 'Music'];
const STATUS_OPTIONS = ['All', 'Currently Airing', 'Finished Airing', 'Upcoming'];
const SEASON_OPTIONS = ['All', 'Winter', 'Spring', 'Summer', 'Fall'];
const YEAR_OPTIONS = [
  'All',
  '2026',
  '2025',
  '2024',
  '2023',
  '2022',
  '2021',
  '2020',
  '2010s',
  '2000s',
  '1990s',
  '1980s',
];

const SORT_OPTIONS = [
  { label: 'Highest Score', value: 'score' },
  { label: 'Most Popular', value: 'popularity' },
  { label: 'Rank', value: 'rank' },
  { label: 'Newest Release', value: 'newest' },
  { label: 'Oldest Release', value: 'oldest' },
  { label: 'Title A-Z', value: 'title' },
  { label: 'Recently Added', value: 'recently_added' },
];

export const AnimeLibraryView: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL States
  const initialPage = parseInt(searchParams?.get('page') || '1', 10);
  const initialQ = searchParams?.get('q') || '';
  const initialGenre = searchParams?.get('genre') || 'All';
  const initialTheme = searchParams?.get('theme') || 'All';
  const initialType = searchParams?.get('type') || 'All';
  const initialStatus = searchParams?.get('status') || 'All';
  const initialSeason = searchParams?.get('season') || 'All';
  const initialYear = searchParams?.get('year') || 'All';
  const initialSort = searchParams?.get('sortBy') || 'score';

  const [page, setPage] = useState(initialPage);
  const [query, setQuery] = useState(initialQ);
  const [genre, setGenre] = useState(initialGenre);
  const [theme, setTheme] = useState(initialTheme);
  const [type, setType] = useState(initialType);
  const [status, setStatus] = useState(initialStatus);
  const [season, setSeason] = useState(initialSeason);
  const [year, setYear] = useState(initialYear);
  const [sortBy, setSortBy] = useState(initialSort);

  const [viewMode, setViewMode] = useState<'grid' | 'compact' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);

  const [animeList, setAnimeList] = useState<AnimeCardItem[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Sync to URL
  const updateUrl = useCallback(
    (newPage: number) => {
      const p = new URLSearchParams();
      if (newPage > 1) p.set('page', String(newPage));
      if (query.trim()) p.set('q', query.trim());
      if (genre !== 'All') p.set('genre', genre);
      if (theme !== 'All') p.set('theme', theme);
      if (type !== 'All') p.set('type', type);
      if (status !== 'All') p.set('status', status);
      if (season !== 'All') p.set('season', season);
      if (year !== 'All') p.set('year', year);
      if (sortBy !== 'score') p.set('sortBy', sortBy);

      const qs = p.toString();
      router.replace(`/anime${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [router, query, genre, theme, type, status, season, year, sortBy]
  );

  // Fetch data
  const fetchAnime = useCallback(async () => {
    setIsLoading(true);
    try {
      const p = new URLSearchParams();
      p.set('page', String(page));
      p.set('limit', '24');
      if (query.trim()) p.set('q', query.trim());
      if (genre !== 'All') p.set('genre', genre);
      if (theme !== 'All') p.set('theme', theme);
      if (type !== 'All') p.set('type', type);
      if (status !== 'All') p.set('status', status);
      if (season !== 'All') p.set('season', season);
      if (year !== 'All') {
        if (year.endsWith('s')) p.set('decade', year);
        else p.set('year', year);
      }
      p.set('sortBy', sortBy);

      const res = await fetch(`/api/anime?${p.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAnimeList(data.items || data.anime || []);
        setTotalItems(data.pagination?.total || data.total || 0);
        setTotalPages(data.pagination?.totalPages || data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load anime library:', err);
    } finally {
      setIsLoading(false);
    }
  }, [page, query, genre, theme, type, status, season, year, sortBy]);

  useEffect(() => {
    fetchAnime();
    updateUrl(page);
  }, [fetchAnime, updateUrl, page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAnime();
  };

  const handleResetFilters = () => {
    setQuery('');
    setGenre('All');
    setTheme('All');
    setType('All');
    setStatus('All');
    setSeason('All');
    setYear('All');
    setSortBy('score');
    setPage(1);
  };

  const hasActiveFilters =
    query.trim() !== '' ||
    genre !== 'All' ||
    theme !== 'All' ||
    type !== 'All' ||
    status !== 'All' ||
    season !== 'All' ||
    year !== 'All';

  return (
    <div className={styles.pageContainer}>
      {/* Top Header */}
      <div className={styles.headerSection}>
        <div className={styles.titleRow}>
          <h1 className={styles.pageTitle}>ANIME</h1>
          <div className={styles.rightControls}>
            {/* View Mode Toggle */}
            <div className={styles.viewModeToggle}>
              <button
                type="button"
                className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
                onClick={() => setViewMode('grid')}
                title="Cinematic Grid"
              >
                Grid
              </button>
              <button
                type="button"
                className={`${styles.viewBtn} ${viewMode === 'compact' ? styles.viewBtnActive : ''}`}
                onClick={() => setViewMode('compact')}
                title="Compact Grid"
              >
                Compact
              </button>
              <button
                type="button"
                className={`${styles.viewBtn} ${viewMode === 'list' ? styles.viewBtnActive : ''}`}
                onClick={() => setViewMode('list')}
                title="List View"
              >
                List
              </button>
            </div>
          </div>
        </div>
        <p className={styles.subTitle}>Explore the OTAKUVA anime catalog.</p>
      </div>

      {/* Main Controls Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.searchSortRow}>
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className={styles.searchWrapper}>
            <Search size={14} className={styles.searchIcon} aria-hidden="true" />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search anime title, Japanese name, studio..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>

          {/* Quick Sort Select */}
          <select
            className={styles.selectBox}
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value);
              setPage(1);
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                Sort: {opt.label}
              </option>
            ))}
          </select>

          {/* Filter Drawer Toggle */}
          <button
            type="button"
            className={`${styles.filterToggleBtn} ${showFilters ? styles.filterToggleBtnActive : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={14} aria-hidden="true" />
            <span>Filters {hasActiveFilters ? '• Active' : ''}</span>
          </button>
        </div>

        {/* Expanded Filters Panel */}
        {showFilters && (
          <div className={styles.filtersPanel}>
            {/* Genre */}
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Genre</span>
              <select
                className={styles.selectBox}
                value={genre}
                onChange={(e) => {
                  setGenre(e.target.value);
                  setPage(1);
                }}
              >
                {GENRE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            {/* Theme */}
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Theme</span>
              <select
                className={styles.selectBox}
                value={theme}
                onChange={(e) => {
                  setTheme(e.target.value);
                  setPage(1);
                }}
              >
                {THEME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Format / Type */}
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Format</span>
              <select
                className={styles.selectBox}
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
              >
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {/* Airing Status */}
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Status</span>
              <select
                className={styles.selectBox}
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Season */}
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Season</span>
              <select
                className={styles.selectBox}
                value={season}
                onChange={(e) => {
                  setSeason(e.target.value);
                  setPage(1);
                }}
              >
                {SEASON_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Release Year */}
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Year</span>
              <select
                className={styles.selectBox}
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setPage(1);
                }}
              >
                {YEAR_OPTIONS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results Stats & Active Pills */}
      <div className={styles.statsRow}>
        <span>
          Showing {animeList.length} of {totalItems} titles
        </span>
        {hasActiveFilters && (
          <button type="button" className={styles.resetBtn} onClick={handleResetFilters}>
            Reset all filters
          </button>
        )}
      </div>

      {/* Anime Results Display */}
      {isLoading ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>Loading catalog...</p>
        </div>
      ) : animeList.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No anime found</p>
          <p className={styles.emptyDesc}>
            Try adjusting your search query or removing active filters to find matching titles.
          </p>
          {hasActiveFilters && (
            <button type="button" className={styles.resetBtn} onClick={handleResetFilters}>
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <div
          className={
            viewMode === 'list'
              ? styles.animeList
              : viewMode === 'compact'
              ? styles.animeCompactGrid
              : styles.animeGrid
          }
        >
          {animeList.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} viewMode={viewMode} />
          ))}
        </div>
      )}

      {/* Server/API Pagination */}
      {totalPages > 1 && (
        <div className={styles.paginationRow}>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page <= 1 || isLoading}
            onClick={() => {
              setPage((prev) => Math.max(1, prev - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <ArrowLeft size={14} aria-hidden="true" /> Previous
          </button>
          <span className={styles.pageIndicator}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className={styles.pageBtn}
            disabled={page >= totalPages || isLoading}
            onClick={() => {
              setPage((prev) => Math.min(totalPages, prev + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Next <ArrowRight size={13} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
