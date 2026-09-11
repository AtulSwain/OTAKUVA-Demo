'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { AnimeCard, AnimeCardItem } from '../../../components/anime/AnimeCard';

const SEASONS = ['WINTER', 'SPRING', 'SUMMER', 'FALL'];
const YEARS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];

function SeasonalContent() {
  const currentYear = new Date().getFullYear();
  const [selectedSeason, setSelectedSeason] = useState('FALL');
  const [selectedYear, setSelectedYear] = useState(2023);
  const [animeList, setAnimeList] = useState<AnimeCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch(`/api/anime/seasonal?season=${selectedSeason}&year=${selectedYear}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setAnimeList(data.items || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load seasonal anime:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSeason, selectedYear]);

  return (
    <div
      style={{
        maxWidth: '1480px',
        margin: '0 auto',
        padding: '32px 24px 60px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#EDEDEF', textTransform: 'uppercase' }}>
          SEASONAL ANIME
        </h1>
        <p style={{ fontSize: '13px', color: '#A1A1AA', marginTop: '4px' }}>
          Browse seasonal lineups and premiering anime broadcasts.
        </p>
      </div>

      {/* Season and Year selectors */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          backgroundColor: '#18181B',
          border: '1px solid #2A2A2E',
          borderRadius: '8px',
          padding: '12px 16px',
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          {SEASONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSelectedSeason(s)}
              style={{
                background: selectedSeason === s ? 'var(--accent)' : '#202024',
                color: selectedSeason === s ? '#FFFFFF' : '#A1A1AA',
                border: '1px solid',
                borderColor: selectedSeason === s ? 'var(--accent)' : '#2A2A2E',
                borderRadius: '6px',
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          style={{
            backgroundColor: '#202024',
            border: '1px solid #2A2A2E',
            borderRadius: '6px',
            padding: '6px 12px',
            color: '#EDEDEF',
            fontSize: '13px',
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {/* Anime Grid */}
      {isLoading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#71717A' }}>
          Loading {selectedSeason} {selectedYear} Anime...
        </div>
      ) : animeList.length === 0 ? (
        <div
          style={{
            padding: '60px 20px',
            textAlign: 'center',
            backgroundColor: '#18181B',
            borderRadius: '8px',
            border: '1px solid #2A2A2E',
            color: '#A1A1AA',
          }}
        >
          No seasonal records found for {selectedSeason} {selectedYear}.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px',
          }}
        >
          {animeList.map((anime) => (
            <AnimeCard key={anime.id} anime={anime} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SeasonalPage() {
  return (
    <Suspense fallback={<div style={{ padding: '60px 20px', textAlign: 'center', color: '#71717A' }}>Loading...</div>}>
      <SeasonalContent />
    </Suspense>
  );
}
