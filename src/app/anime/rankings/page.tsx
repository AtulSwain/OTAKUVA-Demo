'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { AnimeCard, AnimeCardItem } from '../../../components/anime/AnimeCard';

const CATEGORIES = [
  { label: 'Top Rated', value: 'top_rated' },
  { label: 'Most Popular', value: 'popular' },
  { label: 'Most Favorited', value: 'favorited' },
  { label: 'Trending', value: 'trending' },
];

function RankingsContent() {
  const [selectedCategory, setSelectedCategory] = useState('top_rated');
  const [animeList, setAnimeList] = useState<AnimeCardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch(`/api/anime/rankings?category=${selectedCategory}`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          setAnimeList(data.items || []);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load rankings:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCategory]);

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
          GLOBAL ANIME RANKINGS
        </h1>
        <p style={{ fontSize: '13px', color: '#A1A1AA', marginTop: '4px' }}>
          Explore canonical rankings by community ratings, popularity, and member engagement.
        </p>
      </div>

      {/* Category Tabs */}
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
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            type="button"
            onClick={() => setSelectedCategory(cat.value)}
            style={{
              background: selectedCategory === cat.value ? '#6366F1' : '#202024',
              color: selectedCategory === cat.value ? '#FFFFFF' : '#A1A1AA',
              border: '1px solid',
              borderColor: selectedCategory === cat.value ? '#6366F1' : '#2A2A2E',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Anime Grid */}
      {isLoading ? (
        <div style={{ padding: '60px 20px', textAlign: 'center', color: '#71717A' }}>Loading Rankings...</div>
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
          No ranking records found.
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

export default function RankingsPage() {
  return (
    <Suspense fallback={<div style={{ padding: '60px 20px', textAlign: 'center', color: '#71717A' }}>Loading...</div>}>
      <RankingsContent />
    </Suspense>
  );
}
