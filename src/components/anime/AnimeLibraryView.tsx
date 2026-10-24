'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SlidersHorizontal, ArrowLeft, ArrowRight, X, LayoutGrid, Grid3x3, List } from 'lucide-react';
import { AnimeCard, AnimeCardItem } from './AnimeCard';
import { ExploreSearch } from './ExploreSearch';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { resolveAvatarUrl } from '../../lib/mediaResolver';
import type { PlatformStats } from '../../lib/platformStats';
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
  '2020s',
  '2010s',
  '2000s',
  '1990s',
  '1980s',
  '1970s',
];

/** One-tap format and status filters shown under the search bar. */
const QUICK_FORMATS = [
  { label: 'TV', value: 'TV' },
  { label: 'Movies', value: 'Movie' },
  { label: 'OVA', value: 'OVA' },
  { label: 'ONA', value: 'ONA' },
];
const QUICK_STATUS = [
  { label: 'Airing now', value: 'Currently Airing' },
  { label: 'Finished', value: 'Finished Airing' },
  { label: 'Upcoming', value: 'Upcoming' },
];
const POPULAR_GENRES = ['Action', 'Romance', 'Comedy', 'Fantasy', 'Slice of Life', 'Mystery', 'Sci-Fi', 'Sports'];

const SORT_OPTIONS = [
  { label: 'Highest Score', value: 'score' },
  { label: 'Most Popular', value: 'popularity' },
  { label: 'Rank', value: 'rank' },
  { label: 'Newest Release', value: 'newest' },
  { label: 'Oldest Release', value: 'oldest' },
  { label: 'Title A-Z', value: 'title' },
  { label: 'Recently Added', value: 'recently_added' },
];

/** Current anime season from the calendar (Winter = Jan–Mar …). */
function currentSeason(d: Date) {
  const m = d.getMonth();
  return { season: m < 3 ? 'Winter' : m < 6 ? 'Spring' : m < 9 ? 'Summer' : 'Fall', year: d.getFullYear() };
}

