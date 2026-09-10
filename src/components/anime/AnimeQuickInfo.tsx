'use client';

import React from 'react';
import Link from 'next/link';
import { Anime } from '../../types/anime';
import styles from './AnimeQuickInfo.module.css';

interface AnimeQuickInfoProps {
  anime: Anime;
}

export const AnimeQuickInfo: React.FC<AnimeQuickInfoProps> = ({ anime }) => {
  const studiosList = Array.isArray(anime.studios)
    ? anime.studios.map((s: any) => (typeof s === 'string' ? { name: s, slug: s.toLowerCase().replace(/\s+/g, '-') } : s))
    : [];

  const genresList = Array.isArray(anime.genres) ? anime.genres : [];
  const durationStr = (anime as any).duration || '24 min';
  const airedStr = (anime as any).aired || 'Apr 7, 2013 to Nov 5, 2023';
  const seasonStr = (anime as any).season ? `${(anime as any).season} ${anime.year || ''}` : `Spring ${anime.year || 2023}`;
  const sourceStr = (anime as any).source || 'Manga';
  const themeStr = (anime as any).themes ? (anime as any).themes.join(', ') : 'Military, Survival';
  const ratingStr = (anime as any).rating || 'R - 17+ (violence & gore)';

  return (
    <div className={styles.card} role="region" aria-label="Anime Information">
      <h3 className={styles.header}>Information</h3>

      <div className={styles.list}>
        <div className={styles.row}>
          <span className={styles.label}>Status</span>
          <span className={styles.value}>{anime.status || 'Finished Airing'}</span>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Episodes</span>
          <span className={styles.value}>{anime.episodes || 24}</span>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Episode Duration</span>
          <span className={styles.value}>{durationStr}</span>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Aired</span>
          <span className={styles.value}>{airedStr}</span>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Season</span>
          <span className={styles.value}>{seasonStr}</span>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Source</span>
          <span className={styles.value}>{sourceStr}</span>
        </div>

        {studiosList.length > 0 && (
          <div className={styles.row}>
            <span className={styles.label}>Studio</span>
            <span className={styles.value}>
              {studiosList.map((st, i) => (
                <React.Fragment key={st.slug || st.name}>
                  <Link href={`/studio/${st.slug || st.name}`} className={styles.entityLink}>
                    {st.name}
                  </Link>
                  {i < studiosList.length - 1 && <span className={styles.separator}>›</span>}
                </React.Fragment>
              ))}
            </span>
          </div>
        )}

        {genresList.length > 0 && (
          <div className={styles.row}>
            <span className={styles.label}>Genres</span>
            <span className={styles.value}>
              {genresList.map((g, i) => (
                <React.Fragment key={g}>
                  <Link href={`/explore?genre=${encodeURIComponent(g)}`} className={styles.entityLink}>
                    {g}
                  </Link>
                  {i < genresList.length - 1 && <span className={styles.separator}>, </span>}
                </React.Fragment>
              ))}
            </span>
          </div>
        )}

        <div className={styles.row}>
          <span className={styles.label}>Theme</span>
          <span className={styles.value}>{themeStr}</span>
        </div>

        <div className={styles.row}>
          <span className={styles.label}>Rating</span>
          <span className={styles.value}>{ratingStr}</span>
        </div>
      </div>
    </div>
  );
};
