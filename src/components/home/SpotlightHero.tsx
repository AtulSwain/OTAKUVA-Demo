'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Play, Plus, Check } from 'lucide-react';
import { Anime } from '../../types/anime';
import { AnimeImage } from '../anime/AnimeImage';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { getAnimeDisplayTitle } from '../../lib/animeTitleResolver';
import styles from './SpotlightHero.module.css';

interface SpotlightHeroProps {
  animeList: Anime[];
  onOpenTrailer?: (trailerUrl: string, title: string) => void;
}

export const SpotlightHero: React.FC<SpotlightHeroProps> = ({
  animeList,
  onOpenTrailer,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const { getStatus, updateStatus } = useLibrary();
  const { showToast } = useToast();

  const activeList = animeList || [];

  // Auto-rotate hero every 8s
  useEffect(() => {
    if (activeList.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeList.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [activeList.length]);

  if (activeList.length === 0) return null;

  const currentAnime = activeList[currentIndex] || activeList[0];
  const displayTitle = getAnimeDisplayTitle(currentAnime as Anime);
  const targetKey = (currentAnime as any).otakuva_anime_id || currentAnime.id || (currentAnime as any).slug;
  const currentStatus = getStatus(targetKey) || (currentAnime.slug ? getStatus(currentAnime.slug) : undefined);
  const isInLibrary = Boolean(currentStatus);

  const handleLibraryToggle = async () => {
    if (!isInLibrary) {
      await updateStatus(targetKey, 'watching');
    } else {
      await updateStatus(targetKey, currentStatus === 'watching' ? 'completed' : 'watching');
    }
  };

  const backdropSrc =
    (currentAnime as any).bannerUrl ||
    currentAnime.bannerImage ||
    currentAnime.posterImage ||
    (currentAnime as any).posterUrl;

  const scoreVal = currentAnime.score ? Number(currentAnime.score).toFixed(1) : '—';
  const metaText = `${currentAnime.type || 'TV'} • ${currentAnime.year || 2026} • ${currentAnime.episodes || 24} Episodes • ${currentAnime.status || 'Finished'}`;

  return (
    <section className={styles.hero} aria-label="Featured Anime Spotlight">
      {/* Backdrop image and overlays */}
      <div className={styles.heroArt}>
        <AnimeImage
          src={backdropSrc}
          alt={displayTitle}
          fill
          priority
          sizes="100vw"
          className={styles.heroBackdropImg}
        />
        <div className={styles.heroOverlay} />
      </div>

      {/* Hero Content */}
      <div className={styles.heroContent}>
        <div className={styles.eyebrow}>FEATURED • OTAKUVA EDITORIAL</div>
        <h1 className={styles.title}>{displayTitle}</h1>

        <div className={styles.metaRow}>
          <span>{metaText}</span>
          <div className={styles.scoreBadge}>
            <span>OTAKUVA SCORE</span>
            <strong className={styles.scoreNum}>{scoreVal}</strong>
            <span className={styles.scoreStars}>★★★★★</span>
          </div>
        </div>

        <p className={styles.synopsis}>
          {currentAnime.synopsis ||
            'Discover why the OTAKUVA community rates this story among the highest in anime storytelling.'}
        </p>

        <div className={styles.actionsRow}>
          <Link href={`/anime/${currentAnime.slug || currentAnime.id}`} className={`${styles.btn} ${styles.btnPrimary}`}>
            View Anime
          </Link>

          <button
            type="button"
            className={`${styles.btn} ${isInLibrary ? styles.btnInLibrary : ''}`}
            onClick={handleLibraryToggle}
          >
            {isInLibrary ? <Check size={15} /> : <Plus size={15} />}
            <span>{isInLibrary ? 'In Library' : '＋ Library'}</span>
          </button>

          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              const trailer = (currentAnime as any).trailerUrl || 'https://www.youtube.com/watch?v=M_OauHnAFc8';
              if (onOpenTrailer) onOpenTrailer(trailer, displayTitle);
            }}
          >
            <Play size={15} fill="currentColor" />
            <span>▶ Trailer</span>
          </button>
        </div>

        {/* Slide Indicators */}
        {activeList.length > 1 && (
          <div className={styles.indicatorsRow}>
            {activeList.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`${styles.indicatorDot} ${currentIndex === idx ? styles.indicatorDotActive : ''}`}
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
