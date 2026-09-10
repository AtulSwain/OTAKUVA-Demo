'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserWatchStatus } from '../types/anime';
import { useToast } from './ToastContext';
import { useAuth } from './AuthContext';

export interface UserAnimeState {
  id?: string;
  animeId: string;
  status: UserWatchStatus;
  episodesWatched: number;
  personalRating?: number | null;
  isFavorite: boolean;
  notes?: string | null;
  startDate?: string | null;
  finishDate?: string | null;
  updatedAt?: string;
  anime?: any;
}

export interface LibraryCounts {
  watching: number;
  completed: number;
  plan_to_watch: number;
  on_hold: number;
  dropped: number;
  total: number;
}

interface LibraryContextType {
  library: Record<string, UserAnimeState>;
  counts: LibraryCounts;
  watchedEpisodesMap: Record<string, number[]>;
  isLoading: boolean;
  todayEpisodes: number;
  todayMinutes: number;
  dailyGoal: number;
  setDailyGoal: (goal: number) => void;
  streakDays: number;
  getItem: (animeId: string) => UserAnimeState | undefined;
  getStatus: (animeId: string) => UserWatchStatus | undefined;
  isEpisodeWatched: (animeId: string, episodeNum: number) => boolean;
  updateStatus: (animeId: string, status: UserWatchStatus) => Promise<boolean>;
  advanceOneEpisode: (animeId: string, totalEpisodes?: number) => Promise<boolean>;
  toggleEpisode: (animeId: string, episodeNumber: number, totalEpisodes?: number) => Promise<boolean>;
  setRating: (animeId: string, rating: number | null) => Promise<boolean>;
  toggleFavorite: (animeId: string) => Promise<boolean>;
  removeFromLibrary: (animeId: string) => Promise<boolean>;
  refreshLibrary: () => Promise<void>;
}

const DEFAULT_COUNTS: LibraryCounts = {
  watching: 0,
  completed: 0,
  plan_to_watch: 0,
  on_hold: 0,
  dropped: 0,
  total: 0,
};

const LibraryContext = createContext<LibraryContextType | undefined>(undefined);

