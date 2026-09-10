'use client';

import React from 'react';
import Link from 'next/link';
import { AnimeImage } from './AnimeImage';
import styles from './AnimeCard.module.css';

export interface AnimeCardItem {
  id: string;
  slug: string;
  title: string;
  englishTitle?: string | null;
  japaneseTitle?: string | null;
  posterImage?: string | null;
  score?: number | null;
  episodes?: number | null;
  status?: string | null;
  type?: string | null;
  year?: number | null;
  genres?: string[];
}

interface AnimeCardProps {
  anime: AnimeCardItem;
  viewMode?: 'grid' | 'compact' | 'list';
}

export const AnimeCard: React.FC<AnimeCardProps> = ({ anime, viewMode = 'grid' }) => {
  const displayTitle = anime.title || 'Untitled Anime';
  const displayScore =
    anime.score !== null && anime.score !== undefined && !isNaN(anime.score)
      ? anime.score > 10
        ? (anime.score / 10).toFixed(1)
        : Number(anime.score).toFixed(1)
      : null;

  const statusClass =
    anime.status?.toLowerCase().includes('air')
      ? styles.statusAiring
      : anime.status?.toLowerCase().includes('upcom') || anime.status?.toLowerCase().includes('not')
      ? styles.statusUpcoming
      : styles.statusFinished;

  if (viewMode === 'list') {
    return (
      <Link href={`/anime/${anime.slug || anime.id}`} className={styles.cardList}>
        <div className={styles.listPoster}>
          <AnimeImage src={anime.posterImage} alt={displayTitle} fill sizes="55px" />
        </div>
        <div className={styles.listContent}>
          <div className={styles.listTitleRow}>
            <span className={styles.listTitle}>{displayTitle}</span>
          </div>
          <div className={styles.listMeta}>
            <span>{anime.type || 'TV'}</span>
            {anime.year && <span>• {anime.year}</span>}
            {anime.episodes && <span>• {anime.episodes} eps</span>}
            {anime.status && (
              <span>
                • <span className={`${styles.statusDot} ${statusClass}`} />
                {anime.status}
              </span>
            )}
          </div>
          {Array.isArray(anime.genres) && anime.genres.length > 0 && (
            <div className={styles.listGenres}>
              {anime.genres.slice(0, 3).map((g) => (
                <span key={g} className={styles.genreChip}>
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
        {displayScore && (
          <div className={styles.listScore}>
            <span>★</span>
            <span>{displayScore}</span>
          </div>
        )}
      </Link>
    );
  }

  if (viewMode === 'compact') {
    return (
      <Link href={`/anime/${anime.slug || anime.id}`} className={styles.cardCompact}>
        <div className={styles.posterWrapper}>
          <AnimeImage src={anime.posterImage} alt={displayTitle} fill />
          {displayScore && (
            <div className={styles.scoreBadge}>
              <span>★</span>
              <span>{displayScore}</span>
            </div>
          )}
        </div>
        <div className={styles.infoBlock}>
          <span className={styles.title}>{displayTitle}</span>
          <div className={styles.metaRow}>
            <span>{anime.type || 'TV'}</span>
            <span>{anime.year || ''}</span>
          </div>
        </div>
      </Link>
    );
  }

  // Default Cinematic Grid
  return (
    <Link href={`/anime/${anime.slug || anime.id}`} className={styles.cardGrid}>
      <div className={styles.posterWrapper}>
        <AnimeImage src={anime.posterImage} alt={displayTitle} fill />
        {displayScore && (
          <div className={styles.scoreBadge}>
            <span>★</span>
            <span>{displayScore}</span>
          </div>
        )}
        <div className={styles.typeBadge}>{anime.type || 'TV'}</div>
      </div>
      <div className={styles.infoBlock}>
        <span className={styles.title}>{displayTitle}</span>
        {anime.englishTitle && anime.englishTitle !== displayTitle && (
          <span className={styles.englishTitle}>{anime.englishTitle}</span>
        )}
        <div className={styles.metaRow}>
          <span>
            <span className={`${styles.statusDot} ${statusClass}`} />
            {anime.status || 'Finished'}
          </span>
          <span>{anime.year ? `${anime.year}` : anime.episodes ? `${anime.episodes} eps` : ''}</span>
        </div>
      </div>
    </Link>
  );
};
