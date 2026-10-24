'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AnimeImage } from '../anime/AnimeImage';
import { InterestButton } from '../shared/InterestButton';
import { VibeScore } from '../shared/VibeScore';
import { useAuth } from '../../context/AuthContext';
import styles from './TalkOfTheAnimeWorld.module.css';

interface TalkAnime {
  id: string;
  slug: string;
  title: string;
  synopsis?: string;
  bannerImage?: string | null;
  posterImage?: string | null;
  genres?: string[];
  editorialQuote?: string;
  editorialTags?: string[];
  otakuvaScore?: number | null;
}

interface TalkOfTheAnimeWorldProps {
  anime?: TalkAnime | null;
}

export const TalkOfTheAnimeWorld: React.FC<TalkOfTheAnimeWorldProps> = ({ anime }) => {
  const { user, openAuthModal } = useAuth();
  const [interested, setInterested] = useState(false);
  const [interestCount, setInterestCount] = useState(0);

  useEffect(() => {
    if (!anime) return;
    fetch(`/api/anime/${anime.id}/interest`).then((response) => response.ok ? response.json() : null).then((data) => { if (data) { setInterested(Boolean(data.active)); setInterestCount(data.count || 0); } }).catch(() => {});
  }, [anime?.id]);

  if (!anime) return null;

  const tags = anime.editorialTags || anime.genres || [];

  const score = typeof anime.otakuvaScore === 'number' ? anime.otakuvaScore.toFixed(1) : '—';
  const toggleInterest = async () => {
    if (!user) { openAuthModal(); return; }
    const response = await fetch(`/api/anime/${anime.id}/interest`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !interested }) });
    if (!response.ok) return;
    const data = await response.json();
    setInterested(Boolean(data.active));
    setInterestCount(data.count || 0);
  };

  return (
    <section className={styles.section} aria-label="Talk of the Anime World">
      <div className={styles.feature}>
        <div className={styles.artWrapper}>
          <AnimeImage
            src={anime.bannerImage || anime.posterImage}
            alt={anime.title}
            fill
            sizes="(max-width: 900px) 100vw, 55vw"
            className={styles.artImage}
          />
        </div>

        <div className={styles.copyArea}>
          <p className={styles.kicker}>Talk of the Anime World</p>
          <h2 className={styles.title}>{anime.title}</h2>
          <p className={styles.synopsis}>{anime.editorialQuote || anime.synopsis}</p>

          <div className={styles.scoreRow}><VibeScore score={score} /></div>

          <div className={styles.tagsRow}>
            {tags.map((tag) => <span key={tag} className={styles.tag}>{tag}</span>)}
          </div>

          <div className={styles.actionsRow}>
            <Link href={`/anime/${anime.slug || anime.id}`} className={styles.exploreLink}>
              Explore Anime <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <InterestButton count={interestCount} active={interested} onToggle={toggleInterest} />
          </div>
        </div>
      </div>
    </section>
  );
};
