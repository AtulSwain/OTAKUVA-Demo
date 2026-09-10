'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { Check, ChevronDown, ChevronUp, Play, Tv } from 'lucide-react';
import styles from './EpisodeQuickList.module.css';

export interface EpisodeItem {
  id?: string;
  seasonId?: string;
  seasonNumber?: number;
  number: number;
  title?: string;
  airedAt?: string | null;
  aired?: string | null;
  duration?: string | null;
  synopsis?: string | null;
  thumbnail?: string | null;
  filler?: boolean;
  recap?: boolean;
  score?: number | null;
  isWatched?: boolean;
}

export interface SeasonItem {
  id: string;
  seasonNumber: number;
  title: string;
  slug?: string;
  episodeCount?: number;
  episodes?: EpisodeItem[];
}

interface EpisodeQuickListProps {
  animeId: string;
  totalEpisodes: number;
  episodesList?: EpisodeItem[];
  seasonsList?: SeasonItem[];
  animeTitle?: string;
  onOpenTrailer?: () => void;
}

export const EpisodeQuickList: React.FC<EpisodeQuickListProps> = ({
  animeId,
  totalEpisodes = 12,
  episodesList = [],
  seasonsList = [],
  animeTitle = 'Anime',
  onOpenTrailer,
}) => {
  const { user } = useAuth();
  const { updateStatus } = useLibrary();
  const { showToast } = useToast();

  const [selectedSeasonIdx, setSelectedSeasonIdx] = useState(0);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [watchedEpisodeIds, setWatchedEpisodeIds] = useState<Set<string>>(new Set());
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Initialize watched IDs from props
  useEffect(() => {
    const initialWatched = new Set<string>();
    if (Array.isArray(episodesList) && episodesList.length > 0) {
      episodesList.forEach((ep) => {
        if (ep.isWatched && (ep.id || ep.number)) {
          initialWatched.add(ep.id || `ep-${ep.number}`);
        }
      });
    }
    setWatchedEpisodeIds(initialWatched);
  }, [episodesList]);

  // Build Season Partitions
  const normalizedSeasons = useMemo(() => {
    // 1. If explicit seasonsList with directSeasons or seasons was passed
    if (Array.isArray(seasonsList) && seasonsList.length > 0) {
      return seasonsList.map((s, idx) => {
        const seasonEps = (s.episodes && s.episodes.length > 0)
          ? s.episodes
          : episodesList.filter((ep) => ep.seasonId === s.id || ep.seasonNumber === (s.seasonNumber || idx + 1));

        const epCount = seasonEps.length || s.episodeCount || (idx === 0 ? totalEpisodes : 12);
        return {
          id: s.id || `season-${s.seasonNumber || idx + 1}`,
          seasonNumber: s.seasonNumber || idx + 1,
          title: s.title || `Season ${s.seasonNumber || idx + 1}`,
          episodeCount: epCount,
          episodes: seasonEps,
        };
      });
    }

    // 2. Fallback: If we have an episodes list with seasonIds
    const seasonIdGroups = new Map<string, EpisodeItem[]>();
    episodesList.forEach((ep) => {
      const sId = ep.seasonId || 'default-season';
      if (!seasonIdGroups.has(sId)) seasonIdGroups.set(sId, []);
      seasonIdGroups.get(sId)!.push(ep);
    });

    if (seasonIdGroups.size > 1) {
      let seasonIdx = 1;
      const result: SeasonItem[] = [];
      seasonIdGroups.forEach((eps, key) => {
        result.push({
          id: key,
          seasonNumber: seasonIdx,
          title: `Season ${seasonIdx}`,
          episodeCount: eps.length,
          episodes: eps,
        });
        seasonIdx++;
      });
      return result;
    }

    // 3. Single Season Default with actual episodes
    const fallbackEps = episodesList.length > 0
      ? episodesList
      : Array.from({ length: Math.min(totalEpisodes || 12, 100) }, (_, i) => ({
          id: `ep-${i + 1}`,
          number: i + 1,
          title: `Episode ${i + 1}`,
          duration: '24 min',
          aired: 'Broadcast',
        }));

    return [
      {
        id: 'season-1',
        seasonNumber: 1,
        title: 'Season 1',
        episodeCount: fallbackEps.length,
        episodes: fallbackEps,
      },
    ];
  }, [seasonsList, episodesList, totalEpisodes]);

  const activeSeason = normalizedSeasons[selectedSeasonIdx] || normalizedSeasons[0];

  // Active episodes for the selected season
  const activeEpisodes: EpisodeItem[] = useMemo(() => {
    if (activeSeason.episodes && activeSeason.episodes.length > 0) {
      return activeSeason.episodes;
    }
    // If season record has episodeCount but empty episodes array, generate clean episodes
    const count = activeSeason.episodeCount || totalEpisodes || 12;
    return Array.from({ length: Math.min(count, 100) }, (_, i) => ({
      id: `ep-${activeSeason.seasonNumber}-${i + 1}`,
      number: i + 1,
      title: `Episode ${i + 1}`,
      duration: '24 min',
      aired: 'Broadcast',
    }));
  }, [activeSeason, totalEpisodes]);

  // Display limited rows when not expanded
  const INITIAL_DISPLAY_COUNT = 8;
  const displayedEpisodes = isExpanded
    ? activeEpisodes
    : activeEpisodes.slice(0, INITIAL_DISPLAY_COUNT);

  const watchedCount = useMemo(() => {
    return activeEpisodes.filter((ep) => watchedEpisodeIds.has(ep.id || `ep-${ep.number}`)).length;
  }, [activeEpisodes, watchedEpisodeIds]);

  const handleSelectEpisode = (epId: string) => {
    setSelectedEpisodeId((prev) => (prev === epId ? null : epId));
  };

  // Toggle single episode watched state
  const handleToggleWatched = async (ep: EpisodeItem, e: React.MouseEvent) => {
    e.stopPropagation();

    const epId = ep.id || `ep-${ep.number}`;
    const currentlyWatched = watchedEpisodeIds.has(epId);
    const targetStatus = currentlyWatched ? 'UNWATCHED' : 'WATCHED';

    setWatchedEpisodeIds((prev) => {
      const next = new Set(prev);
      if (currentlyWatched) next.delete(epId);
      else next.add(epId);
      return next;
    });

    setIsUpdating(epId);

    try {
      if (user) {
        const res = await fetch(`/api/anime/${animeId}/episodes/${epId}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: targetStatus, episodeNumber: ep.number }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.userTracking) {
            await updateStatus(animeId, json.userTracking.status.toLowerCase());
          }
        }
      }

      showToast(
        currentlyWatched ? `Episode ${ep.number} unmarked` : `Episode ${ep.number} marked as watched`,
        'success'
      );
    } catch (err: any) {
      console.error('Episode toggle error:', err);
      setWatchedEpisodeIds((prev) => {
        const rollback = new Set(prev);
        if (currentlyWatched) rollback.add(epId);
        else rollback.delete(epId);
        return rollback;
      });
      showToast("Couldn't update episode progress", 'error');
    } finally {
      setIsUpdating(null);
    }
  };

  // Mark all episodes in this season as watched
  const handleMarkAllSeasonWatched = async () => {
    if (!user) {
      showToast('Sign in to save episode progress', 'info');
      return;
    }

    const allSeasonIds = activeEpisodes.map((ep) => ep.id || `ep-${ep.number}`);
    setWatchedEpisodeIds((prev) => {
      const next = new Set(prev);
      allSeasonIds.forEach((id) => next.add(id));
      return next;
    });

    try {
      await fetch(`/api/anime/${animeId}/progress/mark-all-watched`, { method: 'POST' });
      await updateStatus(animeId, 'completed');
      showToast(`All ${activeEpisodes.length} episodes marked as watched!`, 'success');
    } catch {
      showToast("Couldn't mark all episodes", 'error');
    }
  };

  return (
    <div className={styles.section} aria-label="Episode Guide">
      <div className={styles.sectionHead}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <Tv size={16} className={styles.sectionIcon} />
            <h3 className={styles.title}>Episode Guide</h3>
          </div>
          <span className={styles.subtitle}>
            {activeSeason.title} • {watchedCount}/{activeEpisodes.length} watched
          </span>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.markAllBtn}
            onClick={handleMarkAllSeasonWatched}
          >
            Mark season watched
          </button>
          {onOpenTrailer && (
            <button
              type="button"
              className={styles.trailerBtn}
              onClick={onOpenTrailer}
              title="Watch Official Trailer"
            >
              <Play size={11} fill="currentColor" />
              <span>Trailer</span>
            </button>
          )}
        </div>
      </div>

      {/* Season Selector Tabs */}
      {normalizedSeasons.length > 0 && (
        <div className={styles.seasonTabs} role="tablist" aria-label="Anime Seasons">
          {normalizedSeasons.map((season, idx) => (
            <button
              key={season.id || idx}
              type="button"
              role="tab"
              aria-selected={selectedSeasonIdx === idx}
              className={`${styles.tab} ${selectedSeasonIdx === idx ? styles.activeTab : ''}`}
              onClick={() => {
                setSelectedSeasonIdx(idx);
                setIsExpanded(false);
              }}
            >
              <span className={styles.tabSeasonName}>{season.title}</span>
              <span className={styles.tabEpCount}>{season.episodeCount} eps</span>
            </button>
          ))}
        </div>
      )}

      {/* Compact Episode Container */}
      <div className={styles.episodesContainer} role="list">
        {displayedEpisodes.map((ep) => {
          const epId = ep.id || `ep-${ep.number}`;
          const isWatched = watchedEpisodeIds.has(epId);
          const isSelected = selectedEpisodeId === epId;

          return (
            <div
              key={epId}
              role="listitem"
              className={`${styles.episodeRow} ${isSelected ? styles.selectedRow : ''}`}
              onClick={() => handleSelectEpisode(epId)}
            >
              <span className={styles.epNum}>
                {String(ep.number).padStart(2, '0')}
              </span>

              <div className={styles.epDetails}>
                <div className={styles.titleLine}>
                  <strong className={styles.epTitle}>{ep.title || `Episode ${ep.number}`}</strong>
                  {ep.filler && <span className={styles.fillerBadge}>Filler</span>}
                  {ep.recap && <span className={styles.recapBadge}>Recap</span>}
                </div>
                <div className={styles.epMeta}>
                  {ep.duration && <span>{ep.duration}</span>}
                  {ep.aired && <span>• {ep.aired}</span>}
                  {ep.airedAt && !ep.aired && <span>• {new Date(ep.airedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                </div>
              </div>

              <button
                type="button"
                role="button"
                aria-pressed={isWatched}
                className={`${styles.checkBtn} ${isWatched ? styles.checkBtnWatched : styles.checkBtnUnwatched}`}
                disabled={isUpdating === epId}
                onClick={(e) => handleToggleWatched(ep, e)}
                title={isWatched ? 'Mark as unwatched' : 'Mark as watched'}
              >
                {isWatched ? <Check size={13} strokeWidth={3} /> : null}
              </button>
            </div>
          );
        })}
      </div>

      {/* Expand / Collapse Toggle if many episodes */}
      {activeEpisodes.length > INITIAL_DISPLAY_COUNT && (
        <button
          type="button"
          className={styles.expandToggleBtn}
          onClick={() => setIsExpanded((prev) => !prev)}
        >
          <span>
            {isExpanded
              ? 'Show Less'
              : `Show All ${activeEpisodes.length} Episodes (+${activeEpisodes.length - INITIAL_DISPLAY_COUNT} more)`}
          </span>
          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      )}
    </div>
  );
};
