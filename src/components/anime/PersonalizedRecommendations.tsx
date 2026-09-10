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
  animeTitle?: string;
  recommendations?: RecommendationItem[];
}

export const PersonalizedRecommendations: React.FC<PersonalizedRecommendationsProps> = ({
  animeTitle = 'this anime',
  recommendations,
}) => {
  const items = recommendations && recommendations.length > 0
    ? recommendations
    : [
        { id: 'vinland-saga', slug: 'vinland-saga', title: 'Vinland Saga', score: 9.1, genre: 'Drama • Action', reason: 'Shared intensity & historical drama' },
        { id: 'solo-leveling', slug: 'solo-leveling', title: 'Solo Leveling', score: 8.7, genre: 'Action • Fantasy', reason: 'High action pacing & world scale' },
        { id: 'monster', slug: 'monster', title: 'Monster', score: 9.1, genre: 'Mystery • Thriller', reason: 'Psychological depth & suspense' },
        { id: 'fullmetal-alchemist-brotherhood', slug: 'fullmetal-alchemist-brotherhood', title: 'Fullmetal Alchemist: Brotherhood', score: 9.2, genre: 'Action • Adventure', reason: 'Epic narrative scale & world-building' },
        { id: 'cyberpunk-edgerunners', slug: 'cyberpunk-edgerunners', title: 'Cyberpunk: Edgerunners', score: 8.6, genre: 'Sci-Fi • Action', reason: 'Kinetic animation & tragedy' },
      ];

  return (
    <section className={styles.section} aria-label="Personalized Recommendations">
      <div className={styles.sectionHead}>
        <h2 className={styles.title}>Because You Like This</h2>
        <span className={styles.subtitle}>Personalized recommendations</span>
      </div>

      <div className={styles.cardsGrid}>
        {items.map((anime) => (
          <Link key={anime.id} href={`/anime/${anime.slug || anime.id}`} className={styles.card}>
            <div className={styles.thumbWrapper}>
              <AnimeImage src={anime.posterImage} alt={anime.title} fill sizes="(max-width: 600px) 50vw, 20vw" />
            </div>
            <div className={styles.cardBody}>
              <strong className={styles.animeTitle}>{anime.title}</strong>
              <div className={styles.metaRow}>
                {anime.score && <span className={styles.scoreBadge}>★ {anime.score.toFixed(1)}</span>}
                {anime.genre && <span>• {anime.genre}</span>}
              </div>
              {anime.reason && <span className={styles.reasonBadge}>{anime.reason}</span>}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
