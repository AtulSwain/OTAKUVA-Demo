'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Layers, Bookmark, Share2, Star, ArrowLeft } from 'lucide-react';
import { CURATED_COLLECTIONS } from '../../../components/home/CuratedCollectionsSection';
import { AnimePoster } from '../../../components/ui/AnimePoster';
import { sanitizePublicEntityName } from '../../../lib/normalizers';
import { FIXTURE_ANIMES } from '../../../fixtures/anime.fixture';
import styles from '../collections.module.css';

export default function CollectionDetailPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const collection =
    CURATED_COLLECTIONS.find((c) => c.slug === slug) || CURATED_COLLECTIONS[0];

  const [animes, setAnimes] = useState<any[]>(FIXTURE_ANIMES.slice(0, 10));
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    async function loadCollectionAnime() {
      try {
        const res = await fetch(`/api/anime?limit=15&sortBy=score`);
        if (res.ok) {
          const data = await res.json();
          if (data.animes && data.animes.length > 0) {
            setAnimes(data.animes);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadCollectionAnime();
  }, [slug]);

  return (
    <div className={styles.container}>
      <Link href="/collections" className={styles.detailMeta} style={{ textDecoration: 'none' }}>
        <ArrowLeft size={14} />
        <span>Back to All Collections</span>
      </Link>

      {/* Collection Hero */}
      <div className={styles.detailHero}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={16} style={{ color: 'var(--accent-primary-hover)' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-primary-hover)' }}>
            Curated Editorial Anthology
          </span>
        </div>

        <h1 className={styles.detailTitle}>{collection.title}</h1>
        <p className={styles.subtitle}>{collection.description}</p>

        <div className={styles.detailMeta}>
          <span>Curated by <strong>{collection.curator}</strong></span>
          <span>·</span>
          <span>{animes.length} Selected Works</span>
        </div>

        <div className={styles.actionsRow}>
          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => setIsSaved((p) => !p)}
          >
            <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} />
            <span>{isSaved ? 'Saved to Library' : 'Save Collection'}</span>
          </button>

          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
              }
            }}
          >
            <Share2 size={14} />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Ranked List */}
      <div className={styles.rankedList}>
        {animes.map((anime, idx) => {
          const cleanTitle = sanitizePublicEntityName(anime.canonicalTitle || anime.title);
          const rankStr = String(idx + 1).padStart(2, '0');
          const animeYear = anime.year || 2024;
          const animeScore = anime.score ? anime.score.toFixed(2) : '9.0';

          return (
            <Link
              key={anime.id}
              href={`/anime/${anime.slug || anime.id}`}
              className={styles.rankedRow}
            >
              <span className={styles.rankNumber}>{rankStr}</span>

              <AnimePoster
                src={anime.posterUrl || anime.posterImage}
                alt={cleanTitle}
                width={40}
                height={56}
              />

              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cleanTitle}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {animeYear} · {anime.type || 'TV'} · {typeof anime.studios?.[0] === 'string' ? anime.studios[0] : (anime.studios?.[0] as any)?.name || 'Studio'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 600, color: 'var(--accent-score)' }}>
                <Star size={12} fill="currentColor" />
                <span>{animeScore}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