export const LibraryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const { user, isLoading: authLoading, openAuthModalWithIntent, pendingIntent, consumePendingIntent } = useAuth();
  
  // Dual indexing: library keyed by canonical animeId; aliasMap maps slugs/aliases -> canonical animeId
  const [library, setLibrary] = useState<Record<string, UserAnimeState>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cachedUser = localStorage.getItem('otakuva_user');
        if (cachedUser) {
          const parsedUser = JSON.parse(cachedUser);
          if (parsedUser?.id) {
            const cachedLib = localStorage.getItem(`otakuva_library_${parsedUser.id}`);
            if (cachedLib) {
              const parsed = JSON.parse(cachedLib);
              if (parsed?.itemsMap) return parsed.itemsMap;
            }
          }
        }
      } catch {
        // ignore
      }
    }
    return {};
  });

  const [aliasMap, setAliasMap] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cachedUser = localStorage.getItem('otakuva_user');
        if (cachedUser) {
          const parsedUser = JSON.parse(cachedUser);
          if (parsedUser?.id) {
            const cachedLib = localStorage.getItem(`otakuva_library_${parsedUser.id}`);
            if (cachedLib) {
              const parsed = JSON.parse(cachedLib);
              if (parsed?.aliasMap) return parsed.aliasMap;
            }
          }
        }
      } catch {
        // ignore
      }
    }
    return {};
  });

  const [counts, setCounts] = useState<LibraryCounts>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cachedUser = localStorage.getItem('otakuva_user');
        if (cachedUser) {
          const parsedUser = JSON.parse(cachedUser);
          if (parsedUser?.id) {
            const cachedLib = localStorage.getItem(`otakuva_library_${parsedUser.id}`);
            if (cachedLib) {
              const parsed = JSON.parse(cachedLib);
              if (parsed?.counts) return parsed.counts;
            }
          }
        }
      } catch {
        // ignore
      }
    }
    return DEFAULT_COUNTS;
  });

  const [watchedEpisodesMap, setWatchedEpisodesMap] = useState<Record<string, number[]>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Daily Habits & Real-time Watch Goal
  const [todayEpisodes, setTodayEpisodes] = useState<number>(0);
  const [dailyGoal, setDailyGoalState] = useState<number>(3);
  const [streakDays, setStreakDays] = useState<number>(7);

  // Load custom user goal from localStorage if present
  useEffect(() => {
    try {
      const savedGoal = localStorage.getItem('otakuva_daily_goal');
      if (savedGoal) {
        const parsed = parseInt(savedGoal, 10);
        if (parsed > 0) setDailyGoalState(parsed);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const setDailyGoal = useCallback((newGoal: number) => {
    const validGoal = Math.max(1, Math.min(20, newGoal));
    setDailyGoalState(validGoal);
    try {
      localStorage.setItem('otakuva_daily_goal', validGoal.toString());
      showToast(`Daily watch goal updated to ${validGoal} ep${validGoal > 1 ? 's' : ''}/day`);
    } catch (e) {
      // ignore
    }
  }, [showToast]);

  const todayMinutes = Math.round(todayEpisodes * 23.5);

  // Recalculate counts helper
  const calculateCounts = (lib: Record<string, UserAnimeState>): LibraryCounts => {
    const items = Object.values(lib);
    return {
      watching: items.filter((i) => i.status === 'watching').length,
      completed: items.filter((i) => i.status === 'completed').length,
      plan_to_watch: items.filter((i) => i.status === 'plan_to_watch').length,
      on_hold: items.filter((i) => i.status === 'on_hold').length,
      dropped: items.filter((i) => i.status === 'dropped').length,
      total: items.length,
    };
  };

  // Fetch from API for logged-in user, or clear state for guest
  const refreshLibrary = useCallback(async () => {
    if (authLoading) {
      // Don't wipe library while auth session is resolving
      return;
    }

    if (!user) {
      setLibrary({});
      setAliasMap({});
      setCounts(DEFAULT_COUNTS);
      setWatchedEpisodesMap({});
      setTodayEpisodes(0);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/library');
      if (!res.ok) throw new Error('Failed to fetch library');
      const data = await res.json();

      const libMap: Record<string, UserAnimeState> = {};
      const newAliases: Record<string, string> = {};
      const epMap: Record<string, number[]> = {};

      data.items.forEach((item: any) => {
        const animeId = item.animeId;
        libMap[animeId] = {
          id: item.id,
          animeId,
          status: item.status as UserWatchStatus,
          episodesWatched: item.episodesWatched || 0,
          personalRating: item.personalRating,
          isFavorite: item.isFavorite || false,
          notes: item.notes,
          startDate: item.startDate,
          finishDate: item.finishDate,
          updatedAt: item.updatedAt,
          anime: item.anime,
        };

        if (item.anime?.slug) {
          newAliases[item.anime.slug] = animeId;
        }
        if (item.anime?.id) {
          newAliases[item.anime.id] = animeId;
        }

        if (Array.isArray(item.watchedEpisodeNumbers)) {
          epMap[animeId] = item.watchedEpisodeNumbers;
          if (item.anime?.slug) {
            epMap[item.anime.slug] = item.watchedEpisodeNumbers;
          }
        }
      });

      const newCounts = data.counts || calculateCounts(libMap);
      setLibrary(libMap);
      setAliasMap(newAliases);
      setCounts(newCounts);
      setWatchedEpisodesMap(epMap);

      if (typeof window !== 'undefined' && user?.id) {
        try {
          localStorage.setItem(
            `otakuva_library_${user.id}`,
            JSON.stringify({ itemsMap: libMap, aliasMap: newAliases, counts: newCounts })
          );
        } catch {
          // ignore quota error
        }
      }

      if (typeof data.todayEpisodesCount === 'number') {
        setTodayEpisodes(Math.max(data.todayEpisodesCount, 0));
      }
    } catch (err) {
      console.error('Library sync error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  // Dual-key Lookup: matches canonical cuid, human-readable slug, or item id
  const getItem = useCallback(
    (idOrSlug: string): UserAnimeState | undefined => {
      if (!idOrSlug) return undefined;
      if (library[idOrSlug]) return library[idOrSlug];
      const canonicalId = aliasMap[idOrSlug];
      if (canonicalId && library[canonicalId]) return library[canonicalId];
      return Object.values(library).find(
        (item) =>
          item.animeId === idOrSlug ||
          item.anime?.slug === idOrSlug ||
          item.anime?.id === idOrSlug ||
          item.id === idOrSlug
      );
    },
    [library, aliasMap]
  );

  const getStatus = useCallback(
    (idOrSlug: string): UserWatchStatus | undefined => {
      return getItem(idOrSlug)?.status;
    },
    [getItem]
  );

  const isEpisodeWatched = useCallback(
    (idOrSlug: string, episodeNum: number) => {
      const watched = watchedEpisodesMap[idOrSlug];
      if (watched) return watched.includes(episodeNum);
      const canonicalId = aliasMap[idOrSlug];
      if (canonicalId && watchedEpisodesMap[canonicalId]) {
        return watchedEpisodesMap[canonicalId].includes(episodeNum);
      }
      return false;
    },
    [watchedEpisodesMap, aliasMap]
  );

  // Status Change Mutation with Dual-Key Mapping and Instant Feedback
  const updateStatus = async (idOrSlug: string, newStatus: UserWatchStatus): Promise<boolean> => {
    if (!user) {
      openAuthModalWithIntent(
        { type: 'ADD_TO_LIBRARY', animeId: idOrSlug, status: newStatus },
        `Sign in to add to library as ${newStatus.replace(/_/g, ' ')}`
      );
      return false;
    }

    const previousLibrary = { ...library };
    const previousAliasMap = { ...aliasMap };
    const previousCounts = { ...counts };

    const existing = getItem(idOrSlug);
    const canonicalKey = existing?.animeId || aliasMap[idOrSlug] || idOrSlug;

    const updatedItem: UserAnimeState = {
      ...(existing || {
        animeId: canonicalKey,
        episodesWatched: 0,
        isFavorite: false,
      }),
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    const nextLibrary = {
      ...library,
      [canonicalKey]: updatedItem,
    };
    if (idOrSlug !== canonicalKey) {
      nextLibrary[idOrSlug] = updatedItem;
    }

    // Optimistic paint only. The success toast is deferred until the server
    // confirms the write — previously it fired here, so a failed mutation
    // still told the user their library had been updated.
    setLibrary(nextLibrary);
    setCounts(calculateCounts(nextLibrary));

    const statusLabel = newStatus.replace(/_/g, ' ');

    try {
      const res = await fetch(`/api/library/${encodeURIComponent(idOrSlug)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Status update failed');
      const data = await res.json();
      
      const serverItem = data.item;
      if (serverItem?.animeId) {
        const verifiedAnimeId = serverItem.animeId;
        const finalItem: UserAnimeState = {
          ...updatedItem,
          id: serverItem.id,
          animeId: verifiedAnimeId,
          status: serverItem.status as UserWatchStatus,
          episodesWatched: serverItem.episodesWatched ?? updatedItem.episodesWatched,
        };

        // Build on the optimistic snapshot, not the `library` captured in this
        // closure — that value predates the optimistic update and dropped any
        // other change made while this request was in flight.
        const committedLibrary: Record<string, UserAnimeState> = {
          ...nextLibrary,
          [verifiedAnimeId]: finalItem,
        };
        // The optimistic pass may have written a duplicate under the slug;
        // the canonical id is the only key that should survive.
        if (idOrSlug !== verifiedAnimeId) {
          delete committedLibrary[idOrSlug];
        }
        const committedAlias = {
          ...aliasMap,
          [idOrSlug]: verifiedAnimeId,
        };

        setLibrary(committedLibrary);
        setAliasMap(committedAlias);

        if (typeof window !== 'undefined' && user?.id) {
          try {
            localStorage.setItem(
              `otakuva_library_${user.id}`,
              JSON.stringify({
                itemsMap: committedLibrary,
                aliasMap: committedAlias,
                counts: data.counts || calculateCounts(committedLibrary),
              })
            );
          } catch {
            // ignore
          }
        }
      }

      if (data.counts) setCounts(data.counts);
      showToast(
        `Updated to ${statusLabel.charAt(0).toUpperCase() + statusLabel.slice(1)}`,
        'success'
      );
      return true;
    } catch (err) {
      console.error('Status mutation failed, rolling back:', err);
      setLibrary(previousLibrary);
      setAliasMap(previousAliasMap);
      setCounts(previousCounts);
      showToast("Couldn't update your library. Try again.", 'error');
      return false;
    }
  };

  // Automatically fulfill pending ADD_TO_LIBRARY intent when user logs in
  useEffect(() => {
    if (user && pendingIntent && pendingIntent.type === 'ADD_TO_LIBRARY') {
      const intent = consumePendingIntent();
      if (intent && intent.type === 'ADD_TO_LIBRARY') {
        updateStatus(intent.animeId, intent.status);
      }
    }
  }, [user, pendingIntent, consumePendingIntent]);

  // Toggle Episode Watched / Unwatched
  const toggleEpisode = async (
    animeId: string,
    episodeNumber: number,
    totalEpisodes?: number
  ): Promise<boolean> => {
    if (!user) {
      openAuthModalWithIntent(
        { type: 'ADVANCE_EPISODE', animeId, episodeNumber },
        `Sign in to track Episode ${episodeNumber}`
      );
      return false;
    }

    let episodeId: string;
    try {
      const episodePage = Math.max(1, Math.ceil(episodeNumber / 100));
      const episodeResponse = await fetch(
        `/api/anime/${encodeURIComponent(animeId)}/episodes?page=${episodePage}&limit=100`
      );
      if (!episodeResponse.ok) throw new Error('Episode list unavailable');
      const episodeData = await episodeResponse.json();
      const episode = episodeData.episodes?.find((item: { number: number }) => item.number === episodeNumber);
      if (!episode?.id) throw new Error('Canonical episode not found');
      episodeId = episode.id;
    } catch (err) {
      console.error('Episode identity lookup failed:', err);
      showToast("Couldn't find that episode. Try again after the episode list loads.");
      return false;
    }

    const previousLibrary = { ...library };
    const previousWatchedMap = { ...watchedEpisodesMap };
    const previousCounts = { ...counts };
    const prevTodayEps = todayEpisodes;

    const currentWatchedList = watchedEpisodesMap[animeId] || [];
    const isCurrentlyWatched = currentWatchedList.includes(episodeNumber);
    const targetWatched = !isCurrentlyWatched;

    let nextWatchedList: number[];
    if (targetWatched) {
      nextWatchedList = Array.from(new Set([...currentWatchedList, episodeNumber])).sort((a, b) => a - b);
    } else {
      nextWatchedList = currentWatchedList.filter((e) => e !== episodeNumber);
    }

    const nextEpisodesWatched = nextWatchedList.length;
    const existing = library[animeId];

    const updatedItem: UserAnimeState = {
      ...(existing || {
        animeId,
        status: 'watching',
        isFavorite: false,
      }),
      status: existing?.status || 'watching',
      episodesWatched: nextEpisodesWatched,
      updatedAt: new Date().toISOString(),
    };

    const nextLibrary = { ...library, [animeId]: updatedItem };

    // Real-time Today counter increment
    const newTodayEps = targetWatched ? prevTodayEps + 1 : Math.max(0, prevTodayEps - 1);
    setTodayEpisodes(newTodayEps);

    // Optimistic UI apply
    setLibrary(nextLibrary);
    setWatchedEpisodesMap({ ...watchedEpisodesMap, [animeId]: nextWatchedList });
    setCounts(calculateCounts(nextLibrary));

    // Milestone Celebration Toast
    if (targetWatched && newTodayEps === dailyGoal) {
      showToast(`🎉 Daily Watch Goal Reached! (${newTodayEps}/${dailyGoal} episodes completed)`);
    } else {
      showToast(targetWatched ? `Episode ${episodeNumber} marked watched (+1 Today)` : `Episode ${episodeNumber} marked unwatched`);
    }

    try {
      const res = await fetch(`/api/anime/${encodeURIComponent(animeId)}/episodes/${encodeURIComponent(episodeId)}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetWatched ? 'WATCHED' : 'UNWATCHED' }),
      });

      if (!res.ok) throw new Error('Episode progress update failed');
      const data = await res.json();
      if (data.counts) setCounts(data.counts);
      return true;
    } catch (err) {
      console.error('Episode mutation failed, rolling back:', err);
      setLibrary(previousLibrary);
      setWatchedEpisodesMap(previousWatchedMap);
      setCounts(previousCounts);
      setTodayEpisodes(prevTodayEps);
      showToast("Couldn't update episode progress. Try again.");
      return false;
    }
  };

  // Advance One Episode (+1 Ep)
  const advanceOneEpisode = async (animeId: string, totalEpisodes?: number): Promise<boolean> => {
    if (!user) {
      openAuthModalWithIntent(
        { type: 'ADVANCE_EPISODE', animeId, episodeNumber: 1 },
        'Sign in to track your watch progress'
      );
      return false;
    }

    const existing = library[animeId];
    const currentWatched = existing ? existing.episodesWatched : 0;
    const nextEp = currentWatched + 1;

    if (totalEpisodes && nextEp > totalEpisodes) return false;

    return toggleEpisode(animeId, nextEp, totalEpisodes);
  };

  // Set Personal Rating
  const setRating = async (animeId: string, rating: number | null): Promise<boolean> => {
    if (!user) {
      if (rating !== null) {
        openAuthModalWithIntent(
          { type: 'RATE_ANIME', animeId, score: rating },
          `Sign in to rate ${rating.toFixed(1)}/10`
        );
      }
      return false;
    }

    const previousLibrary = { ...library };
    const existing = library[animeId];
    if (!existing) return false;

    const nextLibrary = {
      ...library,
      [animeId]: { ...existing, personalRating: rating },
    };
    setLibrary(nextLibrary);

    try {
      const res = await fetch(`/api/library/${animeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalRating: rating }),
      });
      if (!res.ok) throw new Error('Rating update failed');
      showToast(rating ? `Rated ★ ${rating}/10` : 'Rating removed');
      return true;
    } catch (err) {
      setLibrary(previousLibrary);
      return false;
    }
  };

  // Toggle Favorite
  const toggleFavorite = async (animeId: string): Promise<boolean> => {
    if (!user) {
      openAuthModalWithIntent(
        { type: 'TOGGLE_FAVORITE', animeId },
        'Sign in to add this anime to your favorites'
      );
      return false;
    }

    const previousLibrary = { ...library };
    const existing = library[animeId];
    if (!existing) return false;

    const nextFav = !existing.isFavorite;
    const nextLibrary = {
      ...library,
      [animeId]: { ...existing, isFavorite: nextFav },
    };
    setLibrary(nextLibrary);

    try {
      const res = await fetch(`/api/library/${animeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFavorite: nextFav }),
      });
      if (!res.ok) throw new Error('Favorite toggle failed');
      showToast(nextFav ? 'Added to favorites' : 'Removed from favorites');
      return true;
    } catch (err) {
      setLibrary(previousLibrary);
      return false;
    }
  };

  // Remove from Library
  const removeFromLibrary = async (idOrSlug: string): Promise<boolean> => {
    if (!user) return false;
    const previousLibrary = { ...library };
    const previousAliasMap = { ...aliasMap };
    const previousCounts = { ...counts };

    const existing = getItem(idOrSlug);
    const canonicalKey = existing?.animeId || aliasMap[idOrSlug] || idOrSlug;

    const nextLibrary = { ...library };
    delete nextLibrary[canonicalKey];
    delete nextLibrary[idOrSlug];

    const nextAliases = { ...aliasMap };
    delete nextAliases[idOrSlug];
    if (existing?.anime?.slug) {
      delete nextAliases[existing.anime.slug];
    }

    setLibrary(nextLibrary);
    setAliasMap(nextAliases);
    setCounts(calculateCounts(nextLibrary));

    if (typeof window !== 'undefined' && user?.id) {
      try {
        localStorage.setItem(
          `otakuva_library_${user.id}`,
          JSON.stringify({ itemsMap: nextLibrary, aliasMap: nextAliases, counts: calculateCounts(nextLibrary) })
        );
      } catch {
        // ignore
      }
    }

    try {
      const res = await fetch(`/api/library/${encodeURIComponent(idOrSlug)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      showToast('Removed from library', 'info');
      return true;
    } catch (err) {
      setLibrary(previousLibrary);
      setAliasMap(previousAliasMap);
      setCounts(previousCounts);
      showToast("Couldn't remove from library", 'error');
      return false;
    }
  };

  return (
    <LibraryContext.Provider
      value={{
        library,
        counts,
        watchedEpisodesMap,
        isLoading,
        todayEpisodes,
        todayMinutes,
        dailyGoal,
        setDailyGoal,
        streakDays,
        getItem,
        getStatus,
        isEpisodeWatched,
        updateStatus,
        advanceOneEpisode,
        toggleEpisode,
        setRating,
        toggleFavorite,
        removeFromLibrary,
        refreshLibrary,
      }}
    >
      {children}
    </LibraryContext.Provider>
  );
};

export const useLibrary = () => {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used within a LibraryProvider');
  }
  return context;
};
