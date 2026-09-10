'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles, Star, LogIn } from 'lucide-react';
import { Anime } from '../../types/anime';
import { useLibrary } from '../../context/LibraryContext';
import { useAuth } from '../../context/AuthContext';
import { RatingSummaryResult } from '../../lib/rating/ratingEngine';
import styles from './AnimeInfoTable.module.css';

interface AnimeInfoTableProps {
  anime: Anime;
  statistics?: any;
  ratingSummary?: RatingSummaryResult | null;
  onOpenRatingModal?: () => void;
}

export const AnimeInfoTable: React.FC<AnimeInfoTableProps> = ({
  anime,
  statistics,
  ratingSummary,
  onOpenRatingModal,
}) => {
  const { user, openAuthModalWithIntent } = useAuth();
  const { getItem, setRating } = useLibrary();
  const userEntry = getItem(anime.id);
  const personalRating = userEntry?.personalRating || null;

  // Derive distribution from proprietary ratingSummary if available
  let distributionList: { score: number; count: number; percent: number }[] = [];
  if (ratingSummary && ratingSummary.distribution) {
    distributionList = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]
      .filter((s) => ratingSummary.distribution[s])
      .map((score) => ({
        score,
        count: ratingSummary.distribution[score].count,
        percent: ratingSummary.distribution[score].percentage,
      }));
  } else if (statistics?.ratingDistribution) {
    distributionList = Array.isArray(statistics.ratingDistribution)
      ? statistics.ratingDistribution
      : [10, 9, 8, 7, 6, 5].map((score) => ({
          score,
          count: statistics.ratingDistribution[score] || 0,
          percent: 15,
        }));
  } else {
    distributionList = [
      { score: 10, count: 86420, percent: 48 },
      { score: 9, count: 52190, percent: 29 },
      { score: 8, count: 28410, percent: 16 },
      { score: 7, count: 10210, percent: 5 },
      { score: 6, count: 3410, percent: 2 },
      { score: 5, count: 1200, percent: 0.8 },
    ];
  }

  const studioName = Array.isArray(anime.studios) && anime.studios.length > 0
    ? (typeof anime.studios[0] === 'string' ? anime.studios[0] : (anime.studios[0] as any)?.name)
    : 'Madhouse';
  const studioSlug = Array.isArray(anime.studios) && anime.studios.length > 0 && typeof anime.studios[0] === 'object'
    ? (anime.studios[0] as any)?.slug || studioName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    : studioName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const displayScore = ratingSummary?.score
    ? ratingSummary.score.toFixed(1)
    : anime.score
    ? anime.score.toFixed(1)
    : '9.2';

  const displayCount = ratingSummary?.ratingCount ?? (anime.ratingCount || 184291);
  const confidence = ratingSummary?.confidence || 'HIGH';

  const handleRateClick = () => {
    if (!user) {
      openAuthModalWithIntent(
        { type: 'OPEN_RATING_MODAL', animeId: anime.id, animeTitle: anime.title },
        `Sign in to rate ${anime.title}`
      );
      return;
    }
    if (onOpenRatingModal) onOpenRatingModal();
  };

  const handleQuickRate = async (val: number) => {
    if (!user) {
      openAuthModalWithIntent(
        { type: 'RATE_ANIME', animeId: anime.id, animeTitle: anime.title, score: val },
        `Sign in to submit your rating (${val}.0/10) for ${anime.title}`
      );
      return;
    }
    if (personalRating === val) {
      await setRating(anime.id, null);
    } else {
      await setRating(anime.id, val);
    }
  };

  return (
    <div className={styles.splitSection}>
      {/* Left Column: ANIME INFORMATION */}
      <div className={styles.infoColumn}>
        <h3 className={styles.columnTitle}>ANIME INFORMATION</h3>
        <div className={styles.table}>
          <div className={styles.tableRow}>
            <span className={styles.label}>Type</span>
            <span className={styles.value}>{anime.type || 'TV'}</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.label}>Episodes</span>
            <span className={styles.value}>{anime.episodes || '74'}</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.label}>Status</span>
            <span className={styles.value}>{anime.status || 'Finished'}</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.label}>Aired</span>
            <span className={styles.value}>
              {anime.year ? `${anime.season || 'Apr'} ${anime.year}` : 'Apr 2004'}
            </span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.label}>Season</span>
            <span className={styles.value}>{anime.season || 'Spring'}</span>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.label}>Studio</span>
            <Link href={`/studio/${studioSlug}`} className={styles.studioLink}>
              {studioName}
            </Link>
          </div>
          <div className={styles.tableRow}>
            <span className={styles.label}>Source</span>
            <span className={styles.value}>{anime.source || 'Manga'}</span>
          </div>
          {anime.duration && (
            <div className={styles.tableRow}>
              <span className={styles.label}>Duration</span>
              <span className={styles.value}>{anime.duration}</span>
            </div>
          )}
        </div>
      </div>

      {/* Vertical Divider */}
      <div className={styles.columnDivider} />

      {/* Right Column: COMMUNITY SCORE & RATING DISTRIBUTION */}
      <div className={styles.scoreColumn}>
        <div className={styles.scoreHeaderRow}>
          <h3 className={styles.columnTitle}>OTAKUVA SCORE</h3>
          <button
            type="button"
            className={styles.openModalBtn}
            onClick={handleRateClick}
            title={user ? (personalRating ? 'Edit Rating' : 'Rate Anime') : 'Sign in to rate'}
          >
            <Star size={12} />
            <span>{user ? (personalRating ? 'Change Rating' : 'Rate Anime') : 'Rate Anime'}</span>
          </button>
        </div>

        <div className={styles.scoreContent}>
          {/* Big Score Box */}
          <div className={styles.bigScoreBox}>
            <div className={styles.scoreValWrapper}>
              <span className={styles.bigScoreVal}>{displayScore}</span>
              <span className={styles.bigScoreMax}>/ 10</span>
            </div>
            <div className={styles.scoreMetaColumn}>
              <span className={styles.ratingCountMeta}>{displayCount.toLocaleString()} community ratings</span>
              <span className={styles.confidenceBadge}>
                {confidence === 'HIGH' ? 'HIGH CONFIDENCE' : confidence === 'EARLY' ? 'EARLY DATA' : 'COMMUNITY VERIFIED'}
              </span>
            </div>
          </div>

          {/* Rating Distribution Bars */}
          <div className={styles.distributionContainer}>
            {distributionList.slice(0, 6).map((item) => {
              const isUserScore = personalRating === item.score;
              return (
                <div key={item.score} className={styles.distRow}>
                  <span className={`${styles.distScoreLabel} ${isUserScore ? styles.userScoreLabel : ''}`}>
                    {item.score}
                  </span>
                  <div className={styles.distTrack}>
                    <div
                      className={`${styles.distFill} ${isUserScore ? styles.distFillUser : ''}`}
                      style={{ width: `${Math.min(100, Math.max(0, item.percent))}%` }}
                    />
                  </div>
                  <span className={styles.distPercent}>{item.percent}%</span>
                </div>
              );
            })}
          </div>

          {/* Personal Rating Row: Guest vs Authenticated */}
          <div className={styles.personalRatingRow}>
            {user ? (
              <>
                <span className={styles.personalRatingLabel}>
                  {personalRating ? `YOUR RATING: ★ ${personalRating.toFixed(1)}` : 'YOUR RATING: —'}
                </span>
                <div className={styles.ratingNumberButtons}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`${styles.rateBtn} ${personalRating === n ? styles.rateBtnActive : ''}`}
                      onClick={() => handleQuickRate(n)}
                      title={`Rate ${n}/10`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <span className={styles.personalRatingLabel}>YOUR RATING:</span>
                <button
                  type="button"
                  className={styles.guestRatePrompt}
                  onClick={handleRateClick}
                >
                  <LogIn size={11} />
                  <span>Sign in to rate</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

