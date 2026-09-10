'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Play, Check } from 'lucide-react';
import { Anime, UserAnimeProgress } from '../../types/anime';
import { ProgressBar } from './ProgressBar';
import { getAnimeDisplayTitle } from '../../lib/animeTitleResolver';
import styles from './ContinueWatchingCard.module.css';

interface ContinueWatchingCardProps {
  anime: Anime;
  progress: UserAnimeProgress;
  onIncrementEpisode?: (animeId: string) => void;
  className?: string;
}

export const ContinueWatchingCard: React.FC<ContinueWatchingCardProps> = ({
  anime,
  progress,
  onIncrementEpisode,
  className = '',
}) => {
  const displayTitle = getAnimeDisplayTitle(anime);
  const currentEp = progress.episodesWatched;
  const totalEp = progress.totalEpisodes || anime?.episodes || 0;
  const percentage = totalEp > 0 ? Math.round((currentEp / totalEp) * 100) : 0;
  const nextEp = currentEp + 1;
  const isComplete = totalEp > 0 && currentEp >= totalEp;

  const handleQuickAdvance = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onIncrementEpisode && !isComplete && anime?.id) {
      onIncrementEpisode(anime.id);
    }
  };

  return (
    <div className={`${styles.card} ${className}`}>
      <Link href={`/anime/${anime?.slug || anime?.id}`} className={styles.linkWrapper}>
        <div className={styles.posterWrapper}>
          {(anime?.posterImage || (anime as any)?.posterUrl) ? (
            <Image
              src={anime.posterImage || (anime as any).posterUrl}
              alt={displayTitle}
              fill
              sizes="(max-width: 640px) 100px, 120px"
              className={styles.poster}
              unoptimized
            />
          ) : (
            <div className={styles.posterFallback} />
          )}
          <div className={styles.playOverlay}>
            <Play size={20} className={styles.playIcon} />
          </div>
        </div>

        <div className={styles.details}>
          <div className={styles.headerRow}>
            <span className={styles.typeTag}>{anime?.type || 'TV'}</span>
            {progress.updatedAt && (
              <span className={styles.updatedAt}>{progress.updatedAt}</span>
            )}
          </div>

          <h4 className={styles.title} title={displayTitle}>
            {displayTitle}
          </h4>

          <div className={styles.progressSection}>
            <div className={styles.progressLabelRow}>
              <span className={styles.episodeText}>
                {isComplete ? 'Completed' : `Episode ${currentEp} / ${totalEp || '?'}`}
              </span>
              <span className={styles.percentageText}>{percentage}%</span>
            </div>

            <ProgressBar value={percentage} size="sm" />
          </div>

          <div className={styles.actionsRow}>
            <span className={styles.continueLink}>
              <Play size={12} fill="currentColor" />
              {isComplete ? 'Re-watch' : `Continue Ep ${nextEp}`}
            </span>

            {onIncrementEpisode && !isComplete && (
              <button
                type="button"
                className={styles.quickAdvanceBtn}
                onClick={handleQuickAdvance}
                title={`Mark Ep ${nextEp} watched`}
                aria-label={`Mark episode ${nextEp} of ${anime.title} watched`}
              >
                <Check size={14} />
                <span>+1 Ep</span>
              </button>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};
