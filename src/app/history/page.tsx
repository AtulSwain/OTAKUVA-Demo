'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { History, Calendar, Star, Film, Sparkles, Filter } from 'lucide-react';
import { AnimeCard } from '../../components/ui/AnimeCard';
import { AnimeGrid } from '../../components/ui/AnimeGrid';
import { FIXTURE_ANIMES } from '../../fixtures/anime.fixture';
import styles from './history.module.css';

const DECADES = [
  { id: '2020s', label: '2020s (Modern Era)', startYear: 2020, endYear: 2029, description: 'Global streaming expansion, unprecedented cinematic quality, modern auteur masterworks.' },
  { id: '2010s', label: '2010s (Digital Revolution)', startYear: 2010, endYear: 2019, description: 'The golden age of dark fantasy, psychological depth, and international digital simulcasts.' },
  { id: '2000s', label: '2000s (Classic Renaissance)', startYear: 2000, endYear: 2009, description: 'Definitive auteur classics, psychological masterpieces (Monster, Death Note), and Madhouse milestones.' },
  { id: '1990s', label: '1990s (The Legendary Decade)', startYear: 1990, endYear: 1999, description: 'Neon Genesis Evangelion, Cowboy Bebop, cel-animation perfection, and cyberpunk philosophy.' },
  { id: '1980s', label: '1980s (OVA Boom & Sci-Fi)', startYear: 1980, endYear: 1989, description: 'Akira, Studio Ghibli origins, high-budget OVA innovations, and hand-drawn space epics.' },
  { id: '1970s', label: '1970s (The Foundation)', startYear: 1970, endYear: 1979, description: 'Mobile Suit Gundam, World Masterpiece Theater, and the birth of modern anime genres.' },
];

export default function HistoryPage() {
  const [selectedDecade, setSelectedDecade] = useState('2000s');
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [formatFilter, setFormatFilter] = useState('ALL');

  const currentDecade = DECADES.find((d) => d.id === selectedDecade) || DECADES[2];

  useEffect(() => {
    async function loadHistoricalAnime() {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/anime?startYear=${currentDecade.startYear}&endYear=${currentDecade.endYear}`);
        if (res.ok) {
          const data = await res.json();
          if (data.anime && data.anime.length > 0) {
            setAnimeList(data.anime);
          } else {
            // Filter fixture anime matching this decade if database is fresh
            const filtered = FIXTURE_ANIMES.filter((a) => {
              const y = a.year || 2004;
              return y >= currentDecade.startYear && y <= currentDecade.endYear;
            });
            setAnimeList(filtered.length > 0 ? filtered : FIXTURE_ANIMES.slice(0, 8));
          }
        } else {
          setAnimeList(FIXTURE_ANIMES);
        }
      } catch (err) {
        console.error('Error fetching historical catalog:', err);
        setAnimeList(FIXTURE_ANIMES);
      } finally {
        setIsLoading(false);
      }
    }

    loadHistoricalAnime();
  }, [selectedDecade, currentDecade.startYear, currentDecade.endYear]);

  const displayedAnime = formatFilter === 'ALL'
    ? animeList
    : animeList.filter((a) => a.type?.toUpperCase() === formatFilter.toUpperCase());

  return (
    <div className={styles.historyContainer}>
      {/* Editorial Header */}
      <div className={styles.header}>
        <div className={styles.pillarBadge}>
          <History size={13} />
          <span>CANONICAL ANIME ARCHIVE &amp; TIMELINE</span>
        </div>
        <h1 className={styles.pageTitle}>Anime History &amp; Decades Archive</h1>
        <p className={styles.pageSubtitle}>
          Journey through six decades of Japanese animation history — from early hand-drawn milestones to modern cinematic masterworks.
        </p>
      </div>

      {/* Decade Navigation Tabs */}
      <div className={styles.decadesNav}>
        {DECADES.map((dec) => (
          <button
            key={dec.id}
            type="button"
            className={`${styles.decadeBtn} ${selectedDecade === dec.id ? styles.decadeBtnActive : ''}`}
            onClick={() => setSelectedDecade(dec.id)}
          >
            <span className={styles.decadeName}>{dec.id}</span>
            <span className={styles.decadeYears}>{dec.startYear}–{dec.endYear}</span>
          </button>
        ))}
      </div>

      {/* Decade Context Banner */}
      <div className={styles.decadeBanner}>
        <div className={styles.bannerInfo}>
          <h2 className={styles.bannerTitle}>{currentDecade.label}</h2>
          <p className={styles.bannerDesc}>{currentDecade.description}</p>
        </div>

        <div className={styles.formatFilters}>
          {['ALL', 'TV', 'MOVIE', 'OVA'].map((fmt) => (
            <button
              key={fmt}
              type="button"
              className={`${styles.filterBtn} ${formatFilter === fmt ? styles.filterBtnActive : ''}`}
              onClick={() => setFormatFilter(fmt)}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* Historical Catalog Grid */}
      {isLoading ? (
        <div className={styles.loadingGrid}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      ) : displayedAnime.length === 0 ? (
        <div className={styles.emptyState}>
          <History size={32} />
          <h3>No Records Found for {selectedDecade}</h3>
          <p>Explore another decade in the chronological archive.</p>
        </div>
      ) : (
        <AnimeGrid>
          {displayedAnime.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </AnimeGrid>
      )}
    </div>
  );
}
