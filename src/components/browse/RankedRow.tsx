import { CommunityScoreBadge } from '../rating/CommunityScoreBadge';
import React from 'react';
import Link from 'next/link';
import { AnimeImage } from '../anime/AnimeImage';
import type { BrowseItem } from '../../lib/browse';
import styles from './RankedRow.module.css';

/** One row of a Top 10 list: big outlined number (or ceremony year) + a card. */
export const RankedRow: React.FC<{ item: BrowseItem }> = ({ item }) => {
  const isYear = /^\d{4}$/.test(item.label);
  const meta = [item.year, item.format, item.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ');
  return (
    <li className={styles.row}>
      <span
        className={`${styles.label} ${isYear ? styles.labelYear : ''} ${item.label.length === 3 ? styles.labelWide : ''}`}
        aria-hidden={isYear ? undefined : 'true'}
      >
        {item.label}
      </span>
      <Link href={`/anime/${item.slug}`} className={styles.card}>
        <span className={styles.poster}>
          <AnimeImage src={item.posterUrl} alt="" fill sizes="96px" />
        </span>
        <span className={styles.body}>
          {item.caption && <span className={styles.caption}>{item.caption}</span>}
          <strong className={styles.title}>{item.title}</strong>
          <span className={styles.meta}>{meta}</span>
          <span className={styles.stats}>
            {/* Members' OTAKUVA score + retention (not the provider score). */}
            <CommunityScoreBadge animeId={item.id} />
            <span>{item.status}</span>
          </span>
          {(item.note || item.synopsis) && <span className={styles.synopsis}>{item.note || item.synopsis}</span>}
        </span>
      </Link>
    </li>
  );
};
