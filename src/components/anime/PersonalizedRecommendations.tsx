'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { CommunityScoreBadge } from '../rating/CommunityScoreBadge';
import { isWideBanner } from '../../lib/media/heroArt';
import { AnimeImage } from './AnimeImage';
import styles from './PersonalizedRecommendations.module.css';

export interface RecommendationItem {
  id: string;
  slug: string;
  title: string;
  posterImage?: string | null;
  score?: number | null;
  genre?: string | null;
  reason?: string | null;
  bannerUrl?: string | null;
  type?: string | null;
  year?: number | null;
  genres?: string[];
  studios?: string[];
  /** The engine's own reasons for the pick — shown as-is, never written here. */
  matchReasons?: string[];
}

interface PersonalizedRecommendationsProps {
  recommendations: RecommendationItem[];
  /** True when the engine had the viewer's library/taste to work from. */
  personalized?: boolean;
}

const FORMAT: Record<string, string> = { TV: 'TV', TV_SHORT: 'TV Short', MOVIE: 'Movie', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'Special' };
const fmt = (t?: string | null) => (t ? FORMAT[t.toUpperCase()] ?? t : null);
const metaLine = (a: RecommendationItem) => [fmt(a.type), a.year, a.studios?.[0]].filter(Boolean).join(' · ');

/** Reasons to show: the engine's list, else its one-line explanation. Deduped. */
function reasonsOf(a: RecommendationItem, max: number) {
  const list = [...(a.matchReasons ?? []), ...(a.reason ? [a.reason] : [])].map((r) => r.trim()).filter(Boolean);
  return Array.from(new Set(list)).slice(0, max);
}

/**
 * "Recommended for You" / "More Like This" (v2, 2026-10-22 — owner: "too
 * outdated, show the anime and the info, make it different"). The engine's
 * top pick is a spotlight — real banner when there is one (else the poster
 * on a blurred copy of itself; never a stretched poster), format/year/studio,
 * genres and the engine's own "why" — then the rest as a rail of poster cards
 * with members' score and a one-line reason. Renders only what the engine
 * returned; nothing when it returned nothing.
 */
export const PersonalizedRecommendations: React.FC<PersonalizedRecommendationsProps> = ({
  recommendations,
  personalized = false,
}) => {
  const railRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const measure = () => {
    const el = railRef.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [recommendations]);

  if (recommendations.length === 0) return null;
  const [top, ...rest] = recommendations;
  const banner = isWideBanner(top.bannerUrl) ? top.bannerUrl : null;
  const topReasons = reasonsOf(top, 3);
  const scrollBy = (dir: 1 | -1) => {
    const el = railRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <section className={styles.section} aria-label="Recommendations">
      <div className={styles.sectionHead}>
        <div>
          <p className={styles.kicker}>
            <Sparkles size={12} aria-hidden="true" /> {personalized ? 'Picked for you' : 'If you like this'}
          </p>
          <h2 className={styles.title}>{personalized ? 'Recommended for You' : 'More Like This'}</h2>
          <span className={styles.subtitle}>
            {personalized ? 'Based on this title and your library' : 'Based on this title'}
          </span>
        </div>
        {rest.length > 0 && !(edges.start && edges.end) && (
          <span className={styles.arrows}>
            <button type="button" className={styles.arrow} onClick={() => scrollBy(-1)} disabled={edges.start} aria-label="Scroll back">
              <ChevronLeft size={16} />
            </button>
            <button type="button" className={styles.arrow} onClick={() => scrollBy(1)} disabled={edges.end} aria-label="Scroll forward">
              <ChevronRight size={16} />
            </button>
          </span>
        )}
      </div>

      {/* Top pick */}
      <Link href={`/anime/${top.slug}`} className={styles.spot}>
        <span className={styles.spotArt} aria-hidden="true">
          {banner ? (
            <AnimeImage src={banner} alt="" fill sizes="(max-width: 900px) 100vw, 900px" className={styles.spotBanner} />
          ) : (
            <AnimeImage src={top.posterImage} alt="" fill sizes="600px" className={styles.spotBlur} />
          )}
        </span>
        <span className={styles.spotShade} aria-hidden="true" />
        <span className={styles.spotPoster}>
          <AnimeImage src={top.posterImage} alt={top.title} fill sizes="140px" />
          <CommunityScoreBadge animeId={top.id} variant="overlay" />
        </span>
        <span className={styles.spotBody}>
          <span className={styles.spotHeadText}>
            <span className={styles.spotTag}>Top pick</span>
            <strong className={styles.spotTitle}>{top.title}</strong>
            {metaLine(top) && <span className={styles.spotMeta}>{metaLine(top)}</span>}
          </span>
          <span className={styles.spotFoot}>
          {(top.genres?.length ?? 0) > 0 && (
            <span className={styles.chips}>
              {top.genres!.slice(0, 4).map((g) => (
                <span key={g} className={styles.chip}>{g}</span>
              ))}
            </span>
          )}
          {topReasons.length > 0 && (
            <span className={styles.why}>
              <span className={styles.whyLabel}>Why this</span>
              {topReasons.map((r) => (
                <span key={r} className={styles.whyItem}>{r}</span>
              ))}
            </span>
          )}
          <span className={styles.spotCta}>
            View anime <ArrowRight size={14} aria-hidden="true" />
          </span>
          </span>
        </span>
      </Link>

      {/* The rest */}
      {rest.length > 0 && (
        <div className={styles.rail} ref={railRef} onScroll={measure}>
          {rest.map((anime, i) => {
            const why = reasonsOf(anime, 1)[0];
            return (
              <Link key={anime.id} href={`/anime/${anime.slug}`} className={styles.card}>
                <span className={styles.thumb}>
                  <AnimeImage src={anime.posterImage} alt={anime.title} fill sizes="(max-width: 600px) 45vw, 190px" />
                  {/* Members' OTAKUVA score + retention (not the provider score). */}
                  <CommunityScoreBadge animeId={anime.id} variant="overlay" />
                  <span className={styles.rank}>{String(i + 2).padStart(2, '0')}</span>
                  {why && (
                    <span className={styles.hoverWhy}>
                      <Sparkles size={11} aria-hidden="true" /> {why}
                    </span>
                  )}
                </span>
                <span className={styles.cardBody}>
                  <strong className={styles.cardTitle}>{anime.title}</strong>
                  {metaLine(anime) && <span className={styles.cardMeta}>{metaLine(anime)}</span>}
                  {(anime.genres?.length ?? 0) > 0 ? (
                    <span className={styles.cardGenres}>{anime.genres!.slice(0, 2).join(' · ')}</span>
                  ) : (
                    anime.genre && <span className={styles.cardGenres}>{anime.genre}</span>
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
};