export const AnimeLibraryView: React.FC = () => {
  const router = useRouter();
  const { user, openAuthModal } = useAuth();
  const [platform, setPlatform] = useState<PlatformStats | null>(null);
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    setToday(new Date());
    fetch('/api/platform-stats')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPlatform(d))
      .catch(() => {
        /* the counts just don't show */
      });
  }, []);
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
  // `draft` is what's in the search box; `query` follows it after a short
  // pause, so the grid updates as you type without a request per keystroke.
  const [draft, setDraft] = useState(initialQ);
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
        setAnimeList(data.animes || data.items || data.anime || []); // GET /api/anime returns `animes`
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

  useEffect(() => {
    if (draft === query) return;
    const t = setTimeout(() => {
      setQuery(draft);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [draft, query]);

  const commitSearch = (v: string) => {
    setDraft(v);
    setQuery(v);
    setPage(1);
  };

  const handleResetFilters = () => {
    setDraft('');
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

  // Every active filter as a removable chip.
  const activeChips: { key: string; label: string; clear: () => void }[] = [
    ...(query.trim() ? [{ key: 'q', label: `“${query.trim()}”`, clear: () => commitSearch('') }] : []),
    ...(genre !== 'All' ? [{ key: 'genre', label: genre, clear: () => { setGenre('All'); setPage(1); } }] : []),
    ...(theme !== 'All' ? [{ key: 'theme', label: theme, clear: () => { setTheme('All'); setPage(1); } }] : []),
    ...(type !== 'All' ? [{ key: 'type', label: type, clear: () => { setType('All'); setPage(1); } }] : []),
    ...(status !== 'All' ? [{ key: 'status', label: status, clear: () => { setStatus('All'); setPage(1); } }] : []),
    ...(season !== 'All' ? [{ key: 'season', label: season, clear: () => { setSeason('All'); setPage(1); } }] : []),
    ...(year !== 'All' ? [{ key: 'year', label: year, clear: () => { setYear('All'); setPage(1); } }] : []),
  ];
  const drawerCount = [theme, season, year].filter((v) => v !== 'All').length;

  return (
    <div className={styles.pageContainer}>
      {/* Masthead: who you are, the search, and the catalog in numbers */}
      <header className={styles.masthead}>
        <p className={styles.dateline}>
          <span className={styles.datelineKicker}>Explore</span>
          {today && (
            <>
              <span className={styles.dot} aria-hidden="true" />
              <span>{today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
              <span className={styles.dot} aria-hidden="true" />
              <Link href="/seasonal">
                {currentSeason(today).season} {currentSeason(today).year} season
              </Link>
            </>
          )}
        </p>
        <div className={styles.greeting}>
          {user ? (
            <>
              <Link href={`/profile/${user.username}`} className={styles.avatar} aria-label="Your profile">
                {resolveAvatarUrl(user.avatarUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveAvatarUrl(user.avatarUrl) as string} alt="" />
                ) : (
                  <span>{user.username.slice(0, 1).toUpperCase()}</span>
                )}
              </Link>
              <div className={styles.greetingText}>
                <h1 className={styles.mastheadTitle}>
                  Welcome back, <em>{user.displayName || `@${user.username}`}</em>
                </h1>
                <p className={styles.handle}>
                  {user.displayName ? <span>@{user.username}</span> : null}
                  {!user.displayName && (
                    <Link href={`/profile/${user.username}`}>Add your name</Link>
                  )}
                  <span className={styles.handleNote}>What are we watching today?</span>
                </p>
              </div>
            </>
          ) : (
            <h1 className={styles.mastheadTitle}>
              Find your next <em>anime</em>.
            </h1>
          )}
        </div>
        {/* Search + sort + more filters */}
        <div className={styles.searchSortRow}>
          <ExploreSearch
            value={draft}
            onChange={setDraft}
            onCommit={commitSearch}
            genres={POPULAR_GENRES}
            onPickGenre={(g) => {
              setGenre(g);
              setPage(1);
            }}
            total={!isLoading && query.trim() === draft.trim() ? totalItems : null}
          />

          <label className={styles.sortField}>
            <span>Sort</span>
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
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className={`${styles.filterToggleBtn} ${showFilters ? styles.filterToggleBtnActive : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
          >
            <SlidersHorizontal size={15} aria-hidden="true" />
            <span className={styles.filterLong}>More filters</span>
            <span className={styles.filterShort}>Filters</span>
            {drawerCount > 0 && <span className={styles.filterCount}>{drawerCount}</span>}
          </button>
        </div>

        <div className={styles.mastheadFoot}>
          <ul className={styles.platformStats} aria-label="OTAKUVA in numbers">
            {platform &&
              ([
                [platform.anime, 'anime'],
                [platform.people, 'creators & cast'],
                [platform.members, platform.members === 1 ? 'member' : 'members'],
                [platform.articles, platform.articles === 1 ? 'article' : 'articles'],
                [platform.reviews, platform.reviews === 1 ? 'review' : 'reviews'],
              ] as [number, string][])
                .filter(([n]) => n > 0)
                .map(([n, label]) => (
                  <li key={label}>
                    <strong>{n.toLocaleString('en-US')}</strong>
                    <span>{label}</span>
                  </li>
                ))}
          </ul>
          <div className={styles.mastheadRight}>
            {!user && (
              <button type="button" className={styles.joinBtn} onClick={() => openAuthModal('register')}>
                Join OTAKUVA
              </button>
            )}
            <div className={styles.viewModeToggle} role="group" aria-label="Layout">
              {([
                ['grid', 'Grid', LayoutGrid],
                ['compact', 'Compact', Grid3x3],
                ['list', 'List', List],
              ] as const).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  type="button"
                  className={`${styles.viewBtn} ${viewMode === mode ? styles.viewBtnActive : ''}`}
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  title={`${label} view`}
                >
                  <Icon size={14} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className={styles.controlsBar}>

        {/* One-tap filters */}
        <div className={styles.quickRow}>
          <div className={styles.quickGroup} role="group" aria-label="Format">
            {QUICK_FORMATS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`${styles.quickChip} ${type === f.value ? styles.quickChipOn : ''}`}
                aria-pressed={type === f.value}
                onClick={() => {
                  setType(type === f.value ? 'All' : f.value);
                  setPage(1);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className={styles.quickDivider} aria-hidden="true" />
          <div className={styles.quickGroup} role="group" aria-label="Status">
            {QUICK_STATUS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={`${styles.quickChip} ${status === f.value ? styles.quickChipOn : ''}`}
                aria-pressed={status === f.value}
                onClick={() => {
                  setStatus(status === f.value ? 'All' : f.value);
                  setPage(1);
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className={styles.quickDivider} aria-hidden="true" />
          <div className={`${styles.quickGroup} ${styles.quickScroll}`} role="group" aria-label="Genre">
            {GENRE_OPTIONS.filter((g) => g !== 'All').map((g) => (
              <button
                key={g}
                type="button"
                className={`${styles.quickChip} ${genre === g ? styles.quickChipOn : ''}`}
                aria-pressed={genre === g}
                onClick={() => {
                  setGenre(genre === g ? 'All' : g);
                  setPage(1);
                }}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        {/* Expanded filters: the less common ones */}
        {showFilters && (
          <div className={styles.filtersPanel}>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Theme</span>
              <select className={styles.selectBox} value={theme} onChange={(e) => { setTheme(e.target.value); setPage(1); }}>
                {THEME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Season</span>
              <select className={styles.selectBox} value={season} onChange={(e) => { setSeason(e.target.value); setPage(1); }}>
                {SEASON_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Year</span>
              <select className={styles.selectBox} value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }}>
                {YEAR_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className={styles.filterGroup}>
              <span className={styles.filterLabel}>Format</span>
              <select className={styles.selectBox} value={type} onChange={(e) => { setType(e.target.value); setPage(1); }}>
                {TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Result count + active filters */}
      <div className={styles.statsRow}>
        <span className={styles.resultCount} aria-live="polite">
          {isLoading ? 'Searching…' : (
            <>
              <strong>{totalItems.toLocaleString('en-US')}</strong> {totalItems === 1 ? 'title' : 'titles'}
            </>
          )}
        </span>
        {activeChips.length > 0 && (
          <div className={styles.activeChips}>
            {activeChips.map((c) => (
              <button key={c.key} type="button" className={styles.activeChip} onClick={c.clear} aria-label={`Remove filter ${c.label}`}>
                {c.label} <X size={12} aria-hidden="true" />
              </button>
            ))}
            <button type="button" className={styles.resetBtn} onClick={handleResetFilters}>
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Anime Results Display */}
      {isLoading && animeList.length === 0 ? (
        <div className={viewMode === 'list' ? styles.animeList : viewMode === 'compact' ? styles.animeCompactGrid : styles.animeGrid} aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} className={viewMode === 'list' ? styles.skeletonRow : styles.skeletonCard} />
          ))}
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
          className={`${
            viewMode === 'list'
              ? styles.animeList
              : viewMode === 'compact'
              ? styles.animeCompactGrid
              : styles.animeGrid
          } ${isLoading ? styles.refreshing : ''}`}
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
