'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  LucideIcon,
  PlaySquare,
  CheckSquare,
  Bookmark,
  PauseCircle,
  XCircle,
  Tv,
} from 'lucide-react';
import { FIXTURE_ANIMES } from '../../../fixtures/anime.fixture';
import { AnimeCard } from '../../../components/ui/AnimeCard';
import { AnimeGrid } from '../../../components/ui/AnimeGrid';
import { EmptyState } from '../../../components/ui/EmptyState';
import { AnimeCardSkeleton } from '../../../components/ui/Skeleton';
import { UserWatchStatus } from '../../../types/anime';
import { useLibrary } from '../../../context/LibraryContext';
import styles from './library.module.css';

const TABS: { id: UserWatchStatus; label: string; countKey: 'watching' | 'completed' | 'plan_to_watch' | 'on_hold' | 'dropped'; icon: LucideIcon }[] = [
  { id: 'watching', label: 'Watching', countKey: 'watching', icon: PlaySquare },
  { id: 'completed', label: 'Completed', countKey: 'completed', icon: CheckSquare },
  { id: 'plan_to_watch', label: 'Plan to Watch', countKey: 'plan_to_watch', icon: Bookmark },
  { id: 'on_hold', label: 'On Hold', countKey: 'on_hold', icon: PauseCircle },
  { id: 'dropped', label: 'Dropped', countKey: 'dropped', icon: XCircle },
];

export default function LibraryStatusPage() {
  const params = useParams();
  const rawStatus = (params?.status as string) || 'watching';
  const status = (rawStatus === 'planning' ? 'plan_to_watch' : rawStatus) as UserWatchStatus;

  const { library, counts, isLoading } = useLibrary();

  const animeMap = useMemo(() => {
    const map = new Map<string, any>();
    FIXTURE_ANIMES.forEach((a) => map.set(a.id, a));
    return map;
  }, []);

  // Filter items strictly from the single source of truth (LibraryContext)
  const libraryItems = useMemo(() => {
    return Object.values(library)
      .filter((entry) => entry.status === status)
      .map((entry) => animeMap.get(entry.animeId) || entry.anime)
      .filter(Boolean);
  }, [library, status, animeMap]);

  return (
    <div className={styles.libraryPage}>
      <div className={styles.header}>
        <h2 className={styles.title}>My Library</h2>
        <p className={styles.subtitle}>
          Your personal anime archive. Organize what you are currently watching, completed, or planning for later.
        </p>
      </div>

      {/* Library Tabs */}
      <div className={styles.tabsRow} role="tablist">
        {TABS.map((tab) => {
          const isActive = status === tab.id;
          const Icon = tab.icon;
          const count = counts[tab.countKey];
          return (
            <Link
              key={tab.id}
              href={`/library/${tab.id === 'plan_to_watch' ? 'planning' : tab.id}`}
              className={`${styles.tabLink} ${isActive ? styles.tabActive : ''}`}
              role="tab"
              aria-selected={isActive}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              <span className={styles.tabCount}>{count}</span>
            </Link>
          );
        })}
      </div>

      {/* Items Grid or Loading/Empty States */}
      {isLoading ? (
        <AnimeGrid columns="auto">
          {Array.from({ length: 6 }).map((_, i) => (
            <AnimeCardSkeleton key={i} />
          ))}
        </AnimeGrid>
      ) : libraryItems.length > 0 ? (
        <AnimeGrid columns="auto">
          {libraryItems.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} watchStatus={status} />
          ))}
        </AnimeGrid>
      ) : (
        <EmptyState
          icon={Tv}
          title={`No anime in "${status.replace('_', ' ')}"`}
          description="You haven't logged any anime under this status yet. Browse the catalog to add titles."
          actionLabel="Discover Anime"
          actionHref="/discover"
        />
      )}
    </div>
  );
}
