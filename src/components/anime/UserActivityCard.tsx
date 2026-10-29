'use client';

import { retentionColor, retentionLabel } from '../../lib/rating/retentionTone';
import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import styles from './UserActivityCard.module.css';

interface UserActivityCardProps {
  animeId: string;
  totalEpisodes?: number | null;
  /** The viewer's own retention for this anime (average of the episodes they rated). */
  myRetention?: number | null;
}

/**
 * The viewer's own recorded state for this anime. Progress used to default
 * to 25 total episodes and to "14 watched" for any WATCHING entry.
 */
export const UserActivityCard: React.FC<UserActivityCardProps> = ({
  animeId,
  totalEpisodes = null,
  myRetention = null,
}) => {
  const { user } = useAuth();
  const { getStatus, getItem } = useLibrary();

  const status = getStatus(animeId);
  const libraryItem = getItem(animeId);
  const watched = libraryItem?.episodesWatched ?? 0;

  return (
    <div className={styles.card} aria-label="Your Anime Journey">
      <h3 className={styles.heading}>Your Anime Journey</h3>
      {user ? (
        <>
          <div className={styles.row}>
            <span className={styles.label}>Library</span>
            <span className={`${styles.value} ${status ? styles.activeValue : ''}`}>
              {status ? status.replace(/_/g, ' ').toUpperCase() : 'Not Added'}
            </span>
          </div>
          {status && (
            <div className={styles.row}>
              <span className={styles.label}>Progress</span>
              <span className={styles.value}>
                {totalEpisodes ? `${watched} / ${totalEpisodes} eps` : `${watched} eps watched`}
              </span>
            </div>
          )}
          <div className={styles.row}>
            <span className={styles.label}>Favorite</span>
            <span className={styles.value}>{libraryItem?.isFavorite ? 'Favorited' : 'Not Favorited'}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Your retention</span>
            <span className={styles.value} style={typeof myRetention === 'number' ? { color: retentionColor(myRetention) } : undefined}>
              {typeof myRetention === 'number' ? `${myRetention}% · ${retentionLabel(myRetention)}` : 'Not rated yet'}
            </span>
          </div>
        </>
      ) : (
        <p className={styles.guestPrompt}>Sign in to track progress, rate, and add this to your library.</p>
      )}
    </div>
  );
};
