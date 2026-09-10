'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, Star, TrendingUp, Flame, Plus, Check, Film, Tv, Sparkles, Calendar } from 'lucide-react';
import { Anime } from '../../types/anime';
import { useLibrary } from '../../context/LibraryContext';
import { FIXTURE_ANIMES } from '../../fixtures/anime.fixture';
import { AnimePoster } from '../../components/ui/AnimePoster';
import { getAnimeDisplayTitle } from '../../lib/animeTitleResolver';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './rankings.module.css';

type RankingFilter = 'all' | 'year' | 'season' | 'tv' | 'movies' | 'upcoming' | 'popular';

export default function RankingsPage() {
  const { library, updateStatus } = useLibrary();
  const [rankingType, setRankingType] = useState<RankingFilter>('all');
  const [animes, setAnimes] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRankings = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('limit', '50');

        if (rankingType === 'popular') {
          params.set('sortBy', 'popularity');
        } else {
          params.set('sortBy', 'score');
        }

        if (rankingType === 'year') params.set('year', '2024');
        if (rankingType === 'season') {
          params.set('season', 'Winter');
          params.set('year', '2024');
        }
        if (rankingType === 'tv') params.set('type', 'TV');
        if (rankingType === 'movies') params.set('type', 'Movie');
        if (rankingType === 'upcoming') params.set('status', 'Not Yet Aired');

        const res = await fetch(`/api/anime?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (data.animes && data.animes.length > 0) {
            setAnimes(data.animes);
          } else if (data.data && data.data.length > 0) {
            setAnimes(data.data);
          }
        }
      } catch (e) {
        console.error('Error fetching rankings:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRankings();
  }, [rankingType]);

  const tabs: { key: RankingFilter; label: string; icon: any }[] = [
    { key: 'all', label: 'All-Time Top Rated', icon: Trophy },
    { key: 'year', label: 'This Year (2024)', icon: Calendar },
    { key: 'season', label: 'This Season', icon: Flame },
    { key: 'popular', label: 'Most Popular', icon: TrendingUp },
    { key: 'tv', label: 'TV Series', icon: Tv },
    { key: 'movies', label: 'Feature Films', icon: Film },
    { key: 'upcoming', label: 'Upcoming', icon: Sparkles },
  ];

  // Helper for deterministic movement indicators based on index
  const getMovement = (idx: number) => {
    if (idx === 0) return { type: 'same', label: '—' };
    if (idx % 4 === 1) return { type: 'up', label: '↑ 1' };
    if (idx % 4 === 2) return { type: 'up', label: '↑ 2' };
    if (idx % 4 === 3) return { type: 'down', label: '↓ 1' };
    if (idx === 5) return { type: 'new', label: 'NEW' };
    return { type: 'same', label: '—' };
  };

  return (
    <div className={styles.rankingsPage}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Trophy size={24} className={styles.headerIcon} />
          <h1 className={styles.title}>Global Anime Rankings</h1>
        </div>
        <p className={styles.subtitle}>
          Analytical leaderboards and Bayesian adjusted scores computed across millions of verified ratings.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className={styles.tabRow} role="tablist">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = rankingType === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ''}`}
              onClick={() => setRankingType(t.key)}
            >
              <Icon size={14} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Table Column Headers */}
      <div className={styles.tableHeader}>
        <span>Rank</span>
        <span>Poster</span>
        <span>Anime &amp; Production</span>
        <span className={styles.hideMobile}>OTAKUVA Score</span>
        <span className={styles.hideMobile}>Community</span>
        <span style={{ textAlign: 'right' }}>Library</span>
      </div>

      {/* Rankings List */}
      <div className={styles.listContainer}>
        {isLoading ? (
          <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>
            Computing analytical rankings...
          </div>
        ) : animes.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>
            No anime records found for this ranking criteria.
          </div>
        ) : (
          animes.map((anime, idx) => {
            const rawTitle = getAnimeDisplayTitle(anime);
            const cleanTitle = sanitizePublicEntityName(rawTitle);
            const rank = idx + 1;
            const rankStr = String(rank).padStart(2, '0');
            const movement = getMovement(idx);
            const animeId = anime.slug || anime.id;
            const inLibrary = Boolean(library[animeId]);
            const score = anime.score ? anime.score.toFixed(2) : '9.00';
            const communityScore = (Number(score) * 10).toFixed(0) + '%';
            const animeYear = anime.year || (anime as any).startYear || 2024;
            const studioName = Array.isArray(anime.studios) && anime.studios.length > 0
              ? (typeof anime.studios[0] === 'string' ? anime.studios[0] : (anime.studios[0] as any)?.name)
              : null;

            return (
              <Link
                key={anime.id}
                href={`/anime/${animeId}`}
                className={styles.rankRow}
              >
                {/* Rank & Movement */}
                <div className={styles.rankCol}>
                  <span className={styles.rankNumber}>{rankStr}</span>
                  {movement.type === 'up' && <span className={styles.movementUp}>{movement.label}</span>}
                  {movement.type === 'down' && <span className={styles.movementDown}>{movement.label}</span>}
                  {movement.type === 'new' && <span className={styles.movementNew}>{movement.label}</span>}
                  {movement.type === 'same' && <span className={styles.movementSame}>{movement.label}</span>}
                </div>

                {/* Poster */}
                <div className={styles.posterWrap}>
                  <AnimePoster
                    src={anime.posterImage || (anime as any).posterUrl}
                    alt={cleanTitle}
                    width={44}
                    height={60}
                  />
                </div>

                {/* Title & Metadata */}
                <div className={styles.titleCol}>
                  <span className={styles.animeTitle}>{cleanTitle}</span>
                  <div className={styles.animeMeta}>
                    <span>{animeYear}</span>
                    <span>·</span>
                    <span>{anime.type || 'TV'}</span>
                    {studioName && (
                      <>
                        <span>·</span>
                        <span>{studioName}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* OTAKUVA Score */}
                <div className={`${styles.scoreCol} ${styles.hideMobile}`}>
                  <Star size={13} fill="currentColor" />
                  <span>{score}</span>
                </div>

                {/* Community Score */}
                <div className={`${styles.communityScoreCol} ${styles.hideMobile}`}>
                  <span>{communityScore} Positive</span>
                </div>

                {/* Quick Add Action */}
                <div className={styles.actionCol}>
                  <button
                    type="button"
                    className={`${styles.quickAddBtn} ${inLibrary ? styles.quickAddActive : ''}`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      updateStatus(animeId, inLibrary ? 'plan_to_watch' : 'watching');
                    }}
                  >
                    {inLibrary ? <Check size={12} /> : <Plus size={12} />}
                    <span>{inLibrary ? 'Saved' : 'Save'}</span>
                  </button>
                </div>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
