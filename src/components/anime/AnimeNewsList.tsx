'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight } from 'lucide-react';
import styles from './AnimeNewsList.module.css';

interface NewsItem {
  id?: string;
  title: string;
  url?: string;
  source?: string;
  date?: string;
  thumbnail?: string;
}

interface AnimeNewsListProps {
  news?: NewsItem[];
  onViewAll?: () => void;
}

const DEFAULT_NEWS: NewsItem[] = [
  {
    id: 'news-1',
    title: 'Attack on Titan New Exhibition Announced for 2025',
    source: 'Anime News Network',
    date: 'May 12, 2025',
    thumbnail: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80',
  },
  {
    id: 'news-2',
    title: 'Hiroyuki Sawano Concert Celebrating AoT 10th Anniversary',
    source: 'Oricon News',
    date: 'May 8, 2025',
    thumbnail: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80',
  },
  {
    id: 'news-3',
    title: 'MAPPA Releases Special Illustration for AoT Final Season',
    source: 'Anime Corner',
    date: 'May 5, 2025',
    thumbnail: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80',
  },
];

export const AnimeNewsList: React.FC<AnimeNewsListProps> = ({ news = [], onViewAll }) => {
  const items = news.length > 0 ? news.slice(0, 3) : DEFAULT_NEWS;

  return (
    <section className={styles.section} aria-label="Latest News">
      <div className={styles.headerRow}>
        <h3 className={styles.headerTitle}>Latest News</h3>
        <Link href="/news" className={styles.viewAllLink}>
          <span>View All</span>
          <ChevronRight size={12} />
        </Link>
      </div>

      <div className={styles.newsGrid}>
        {items.map((item, idx) => (
          <Link
            key={item.id || idx}
            href={`/news/${item.id || idx}`}
            className={styles.newsCard}
          >
            <div className={styles.newsThumbWrapper}>
              <Image
                src={item.thumbnail || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80'}
                alt={item.title}
                fill
                className={styles.newsThumb}
                unoptimized
              />
            </div>

            <span className={styles.newsHeadline}>{item.title}</span>
            <span className={styles.newsMeta}>{item.source || 'Industry Dispatch'} · {item.date || 'Recently'}</span>
          </Link>
        ))}
      </div>
    </section>
  );
};
