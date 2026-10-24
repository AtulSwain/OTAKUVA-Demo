'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Check, Trash2, ListPlus } from 'lucide-react';
import { CommunityScoreBadge } from '../rating/CommunityScoreBadge';
import { AddToListModal } from '../lists/AddToListModal';
import { Anime, UserWatchStatus } from '../../types/anime';
import { AnimePoster } from './AnimePoster';
import { useLibrary } from '../../context/LibraryContext';
import { getAnimeDisplayTitle } from '../../lib/animeTitleResolver';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './AnimeCard.module.css';

export interface AnimeCardProps {
  anime: Anime;
  variant?: 'standard' | 'compact' | 'featured' | 'ranking' | 'horizontal';
  rankNumber?: number;
  watchStatus?: UserWatchStatus;
  onQuickAdd?: (anime: Anime) => void;
  onQuickView?: (anime: Anime) => void;
  priority?: boolean;
  className?: string;
}

const STATUS_LABELS: Record<UserWatchStatus, string> = {
  watching: 'Watching',
  completed: 'Completed',
  plan_to_watch: 'Plan to Watch',
  on_hold: 'On Hold',
  dropped: 'Dropped',
};

export const AnimeCard: React.FC<AnimeCardProps> = ({
  anime,
  variant = 'standard',
  rankNumber,
  watchStatus: propStatus,
  onQuickAdd,
  onQuickView,
  priority = false,
  className = '',
}) => {
  const { getStatus, updateStatus, removeFromLibrary } = useLibrary();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [listPickerOpen, setListPickerOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const rawTitle = getAnimeDisplayTitle(anime);
  const displayTitle = sanitizePublicEntityName(rawTitle);
  const currentStatus = propStatus !== undefined ? propStatus : getStatus(anime?.id || '');
  const isAdded = Boolean(currentStatus);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleActionClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAdded) {
      if (onQuickAdd) {
        onQuickAdd(anime);
      } else {
        updateStatus(anime.id, 'plan_to_watch');
      }
    } else {
      setIsMenuOpen((prev) => !prev);
    }
  };

  const handleSelectStatus = (e: React.MouseEvent, targetStatus: UserWatchStatus) => {
    e.preventDefault();
    e.stopPropagation();
    updateStatus(anime.id, targetStatus);
    setIsMenuOpen(false);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    removeFromLibrary(anime.id);
    setIsMenuOpen(false);
  };

  const animeYear = anime.year || (anime as any).startYear;
  const animeType = anime.type || 'TV';

  if (variant === 'horizontal') {
    return (
      <Link
        href={`/anime/${anime.slug || anime.id}`}
        className={`${styles.horizontalCard} ${className}`}
        title={displayTitle}
      >
        <AnimePoster
          src={anime.posterImage || (anime as any).posterUrl || (anime as any).largePosterUrl}
          alt={displayTitle}
          width={56}
          height={80}
          className={styles.horizontalPoster}
        />
        <div className={styles.cardDetails}>
          <span className={styles.animeTitle}>{displayTitle}</span>
          <div className={styles.metaRow}>
            {animeYear && <span>{animeYear}</span>}
            {animeYear && <span>·</span>}
            <span>{animeType}</span>
            {/* Members' OTAKUVA score + retention (not the provider score). */}
            <CommunityScoreBadge animeId={anime.id} />
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className={`${styles.cardWrapper} ${className}`} ref={menuRef}>
      <Link href={`/anime/${anime.slug || anime.id}`} className={styles.cardLink} title={displayTitle}>
        <div className={styles.posterWrapper}>
          {typeof rankNumber === 'number' && (
            <span className={styles.rankBadge}>#{rankNumber}</span>
          )}

          <AnimePoster
            src={anime.posterImage || (anime as any).posterUrl || (anime as any).largePosterUrl}
            alt={displayTitle}
            priority={priority}
            className={styles.posterImg}
          />
          {/* Members' OTAKUVA score + retention on the poster (not the provider score). */}
          <CommunityScoreBadge animeId={anime.id} variant="overlay" />

          {/* Contextual Quick Add / Status Toggle */}
          <button
            type="button"
            className={`${styles.quickActionBtn} ${isAdded ? styles.quickActionActive : ''}`}
            onClick={handleActionClick}
            aria-label={isAdded ? `Status: ${STATUS_LABELS[currentStatus as UserWatchStatus]}` : 'Add to Library'}
          >
            {isAdded ? (
              <>
                <Check size={12} strokeWidth={2.5} />
                <span>{STATUS_LABELS[currentStatus as UserWatchStatus] || 'Saved'}</span>
              </>
            ) : (
              <>
                <Plus size={12} strokeWidth={2.5} />
                <span>Save</span>
              </>
            )}
          </button>

          {/* Optional Quick View Modal Trigger */}
          {onQuickView && (
            <button
              type="button"
              className={styles.quickViewBtn}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onQuickView(anime);
              }}
              aria-label={`Quick preview for ${displayTitle}`}
            >
              <span>Quick View</span>
            </button>
          )}
        </div>

        {/* Card Details: Title, Year/Type & Score */}
        <div className={styles.cardDetails}>
          <div className={styles.titleRow}>
            <span className={styles.animeTitle}>{displayTitle}</span>
          </div>

          <div className={styles.metaRow}>
            {animeYear && <span>{animeYear}</span>}
            {animeYear && <span>·</span>}
            <span>{animeType}</span>
          </div>
        </div>
      </Link>

      {/* Library Status Selection Dropdown */}
      {isMenuOpen && (
        <div className={styles.statusDropdown}>
          {(Object.keys(STATUS_LABELS) as UserWatchStatus[]).map((st) => (
            <button
              key={st}
              type="button"
              className={`${styles.statusOption} ${currentStatus === st ? styles.statusOptionActive : ''}`}
              onClick={(e) => handleSelectStatus(e, st)}
            >
              <span>{STATUS_LABELS[st]}</span>
              {currentStatus === st && <Check size={12} />}
            </button>
          ))}
          <div className={styles.statusDivider} />
          <button
            type="button"
            className={styles.statusOption}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsMenuOpen(false);
              setListPickerOpen(true);
            }}
          >
            <span>Add to a list…</span>
            <ListPlus size={12} />
          </button>
          <button
            type="button"
            className={`${styles.statusOption} ${styles.removeOption}`}
            onClick={handleRemove}
          >
            <span>Remove</span>
            <Trash2 size={12} />
          </button>
        </div>
      )}
      <AddToListModal
        isOpen={listPickerOpen}
        onClose={() => setListPickerOpen(false)}
        animeId={anime.id || anime.slug || ''}
        animeTitle={displayTitle}
      />
    </div>
  );
};
