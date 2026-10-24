'use client';

import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Layers,
  PlaySquare,
  CheckSquare,
  Bookmark,
  PauseCircle,
  XCircle,
  Tv,
} from 'lucide-react';
import { AnimeCard } from '../../components/ui/AnimeCard';
import { AnimeGrid } from '../../components/ui/AnimeGrid';
import { EmptyState } from '../../components/ui/EmptyState';
import { AnimeCardSkeleton } from '../../components/ui/Skeleton';
import { UserWatchStatus } from '../../types/anime';
import { useLibrary } from '../../context/LibraryContext';
import { getAnimeDisplayTitle, normalizeAnimeTitleFields } from '../../lib/animeTitleResolver';
import styles from './[status]/library.module.css';
import { LibrarySwitch } from '../../components/lists/LibrarySwitch';

type TabOption = 'all' | UserWatchStatus;

const TABS: { id: TabOption; label: string; countKey?: keyof ReturnType<typeof useLibrary>['counts']; icon: any }[] = [
  { id: 'all', label: 'All Items', countKey: 'total', icon: Layers },
  { id: 'watching', label: 'Watching', countKey: 'watching', icon: PlaySquare },
  { id: 'completed', label: 'Completed', countKey: 'completed', icon: CheckSquare },
  { id: 'plan_to_watch', label: 'Plan to Watch', countKey: 'plan_to_watch', icon: Bookmark },
  { id: 'on_hold', label: 'On Hold', countKey: 'on_hold', icon: PauseCircle },
  { id: 'dropped', label: 'Dropped', countKey: 'dropped', icon: XCircle },
];

function LibraryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialStatus = (searchParams?.get('status') as TabOption) || 'all';

  const [selectedTab, setSelectedTab] = useState<TabOption>(() => {
    if (['all', 'watching', 'completed', 'plan_to_watch', 'on_hold', 'dropped'].includes(initialStatus)) {
      return initialStatus;
    }
    return 'all';
  });

  const { library, counts, isLoading } = useLibrary();

  // Sync state if URL query param changes
  useEffect(() => {
    const statusParam = searchParams?.get('status') as TabOption;
    if (statusParam && ['all', 'watching', 'completed', 'plan_to_watch', 'on_hold', 'dropped'].includes(statusParam)) {
      setSelectedTab(statusParam);
    }
  }, [searchParams]);

  const handleTabSelect = (tabId: TabOption) => {
    setSelectedTab(tabId);
    if (tabId === 'all') {
      router.replace('/library', { scroll: false });
    } else {
      router.replace(`/library?status=${tabId}`, { scroll: false });
    }
  };

  const libraryItems = useMemo(() => {
    const entries = Object.values(library);
    const filterFn = (entry: any) => selectedTab === 'all' || entry.status === selectedTab;

    return entries
      .filter(filterFn)
      .map((entry) => {
        // entry.anime is the canonical Anime row joined by /api/library.
        // When it's absent the row is genuinely unresolved — carry the id and
        // leave every other field undefined rather than inventing a score,
        // season, year or poster for it.
        const rawAnime = entry.anime;
        const resolvedTitle = getAnimeDisplayTitle(rawAnime || { id: entry.animeId, slug: entry.animeId });

        const anime = rawAnime
          ? normalizeAnimeTitleFields(rawAnime)
          : {
              id: entry.animeId,
              slug: entry.animeId,
              title: resolvedTitle,
              canonicalTitle: resolvedTitle,
            };

        return {
          anime,
          status: entry.status,
        };
      })
      .filter((i) => Boolean(i.anime));
  }, [library, selectedTab]);

  return (
    <div className={styles.libraryPage}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Library</h1>
        <p className={styles.subtitle}>
          Your personal anime archive. Track episodes, manage status, and organize your collection.
        </p>
      </div>

      <LibrarySwitch />

      {/* Library Filter Tabs */}
      <div className={styles.tabsRow} role="tablist" aria-label="Filter library by status">
        {TABS.map((tab) => {
          const isActive = selectedTab === tab.id;
          const Icon = tab.icon;
          const count = tab.countKey ? counts[tab.countKey] : 0;
          return (
            <button
              key={tab.id}
              type="button"
              className={`${styles.tabLink} ${isActive ? styles.tabActive : ''}`}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabSelect(tab.id)}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
              <span className={styles.tabCount}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Items Grid */}
      {isLoading ? (
        <AnimeGrid columns="auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <AnimeCardSkeleton key={i} />
          ))}
        </AnimeGrid>
      ) : libraryItems.length > 0 ? (
        <AnimeGrid columns="auto">
          {libraryItems.map(({ anime, status }) => (
            <AnimeCard key={anime.id} anime={anime} watchStatus={status} />
          ))}
        </AnimeGrid>
      ) : (
        <EmptyState
          icon={Tv}
          title={
            selectedTab === 'all'
              ? 'Your library is empty'
              : `No anime in "${selectedTab.replace('_', ' ')}"`
          }
          description={
            selectedTab === 'all'
              ? 'You have not added any anime to your library yet. Explore the catalog to start tracking.'
              : `You haven't logged any anime under "${selectedTab.replace('_', ' ')}". Browse the catalog to add titles.`
          }
          actionLabel="Discover Anime"
          actionHref="/anime"
        />
      )}
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.libraryPage}>
          <div className={styles.header}>
            <h1 className={styles.title}>My Library</h1>
          </div>
          <AnimeGrid columns="auto">
            {Array.from({ length: 6 }).map((_, i) => (
              <AnimeCardSkeleton key={i} />
            ))}
          </AnimeGrid>
        </div>
      }
    >
      <LibraryContent />
    </Suspense>
  );
}
