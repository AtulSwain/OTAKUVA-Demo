'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Layers, ArrowRight } from 'lucide-react';
import styles from './CuratedCollectionsSection.module.css';

export interface CollectionItem {
  slug: string;
  title: string;
  description: string;
  count: number;
  bannerUrl: string;
  curator: string;
}

export const CURATED_COLLECTIONS: CollectionItem[] = [
  {
    slug: 'best-psychological-anime',
    title: 'Best Psychological Anime',
    description: 'Masterworks of tension, moral ambiguity, and intellectual mind games.',
    count: 12,
    bannerUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=600&auto=format&fit=crop&q=80',
    curator: 'OTAKUVA Editorial',
  },
  {
    slug: 'essential-modern-masterpieces',
    title: 'Essential Modern Anime',
    description: 'The defining benchmark releases of modern cinematic storytelling.',
    count: 15,
    bannerUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=600&auto=format&fit=crop&q=80',
    curator: 'OTAKUVA Editorial',
  },
  {
    slug: 'anime-that-will-break-your-heart',
    title: 'Anime That Will Break Your Heart',
    description: 'Profound, emotional narratives that explore grief, love, and human vulnerability.',
    count: 8,
    bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80',
    curator: 'OTAKUVA Editorial',
  },
  {
    slug: 'start-here-anime-for-beginners',
    title: 'Start Here: For Beginners',
    description: 'Accessible, universally acclaimed entry points to Japanese animation.',
    count: 10,
    bannerUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=600&auto=format&fit=crop&q=80',
    curator: 'OTAKUVA Editorial',
  },
];

export const CuratedCollectionsSection: React.FC = () => {
  return (
    <section className={styles.container} aria-label="Curated Editorial Anime Collections">
      <div className={styles.headerRow}>
        <div className={styles.titleRow}>
          <Layers size={18} style={{ color: 'var(--accent-primary-hover)' }} />
          <h2 className={styles.title}>Curated Collections</h2>
        </div>
        <Link href="/collections" className={styles.viewAllLink}>
          <span>View All Collections</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className={styles.collectionsGrid}>
        {CURATED_COLLECTIONS.map((col) => (
          <Link
            key={col.slug}
            href={`/collections/${col.slug}`}
            className={styles.collectionCard}
          >
            <div className={styles.artBanner}>
              <Image
                src={col.bannerUrl}
                alt={col.title}
                fill
                className={styles.artImage}
                unoptimized
              />
              <div className={styles.artOverlay} />
            </div>

            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>{col.title}</h3>
              <p className={styles.cardDescription}>{col.description}</p>
              <div className={styles.cardFooter}>
                <span className={styles.countBadge}>{col.count} Titles</span>
                <span>Curated by {col.curator}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
