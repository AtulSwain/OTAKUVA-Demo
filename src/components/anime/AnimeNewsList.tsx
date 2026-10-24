'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Newspaper } from 'lucide-react';
import styles from './AnimeNewsList.module.css';

/**
 * The shape `/api/anime/[id]/news` actually returns (NewsArticle rows). The
 * old component read `thumbnail` / `source` / `date`, which never existed on
 * these rows, so every story showed an empty image box (fixed 2026-10-24).
 * The legacy names are still accepted for any other caller.
 */
interface NewsItem {
  id?: string;
  slug?: string | null;
  title: string;
  summary?: string | null;
  imageUrl?: string | null;
  sourceName?: string | null;
  publishedAt?: string | null;
  category?: string | null;
  thumbnail?: string;
  source?: string;
  date?: string;
}

interface AnimeNewsListProps {
  news?: NewsItem[];
  onViewAll?: () => void;
}

/** An author avatar / tracking pixel is not article art. */
function articleImage(item: NewsItem): string | null {
  const url = item.imageUrl || item.thumbnail || null;
  if (!url || /gravatar\.com|\/avatar\//i.test(url)) return null;
  return url;
}

function when(item: NewsItem): string | null {
  const raw = item.publishedAt || item.date;
  if (!raw) return null;
  const d = new Date(raw);
  return isNaN(+d) ? raw : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const label = (c?: string | null) => (c ? c.charAt(0) + c.slice(1).toLowerCase().replace(/_/g, ' ') : null);

function NewsCard({ item }: { item: NewsItem }) {
  const [broken, setBroken] = useState(false);
  const img = broken ? null : articleImage(item);
  const meta = [item.sourceName || item.source, when(item)].filter(Boolean).join(' · ');
  return (
    <Link href={`/news/${item.slug || item.id}`} className={`${styles.card} ${img ? '' : styles.cardText}`}>
      {img ? (
        <span className={styles.art}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
          {label(item.category) && <span className={styles.category}>{label(item.category)}</span>}
        </span>
      ) : (
        <span className={styles.textTop}>
          <Newspaper size={16} aria-hidden="true" />
          {label(item.category) && <span className={styles.categoryPlain}>{label(item.category)}</span>}
        </span>
      )}
      <span className={styles.body}>
        <span className={styles.headline}>{item.title}</span>
        {!img && item.summary && <span className={styles.summary}>{item.summary}</span>}
        {meta && <span className={styles.meta}>{meta}</span>}
      </span>
    </Link>
  );
}

export const AnimeNewsList: React.FC<AnimeNewsListProps> = ({ news = [] }) => {
  // Real stories only. This used to fall back to three invented Attack on
  // Titan headlines (with stock photos) for any anime without news.
  const items = news.slice(0, 3);
  if (items.length === 0) return null;

  return (
    <section className={styles.section} aria-label="Latest News">
      <div className={styles.headerRow}>
        <h2 className={styles.headerTitle}>Latest News</h2>
        <Link href="/news" className={styles.viewAllLink}>
          All news <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </div>
      <div className={styles.grid}>
        {items.map((item, idx) => (
          <NewsCard key={item.id || idx} item={item} />
        ))}
      </div>
    </section>
  );
};
