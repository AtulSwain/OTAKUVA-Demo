'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Check, Heart, Star, Play } from 'lucide-react';
import { Anime } from '../../types/anime';
import { useLibrary } from '../../context/LibraryContext';
import { AnimeImage } from './AnimeImage';
import { getAnimeDisplayTitle } from '../../lib/animeTitleResolver';
import styles from './AnimeStickyActionBar.module.css';

interface AnimeStickyActionBarProps {
  anime: Anime;
  userRating?: number | null;
  onOpenRatingModal: () => void;
  onOpenTrailer?: () => void;
  /** Average of OTAKUVA members' ratings, as shown in the hero. */
  otakuvaScore?: number | null;
  /** False for a title that hasn't aired yet — hides the Rate action. */
  hasPremiered?: boolean;
}

export const AnimeStickyActionBar: React.FC<AnimeStickyActionBarProps> = ({
  anime,
  userRating,
  onOpenRatingModal,
  onOpenTrailer,
  otakuvaScore = null,
  hasPremiered = true,
}) => {
  const { getStatus, getItem, updateStatus, toggleFavorite } = useLibrary();
  const [isVisible, setIsVisible] = useState(false);

  const targetKey = (anime as any).otakuva_anime_id || anime.id || anime.slug;
  const currentStatus = getStatus(targetKey) || (anime.slug ? getStatus(anime.slug) : undefined) || (anime.id ? getStatus(anime.id) : undefined);
  const isInLibrary = Boolean(currentStatus);
  const libraryItem = getItem(targetKey) || (anime.slug ? getItem(anime.slug) : undefined) || (anime.id ? getItem(anime.id) : undefined);
  const isFavorite = libraryItem?.isFavorite || false;
  const effectiveRating = (userRating !== undefined && userRating !== null ? userRating : libraryItem?.personalRating) ?? null;
  const displayTitle = getAnimeDisplayTitle(anime);

  useEffect(() => {
    const handleScroll = () => {
      // Show sticky bar when scrolled past 380px
      if (window.scrollY > 380) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleLibraryClick = async () => {
    if (!isInLibrary) {
      // Matches AnimeHero: a first add is Plan to Watch, not Watching.
      await updateStatus(targetKey, 'plan_to_watch');
    } else {
      // Toggle or advance status
      await updateStatus(targetKey, currentStatus === 'watching' ? 'completed' : 'watching');
    }
  };

  const handleFavoriteClick = async () => {
    await toggleFavorite(targetKey);
  };

  return (
    <div
      className={`${styles.stickyBar} ${isVisible ? styles.stickyBarVisible : ''}`}
      aria-label="Quick action bar"
    >
      <div className={styles.animeSnippet}>
        <div className={styles.posterThumb}>
          <AnimeImage
            src={anime.posterImage || (anime as any).posterUrl}
            alt={displayTitle}
            fill
            sizes="32px"
          />
        </div>
        <div className={styles.titleBlock}>
          <span className={styles.title}>{displayTitle}</span>
          <span className={styles.meta}>
            {[anime.type, typeof otakuvaScore === 'number' ? `OTAKUVA ${otakuvaScore.toFixed(1)}` : null].filter(Boolean).join(' • ')}
          </span>
        </div>
      </div>

      <div className={styles.actionsGroup}>
        {/* Add/Status in Library */}
        <button
          type="button"
          className={`${styles.actionBtn} ${isInLibrary ? styles.secondaryBtn : styles.primaryBtn}`}
          onClick={handleLibraryClick}
        >
          {isInLibrary ? <Check size={14} /> : <Plus size={14} />}
          <span>{isInLibrary ? 'In Library' : 'Add'}</span>
        </button>

        {/* Favorite Button */}
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.secondaryBtn} ${styles.iconOnlyBtn} ${isFavorite ? styles.favoriteActive : ''}`}
          onClick={handleFavoriteClick}
          aria-label="Toggle favorite"
          title="Favorite"
        >
          <Heart size={15} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>

        {/* Rate Button — only once the title has actually aired */}
        {hasPremiered && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.secondaryBtn} ${styles.iconOnlyBtn}`}
            onClick={onOpenRatingModal}
            aria-label="Rate anime"
            title={effectiveRating !== null ? `Your rating: ★ ${effectiveRating.toFixed(1)}/10` : 'Rate anime'}
          >
            <Star size={15} fill={effectiveRating !== null ? '#F59E0B' : 'none'} color={effectiveRating !== null ? '#F59E0B' : 'currentColor'} />
          </button>
        )}

        {/* Play Trailer Button */}
        {anime.trailerUrl && onOpenTrailer && (
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.secondaryBtn} ${styles.iconOnlyBtn}`}
            onClick={onOpenTrailer}
            aria-label="Watch trailer"
            title="Trailer"
          >
            <Play size={14} />
          </button>
        )}
      </div>
    </div>
  );
};
