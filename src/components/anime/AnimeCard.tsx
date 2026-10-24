'use client';

import React from 'react';
import Link from 'next/link';
import { AnimeImage } from './AnimeImage';
import styles from './AnimeCard.module.css';
import { CommunityScoreBadge } from '../rating/CommunityScoreBadge';
import { classifyAnimeStatus, formatAnimeStatus } from '../../lib/anime/animeStatus';

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

  // One vocabulary for both providers ("Finished Airing" used to count as
  // airing because it contains "air"); unknown status shows nothing.
  const statusKind = classifyAnimeStatus(anime.status);
  const statusLabel = formatAnimeStatus(anime.status);
  const statusClass =
    statusKind === 'airing' ? styles.statusAiring : statusKind === 'upcoming' ? styles.statusUpcoming : styles.statusFinished;
  const listMeta = [anime.type || null, anime.year ? String(anime.year) : null, anime.episodes ? `${anime.episodes} eps` : null].filter(
    Boolean
  ) as string[];

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
            {listMeta.length > 0 && <span>{listMeta.join(' · ')}</span>}
            {statusLabel && (
              <span className={styles.statusItem}>
                <span className={`${styles.statusDot} ${statusClass}`} aria-hidden="true" />
                {statusLabel}
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
        {/* Members' OTAKUVA score + retention (not the provider score). */}
        <div className={styles.listScore}>
          <CommunityScoreBadge animeId={anime.id} />
        </div>
      </Link>
    );
  }

  if (viewMode === 'compact') {
    return (
      <Link href={`/anime/${anime.slug || anime.id}`} className={styles.cardCompact}>
        <div className={styles.posterWrapper}>
          <AnimeImage src={anime.posterImage} alt={displayTitle} fill />
          <CommunityScoreBadge animeId={anime.id} variant="overlay" />
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
        <CommunityScoreBadge animeId={anime.id} variant="overlay" />
        {anime.type && <div className={styles.typeBadge}>{anime.type}</div>}
      </div>
      <div className={styles.infoBlock}>
        <span className={styles.title}>{displayTitle}</span>
        {anime.englishTitle && anime.englishTitle !== displayTitle && (
          <span className={styles.englishTitle}>{anime.englishTitle}</span>
        )}
        <div className={styles.metaRow}>
          {statusLabel ? (
            <span>
              <span className={`${styles.statusDot} ${statusClass}`} aria-hidden="true" />
              {statusLabel}
            </span>
          ) : (
            <span />
          )}
          <span>{anime.year ? `${anime.year}` : anime.episodes ? `${anime.episodes} eps` : ''}</span>
        </div>
      </div>
    </Link>
  );
};
