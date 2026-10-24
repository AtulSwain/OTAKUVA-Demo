'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AnimeImage } from '../anime/AnimeImage';
import styles from './EditorsPickFeature.module.css';

interface EditorsPickProps {
  anime?: {
    id: string;
    slug: string;
    title: string;
    synopsis?: string;
    bannerImage?: string | null;
    posterImage?: string | null;
    genres?: string[];
    editorialQuote?: string;
    editorialTags?: string[];
  } | null;
  /** Line above the title; defaults to the score-based "Spotlight" wording. */
  kicker?: string;
  /** Optional second action, e.g. the whole list this pick comes from. */
  more?: { href: string; label: string };
}

export const EditorsPickFeature: React.FC<EditorsPickProps> = ({ anime, kicker, more }) => {
  if (!anime) return null;

  const displayAnime = anime;
  const imageSrc = displayAnime.bannerImage || displayAnime.posterImage;
  const tags = displayAnime.editorialTags || displayAnime.genres || [];

  return (
    <section className={styles.section} aria-label="Spotlight">
      <div className={styles.featureCard}>
        <div className={styles.artWrapper}>
          <AnimeImage
            src={imageSrc}
            alt={displayAnime.title}
            fill
            sizes="(max-width: 900px) 100vw, 60vw"
            className={styles.artImage}
          />
          <div className={styles.artOverlay} />
        </div>

        <div className={styles.copyArea}>
          <p className={styles.kicker}>{kicker ?? 'Spotlight · one of the highest-rated anime'}</p>
          <h3 className={styles.title}>{displayAnime.title}</h3>
          <p className={styles.synopsis}>
            {displayAnime.editorialQuote || displayAnime.synopsis}
          </p>

          <div className={styles.tagsRow}>
            {tags.map((tag) => (
              <span key={tag} className={styles.tag}>
                {tag}
              </span>
            ))}
          </div>

          <div className={styles.actionsRow}>
            <Link href={`/anime/${displayAnime.slug || displayAnime.id}`} className={styles.btnPrimary}>
              <span>Explore Anime</span>
              <ArrowRight size={14} />
            </Link>
            {more && (
              <Link href={more.href} className={styles.btnSecondary}>
                {more.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
