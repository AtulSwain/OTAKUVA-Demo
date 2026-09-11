'use client';

import React from 'react';
import Link from 'next/link';
import { AnimeImage } from './AnimeImage';
import styles from './PersonalizedRecommendations.module.css';

export interface RecommendationItem {
  id: string;
  slug: string;
  title: string;
  posterImage?: string | null;
  score?: number | null;
  genre?: string | null;
  reason?: string | null;
}

interface PersonalizedRecommendationsProps {
  recommendations: RecommendationItem[];
  /** True when the engine had the viewer's library/taste to work from. */
  personalized?: boolean;
}

/**
 * Renders the recommendation engine's results and nothing else. It used to
 * fall back to a fixed list of five titles with invented reasons, shown as
 * "personalized" to every visitor on every anime.
 */
export const PersonalizedRecommendations: React.FC<PersonalizedRecommendationsProps> = ({
  recommendations,
  personalized = false,
}) => {
  if (recommendations.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Recommendations">
      <div className={styles.sectionHead}>
        <h2 className={styles.title}>{personalized ? 'Recommended for You' : 'More Like This'}</h2>
        <span className={styles.subtitle}>
          {personalized ? 'Based on this title and your library' : 'Based on this title'}
        </span>
      </div>

      <div className={styles.cardsGrid}>
        {recommendations.map((anime) => (
          <Link key={anime.id} href={`/anime/${anime.slug}`} className={styles.card}>
            <div className={styles.thumbWrapper}>
              <AnimeImage src={anime.posterImage} alt={anime.title} fill sizes="(max-width: 600px) 50vw, 20vw" />
            </div>
            <div className={styles.cardBody}>
              <strong className={styles.animeTitle}>{anime.title}</strong>
              <div className={styles.metaRow}>
                {typeof anime.score === 'number' && <span className={styles.scoreBadge}>{anime.score.toFixed(1)}</span>}
                {anime.genre && <span>{typeof anime.score === 'number' ? '• ' : ''}{anime.genre}</span>}
              </div>
              {anime.reason && <span className={styles.reasonBadge}>{anime.reason}</span>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
