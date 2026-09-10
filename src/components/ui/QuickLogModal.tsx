'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  Search,
  Plus,
  Play,
  Check,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';
import styles from './QuickLogModal.module.css';

interface QuickLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuickLogModal: React.FC<QuickLogModalProps> = ({ isOpen, onClose }) => {
  const { library, advanceOneEpisode, updateStatus } = useLibrary();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLogging, setIsLogging] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // List of active watching titles
  const watchingEntries = useMemo(() => {
    return Object.values(library)
      .filter((i) => i.status === 'watching')
      .map((entry) => ({
        entry,
        // entry.anime is the canonical row from /api/library. If it's missing,
        // leave the episode count undefined rather than assuming a cour length.
        anime: entry.anime || {
          id: entry.animeId,
          title: entry.animeId.replace(/-/g, ' '),
        },
      }));
  }, [library]);

  // Search the canonical catalog, debounced. Previously this matched against
  // bundled sample data, so only those titles were ever findable here.
  useEffect(() => {
    const q = searchQuery.trim();
    if (!isOpen || !q) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/anime/search?q=${encodeURIComponent(q)}&limit=5`);
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);

        const payload = await res.json();
        if (cancelled) return;
        setSearchResults(payload.items || payload.animes || payload.data || []);
      } catch (err) {
        console.error('Quick log search failed:', err);
        if (!cancelled) setSearchResults([]);
      } finally {
        if (!cancelled) setIsSearching(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, isOpen]);

  if (!isOpen) return null;

  const handleQuickAdvance = async (animeId: string, totalEpisodes?: number | null) => {
    setIsLogging(true);
    await advanceOneEpisode(animeId, totalEpisodes || undefined);
    setIsLogging(false);
  };

  const handleAddAndLog = async (animeId: string) => {
    setIsLogging(true);
    await updateStatus(animeId, 'watching');
    await advanceOneEpisode(animeId);
    setIsLogging(false);
    setSearchQuery('');
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.titleRow}>
            <Sparkles size={16} className={styles.icon} />
            <h2 className={styles.title}>Quick Watch Logger</h2>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Currently Watching Quick List */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>CURRENTLY WATCHING</span>
          {watchingEntries.length > 0 ? (
            <div className={styles.watchingList}>
              {watchingEntries.map(({ entry, anime }) => {
                const currentEp = entry.episodesWatched || 0;
                const totalEp = anime.episodes || '?';
                const nextEp = currentEp + 1;

                return (
                  <div key={entry.animeId} className={styles.watchingItem}>
                    <div className={styles.animeInfo}>
                      <span className={styles.animeTitle}>{anime.title}</span>
                      <span className={styles.animeMeta}>
                        Watched: <strong>Ep {currentEp}</strong> / {totalEp}
                      </span>
                    </div>

                    <button
                      type="button"
                      className={styles.logBtn}
                      disabled={isLogging}
                      onClick={() => handleQuickAdvance(entry.animeId, anime.episodes)}
                    >
                      <Plus size={13} />
                      <span>Log Ep {nextEp}</span>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.emptyNote}>
              No active watching titles. Search below to add an anime to your watch list!
            </p>
          )}
        </div>

        {/* Search for another anime */}
        <div className={styles.section}>
          <span className={styles.sectionLabel}>OR LOG ANY TITLE</span>
          <div className={styles.searchBox}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search anime to log..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
          </div>

          {isSearching && (
            <div className={styles.resultsList}>
              <span className={styles.footerHint}>Searching the catalog…</span>
            </div>
          )}

          {!isSearching && searchQuery.trim() && searchResults.length === 0 && (
            <div className={styles.resultsList}>
              <span className={styles.footerHint}>
                No titles in the catalog match &ldquo;{searchQuery.trim()}&rdquo;.
              </span>
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className={styles.resultsList}>
              {searchResults.map((anime) => (
                <div key={anime.id} className={styles.resultItem}>
                  <div className={styles.animeInfo}>
                    <span className={styles.animeTitle}>{anime.title}</span>
                    <span className={styles.animeMeta}>
                      {anime.type || 'TV'} • {anime.episodes || '?'} eps
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.addBtn}
                    onClick={() => handleAddAndLog(anime.id)}
                    disabled={isLogging}
                  >
                    <Plus size={13} />
                    <span>Watch &amp; Log Ep 1</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerHint}>
            Logs are automatically added to your daily watch streak and contribution history.
          </span>
        </div>
      </div>
    </div>
  );
};
