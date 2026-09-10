'use client';

import React, { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, ArrowRight, LucideIcon } from 'lucide-react';
import { Anime } from '../../types/anime';
import { AnimeCard } from './AnimeCard';
import styles from './StreamingRail.module.css';

interface StreamingRailProps {
  title: string;
  icon?: LucideIcon;
  viewAllHref?: string;
  viewAllLabel?: string;
  animes: Anime[];
  onQuickView?: (anime: Anime) => void;
  showRank?: boolean;
}

export const StreamingRail: React.FC<StreamingRailProps> = ({
  title,
  icon: Icon,
  viewAllHref,
  viewAllLabel = 'View All',
  animes,
  onQuickView,
  showRank = false,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScrollability = () => {
    if (!trackRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = trackRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
  };

  useEffect(() => {
    checkScrollability();
    const track = trackRef.current;
    if (track) {
      track.addEventListener('scroll', checkScrollability, { passive: true });
      window.addEventListener('resize', checkScrollability);
    }
    return () => {
      if (track) track.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [animes]);

  const scrollByDirection = (direction: 'left' | 'right') => {
    if (!trackRef.current) return;
    const scrollAmount = trackRef.current.clientWidth * 0.75;
    trackRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  };

  if (!animes || animes.length === 0) return null;

  return (
    <section className={styles.railSection} aria-label={title}>
      {/* Header Row */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          {Icon && (
            <span className={styles.iconWrap}>
              <Icon size={18} />
            </span>
          )}
          <h2 className={styles.title}>{title}</h2>
        </div>

        {viewAllHref && (
          <Link href={viewAllHref} className={styles.viewAllLink}>
            <span>{viewAllLabel}</span>
            <ArrowRight size={14} />
          </Link>
        )}
      </div>

      {/* Track Wrapper with Left/Right Nav Controls */}
      <div className={styles.trackWrapper}>
        {canScrollLeft && (
          <button
            type="button"
            className={`${styles.chevronBtn} ${styles.chevronLeft}`}
            onClick={() => scrollByDirection('left')}
            aria-label="Scroll left"
          >
            <ChevronLeft size={20} />
          </button>
        )}

        <div ref={trackRef} className={styles.scrollTrack}>
          {animes.map((anime, idx) => (
            <div key={anime.id} className={styles.railCardItem}>
              <AnimeCard
                anime={anime}
                rankNumber={showRank ? idx + 1 : undefined}
                onQuickView={onQuickView}
              />
            </div>
          ))}
        </div>

        {canScrollRight && (
          <button
            type="button"
            className={`${styles.chevronBtn} ${styles.chevronRight}`}
            onClick={() => scrollByDirection('right')}
            aria-label="Scroll right"
          >
            <ChevronRight size={20} />
          </button>
        )}
      </div>
    </section>
  );
};
