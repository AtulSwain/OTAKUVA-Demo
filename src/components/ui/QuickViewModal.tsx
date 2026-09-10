'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { X, Star, Plus, Check, Heart, ArrowRight } from 'lucide-react';
import { Anime } from '../../types/anime';
import { AnimePoster } from './AnimePoster';
import { useLibrary } from '../../context/LibraryContext';
import { getAnimeDisplayTitle, getAnimeJapaneseTitle } from '../../lib/animeTitleResolver';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './QuickViewModal.module.css';

interface QuickViewModalProps {
  anime: Anime | null;
  isOpen: boolean;
  onClose: () => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({ anime, isOpen, onClose }) => {
  const { library, updateStatus, toggleFavorite } = useLibrary();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !anime) return null;

  const displayTitle = sanitizePublicEntityName(getAnimeDisplayTitle(anime));
  const altTitle = getAnimeJapaneseTitle(anime);
  const animeId = anime.slug || anime.id;
  const inLibrary = Boolean(library[animeId]);
  const isFavorite = Boolean(library[animeId]?.isFavorite);
  const score = anime.score ? anime.score.toFixed(2) : '9.00';
  const banner = anime.bannerImage || (anime as any).bannerUrl || anime.posterImage || (anime as any).posterUrl;

  const studioName = Array.isArray(anime.studios) && anime.studios.length > 0
    ? (typeof anime.studios[0] === 'string' ? anime.studios[0] : (anime.studios[0] as any)?.name)
    : null;

  const handleLibraryToggle = () => {
    updateStatus(animeId, inLibrary ? 'plan_to_watch' : 'watching');
  };

  const handleFavoriteToggle = () => {
    toggleFavorite(animeId);
  };

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="Anime Quick View">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close Quick View"
        >
          <X size={16} />
        </button>

        {/* Banner Backdrop */}
        <div className={styles.bannerWrap}>
          {banner && (
            <Image
              src={banner}
              alt={displayTitle}
              fill
              className={styles.bannerImg}
              unoptimized
            />
          )}
          <div className={styles.bannerOverlay} />
        </div>

        {/* Main Content Body */}
        <div className={styles.body}>
          <div className={styles.posterWrap}>
            <AnimePoster
              src={anime.posterImage || (anime as any).posterUrl}
              alt={displayTitle}
            />
          </div>

          <div className={styles.infoCol}>
            <div className={styles.titleGroup}>
              <h2 className={styles.mainTitle}>{displayTitle}</h2>
              {altTitle && <span className={styles.altTitle}>{altTitle}</span>}
            </div>

            <div className={styles.scoresRow}>
              <div className={styles.otakuvaScore} title="OTAKUVA Bayesian Score">
                <Star size={11} fill="currentColor" />
                <span>OTAKUVA {score}</span>
              </div>
            </div>

            <div className={styles.metaRow}>
              <span>{anime.year || (anime as any).startYear || 2024}</span>
              <span className={styles.metaDot}>·</span>
              <span>{anime.type || 'TV'}</span>
              <span className={styles.metaDot}>·</span>
              <span>{anime.episodes ? `${anime.episodes} Episodes` : 'Ongoing'}</span>
              {studioName && (
                <>
                  <span className={styles.metaDot}>·</span>
                  <span>{studioName}</span>
                </>
              )}
            </div>

            {anime.genres && anime.genres.length > 0 && (
              <div className={styles.genresList}>
                {anime.genres.slice(0, 4).map((g) => (
                  <span key={g} className={styles.genreTag}>
                    {g}
                  </span>
                ))}
              </div>
            )}

            {anime.synopsis && (
              <p className={styles.synopsis}>{anime.synopsis}</p>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className={styles.footerActions}>
          <div className={styles.leftButtons}>
            <button
              type="button"
              className={`${styles.actionBtn} ${inLibrary ? styles.actionBtnActive : ''}`}
              onClick={handleLibraryToggle}
            >
              {inLibrary ? <Check size={14} /> : <Plus size={14} />}
              <span>{inLibrary ? 'In Library' : 'Add to Library'}</span>
            </button>

            <button
              type="button"
              className={`${styles.actionBtn} ${isFavorite ? styles.favoriteBtnActive : ''}`}
              onClick={handleFavoriteToggle}
              title="Toggle Favorite"
            >
              <Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} />
              <span>{isFavorite ? 'Favorited' : 'Favorite'}</span>
            </button>
          </div>

          <Link
            href={`/anime/${animeId}`}
            className={styles.viewDetailBtn}
            onClick={onClose}
          >
            <span>View Full Page</span>
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};
