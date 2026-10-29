'use client';

import React, { useState, useEffect } from 'react';
import { CommunityScoreBadge } from '../../components/rating/CommunityScoreBadge';
import Link from 'next/link';
import { Trophy, TrendingUp, Flame, Plus, Check, Film, Tv, Sparkles, Calendar, Activity } from 'lucide-react';
import { Anime } from '../../types/anime';
import { useLibrary } from '../../context/LibraryContext';
import { AnimePoster } from '../../components/ui/AnimePoster';
import { getAnimeDisplayTitle } from '../../lib/animeTitleResolver';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './rankings.module.css';
import { PageHead } from '../../components/ui/PageHead';

type RankingFilter = 'retention' | 'all' | 'year' | 'season' | 'tv' | 'movies' | 'upcoming' | 'popular';

// "This year" / "this season" follow today's date — they were hardcoded to
// 2024 / Winter 2024.
const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const CURRENT_SEASON = (['Winter', 'Spring', 'Summer', 'Fall'] as const)[Math.floor(NOW.getMonth() / 3)];

export default function RankingsPage() {
  const { library, updateStatus } = useLibrary();
  // Retention leads (2026-10-25, owner): ranked by members' episode retention.
  const [rankingType, setRankingType] = useState<RankingFilter>('retention');
  const [animes, setAnimes] = useState<Anime[]>([]);
  // Retention tab only: titles without enough ratings for a badge, kept apart.
  const [provisional, setProvisional] = useState<Anime[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRankings = async () => {
      setIsLoading(true);
      setProvisional([]);
      try {
        if (rankingType === 'retention') {
          const res = await fetch('/api/rankings/retention?limit=100', { cache: 'no-store' });
          const data = res.ok ? await res.json() : { rated: [], provisional: [] };
          const toAnime = (i: any) => ({ ...i, canonicalTitle: i.title, posterImage: i.posterUrl }) as unknown as Anime;
          setAnimes((data.rated || []).map(toAnime));
          setProvisional((data.provisional || []).map(toAnime));
          return;
        }
        const params = new URLSearchParams();
        params.set('limit', '50');

        if (rankingType === 'popular' || rankingType === 'upcoming') {
          // Nothing unaired has a score yet, so upcoming ranks by popularity.
          params.set('sortBy', 'popularity');
        } else {
          params.set('sortBy', 'score');
        }

        if (rankingType === 'year') params.set('year', String(CURRENT_YEAR));
        if (rankingType === 'season') {
          params.set('season', CURRENT_SEASON);
          params.set('year', String(CURRENT_YEAR));
        }
        if (rankingType === 'tv') params.set('type', 'TV');
        if (rankingType === 'movies') params.set('type', 'Movie');
        if (rankingType === 'upcoming') params.set('status', 'Not Yet Aired');

        const res = await fetch(`/api/anime?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          // Always replace the list: an empty result must not leave the
          // previous tab's rows on screen.
          setAnimes(data.animes || data.data || []);
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
    { key: 'retention', label: 'Retention', icon: Activity },
    { key: 'all', label: 'All-Time Top Rated', icon: Trophy },
    { key: 'year', label: `This Year (${CURRENT_YEAR})`, icon: Calendar },
    { key: 'season', label: `This Season (${CURRENT_SEASON})`, icon: Flame },
    { key: 'popular', label: 'Most Popular', icon: TrendingUp },
    { key: 'tv', label: 'TV Series', icon: Tv },
    { key: 'movies', label: 'Feature Films', icon: Film },
    { key: 'upcoming', label: 'Upcoming', icon: Sparkles },
  ];

  const renderRow = (anime: Anime, rank: number | null) => {
            const rawTitle = getAnimeDisplayTitle(anime);
            const cleanTitle = sanitizePublicEntityName(rawTitle);
            const rankStr = rank === null ? '—' : String(rank).padStart(2, '0');
            const animeId = anime.slug || anime.id;
            const inLibrary = Boolean(library[animeId]);
            // Missing stays missing: no placeholder year or type.
            const animeYear = anime.year || (anime as any).startYear || null;
            const metaParts = [animeYear ? String(animeYear) : null, anime.type || null].filter(Boolean) as string[];
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
                    {[...metaParts, studioName].filter(Boolean).map((part, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span>·</span>}
                        <span>{part}</span>
                      </React.Fragment>
                    ))}
                  </div>
                  {/* Members' retention + badge (not the provider score). */}
                  <span className={styles.scoreMobile}>
                    <CommunityScoreBadge animeId={anime.id} />
                  </span>
                </div>

                {/* Members' retention + badge (blank until someone rates an episode) */}
                <div className={`${styles.scoreCol} ${styles.hideMobile}`}>
                  <CommunityScoreBadge animeId={anime.id} />
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
  };

  return (
    <div className={styles.rankingsPage}>
      {/* Header */}
      <div className={styles.header}>
        <PageHead kicker="Leaderboards" title="Rankings">
          {rankingType === 'retention'
            ? 'Ranked by retention: the average of each anime’s episode scores, as OTAKUVA members rated them.'
            : 'Ranked by each title’s provider score (MyAnimeList / AniList); the score shown is members’ retention.'}
        </PageHead>
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
        <span aria-hidden="true" />
        <span>Anime</span>
        <span className={styles.hideMobile}>Score</span>
        <span style={{ textAlign: 'right' }}>Library</span>
      </div>

      {/* Rankings List */}
      <div className={styles.listContainer}>
        {isLoading ? (
          <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>
            Loading rankings…
          </div>
        ) : animes.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>
            {rankingType === 'retention'
              ? 'No anime has enough episode ratings for a badge yet.'
              : 'No anime records found for this ranking criteria.'}
          </div>
        ) : (
          animes.map((anime, idx) => renderRow(anime, idx + 1))
        )}
      </div>

      {/* Retention: titles still Provisional — never ranked with the rest. */}
      {rankingType === 'retention' && !isLoading && provisional.length > 0 && (
        <>
          <div className={styles.provisionalHead}>
            <h2>Provisional</h2>
            <p>Not enough ratings yet for a badge (3 members on 3 episodes). Ordered by their score so far.</p>
          </div>
          <div className={styles.listContainer}>{provisional.map((anime) => renderRow(anime, null))}</div>
        </>
      )}
    </div>
  );
}
