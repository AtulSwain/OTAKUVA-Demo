'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Sparkles, Layers } from 'lucide-react';
import { AnimeCard } from '../../../components/ui/AnimeCard';
import { AnimeGrid } from '../../../components/ui/AnimeGrid';
import styles from '../../upcoming/page.module.css';

export default function GenreDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const [genre, setGenre] = useState<any>(null);
  const [animes, setAnimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('score');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/genres/${slug}?sortBy=${sortBy}`);
        if (res.ok) {
          const data = await res.json();
          setGenre(data.genre);
          setAnimes(data.animes || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    if (slug) load();
  }, [slug, sortBy]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ color: '#8B8D98', padding: '60px 0', textAlign: 'center' }}>Loading genre catalog...</div>
      </div>
    );
  }

  if (!genre) {
    return (
      <div className={styles.container}>
        <div style={{ color: '#8B8D98', padding: '60px 0', textAlign: 'center' }}>Genre not found.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '8px' }}>
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              backgroundColor: '#181A21',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <Layers size={24} color="#5B5FEF" />
          </div>
          <div>
            <h1 className={styles.title}>{genre.name} Anime</h1>
            <div style={{ fontSize: '0.875rem', color: '#8B8D98' }}>
              {genre.totalAnime} Titles in Canonical Database
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[
          { key: 'score', label: 'Highest Rated' },
          { key: 'popularity', label: 'Most Popular' },
          { key: 'year', label: 'Release Year' },
          { key: 'title', label: 'Title A-Z' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setSortBy(s.key)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              backgroundColor: sortBy === s.key ? '#5B5FEF' : '#14161C',
              color: sortBy === s.key ? '#fff' : '#8B8D98',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {animes.length === 0 ? (
        <div style={{ color: '#8B8D98', padding: '40px 0', textAlign: 'center' }}>No anime found for this genre.</div>
      ) : (
        <AnimeGrid>
          {animes.map((a) => (
            <AnimeCard key={a.id} anime={a} />
          ))}
        </AnimeGrid>
      )}
    </div>
  );
}
