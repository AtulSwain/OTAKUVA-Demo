'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { AnimeCard, AnimeCardItem } from '../../../components/anime/AnimeCard';

const DAYS = ['All', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function AiringContent() {
  const [selectedDay, setSelectedDay] = useState('All');
  const [animeList, setAnimeList] = useState<AnimeCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch(`/api/anime/airing?day=${selectedDay}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setAnimeList(data.items || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load airing anime:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDay]);

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
          CURRENTLY AIRING
        </h1>
        <p style={{ fontSize: '13px', color: '#A1A1AA', marginTop: '4px' }}>
          Weekly broadcast schedule and ongoing series.
        </p>
      </div>

      {/* Day Filter */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          backgroundColor: '#18181B',
          border: '1px solid #2A2A2E',
          borderRadius: '8px',
          padding: '12px 16px',
        }}
      >
        {DAYS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setSelectedDay(d)}
            style={{
              background: selectedDay === d ? 'var(--accent)' : '#202024',
              color: selectedDay === d ? '#FFFFFF' : '#A1A1AA',
              border: '1px solid',
              borderColor: selectedDay === d ? 'var(--accent)' : '#2A2A2E',
              borderRadius: '6px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Anime Grid */}
      {isLoading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#71717A' }}>Loading Airing Anime...</div>
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
          No currently airing anime found for {selectedDay}.
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

export default function AiringPage() {
  return (
    <Suspense fallback={<div style={{ padding: '60px 20px', textAlign: 'center', color: '#71717A' }}>Loading...</div>}>
      <AiringContent />
    </Suspense>
  );
}
