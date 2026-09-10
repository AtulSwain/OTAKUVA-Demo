'use client';

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLibrary } from '../../context/LibraryContext';
import styles from './UserActivityCard.module.css';

interface UserActivityCardProps {
  animeId: string;
  totalEpisodes?: number;
  userRating?: number | null;
}

export const UserActivityCard: React.FC<UserActivityCardProps> = ({
  animeId,
  totalEpisodes = 25,
  userRating,
}) => {
  const { user } = useAuth();
  const { getStatus, getItem } = useLibrary();

  const status = getStatus(animeId);
  const libraryItem = getItem(animeId);
  const watched = libraryItem?.episodesWatched || (status === 'completed' ? totalEpisodes : status === 'watching' ? Math.min(14, totalEpisodes) : 0);

  return (
    <div className={styles.card} aria-label="Your Personal Activity">
      <h3 className={styles.heading}>Your Activity</h3>
      {user ? (
        <>
          <div className={styles.row}>
            <span className={styles.label}>Library</span>
            <span className={`${styles.value} ${status ? styles.activeValue : ''}`}>
              {status ? status.replace('_', ' ').toUpperCase() : 'Not Added'}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Progress</span>
            <span className={styles.value}>
              {watched} / {totalEpisodes} eps
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Favorite</span>
            <span className={styles.value}>
              {libraryItem?.isFavorite ? '♥ Favorited' : 'Not Favorited'}
            </span>
          </div>
          <div className={styles.row}>
            <span className={styles.label}>Your Rating</span>
            <span className={styles.value}>
              {userRating ? `★ ${userRating} / 10` : 'Not Rated'}
            </span>
          </div>
        </>
      ) : (
        <>
          <div className={styles.row}>
            <span className={styles.label}>Status</span>
            <span className={styles.value}>Guest Mode</span>
          </div>
          <p className={styles.guestPrompt}>Sign in to save progress, submit ratings, and add to your library.</p>
        </>
      )}
    </div>
  );
};
