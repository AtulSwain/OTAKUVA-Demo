'use client';

import React, { useState, useEffect } from 'react';
import { Calendar } from 'lucide-react';
import { Anime } from '../../types/anime';
import { AnimeCard } from '../../components/ui/AnimeCard';
import { AnimeCardSkeleton } from '../../components/ui/Skeleton';
import { QuickViewModal } from '../../components/ui/QuickViewModal';
import { FIXTURE_ANIMES } from '../../fixtures/anime.fixture';
import styles from './seasonal.module.css';

const SEASONS = ['Winter', 'Spring', 'Summer', 'Fall'] as const;
const YEARS = ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];
const TYPES = ['All', 'TV', 'Movie', 'ONA', 'OVA'] as const;

export default function SeasonalPage() {
  const [selectedSeason, setSelectedSeason] = useState<typeof SEASONS[number]>('Winter');
  const [selectedYear, setSelectedYear] = useState('2024');
  const [selectedType, setSelectedType] = useState<typeof TYPES[number]>('All');
  const [animes, setAnimes] = useState<Anime[]>(FIXTURE_ANIMES);
  const [isLoading, setIsLoading] = useState(true);
  const [quickViewAnime, setQuickViewAnime] = useState<Anime | null>(null);

  useEffect(() => {
    const fetchSeasonal = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', '50');
        params.set('season', selectedSeason);
        params.set('year', selectedYear);
        if (selectedType !== 'All') params.set('type', selectedType);
        params.set('sortBy', 'popularity');

        const res = await fetch(`/api/anime?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          const list = data.animes || data.data || [];
          if (list.length > 0) {
            setAnimes(list);
          } else {
            // Fallback to popularity without strict season if data is sparse
            const fallbackRes = await fetch(`/api/anime?limit=50&sortBy=popularity`);
            if (fallbackRes.ok) {
              const fallbackData = await fallbackRes.json();
              if (fallbackData.animes) setAnimes(fallbackData.animes);
            }
          }
        }
      } catch (e) {
        console.error('Error fetching seasonal anime:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSeasonal();
  }, [selectedSeason, selectedYear, selectedType]);

  return (
    <div className={styles.seasonalPage}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Calendar size={22} className={styles.headerIcon} />
          <h1 className={styles.title}>Seasonal Anime Intelligence</h1>
        </div>
        <p className={styles.subtitle}>
          Explore quarterly seasonal schedules, premiere windows, and popular broadcasts across the anime industry.
        </p>
      </div>

      {/* Seasonal Controls Bar */}
      <div className={styles.controlsBar}>
        {/* Season Selector */}
        <div className={styles.seasonGroup} role="tablist">
          {SEASONS.map((season) => (
            <button
              key={season}
              type="button"
              role="tab"
              aria-selected={selectedSeason === season}
              className={`${styles.seasonTab} ${selectedSeason === season ? styles.seasonTabActive : ''}`}
              onClick={() => setSelectedSeason(season)}
            >
              {season}
            </button>
          ))}
        </div>

        {/* Year Selector & Format Filter */}
        <div className={styles.filterGroup}>
          <select
            className={styles.selectBox}
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            aria-label="Select broadcast year"
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y} Season
              </option>
            ))}
          </select>

          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              className={`${styles.typePill} ${selectedType === t ? styles.typePillActive : ''}`}
              onClick={() => setSelectedType(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Seasonal Catalog Grid */}
      {isLoading ? (
        <div className={styles.grid}>
          {Array.from({ length: 12 }).map((_, i) => (
            <AnimeCardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className={styles.grid}>
          {animes.map((anime) => (
            <AnimeCard
              key={anime.id}
              anime={anime}
              onQuickView={(a) => setQuickViewAnime(a)}
            />
          ))}
        </div>
      )}

      {/* Quick View Modal */}
      <QuickViewModal
        anime={quickViewAnime}
        isOpen={Boolean(quickViewAnime)}
        onClose={() => setQuickViewAnime(null)}
      />
    </div>
  );
}
