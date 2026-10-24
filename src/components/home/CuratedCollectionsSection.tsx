'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Layers, ArrowRight } from 'lucide-react';
import styles from './CuratedCollectionsSection.module.css';

// Data comes from src/lib/collections.ts (rules over the catalog). This used
// to hold a hardcoded list with typed-in counts, stock Unsplash covers and an
// "OTAKUVA Editorial" curator credit.
import type { CollectionSummary } from '../../lib/collections';

export const CuratedCollectionsSection: React.FC<{ collections: CollectionSummary[] }> = ({ collections }) => {
  return (
    <section className={styles.container} aria-label="Collections">
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
        {collections.map((col) => (
          <Link
            key={col.slug}
            href={`/collections/${col.slug}`}
            className={styles.collectionCard}
          >
            <div className={styles.artBanner}>
              {col.coverUrl && (
                <Image src={col.coverUrl} alt="" fill className={styles.artImage} unoptimized />
              )}
              <div className={styles.artOverlay} />
            </div>

            <div className={styles.cardBody}>
              <h3 className={styles.cardTitle}>{col.title}</h3>
              <p className={styles.cardDescription}>{col.description}</p>
              <div className={styles.cardFooter}>
                <span className={styles.countBadge}>{col.count.toLocaleString('en-US')} {col.count === 1 ? 'title' : 'titles'}</span>
                <span>{col.rule}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};
