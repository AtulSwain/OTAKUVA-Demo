'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Layers } from 'lucide-react';
import { CURATED_COLLECTIONS } from '../../components/home/CuratedCollectionsSection';
import styles from './collections.module.css';

export default function CollectionsPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Curated Editorial Collections</h1>
        <p className={styles.subtitle}>
          Thematic anthologies, auteur retrospectives, and essential anime discovery pathways compiled by OTAKUVA editorial.
        </p>
      </header>

      <div className={styles.collectionsGrid}>
        {CURATED_COLLECTIONS.map((col) => (
          <Link
            key={col.slug}
            href={`/collections/${col.slug}`}
            className={styles.card}
          >
            <div className={styles.bannerWrap}>
              <Image
                src={col.bannerUrl}
                alt={col.title}
                fill
                className={styles.bannerImg}
                unoptimized
              />
              <div className={styles.bannerOverlay} />
            </div>

            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>{col.title}</h2>
              <p className={styles.cardDesc}>{col.description}</p>
              <div className={styles.cardFooter}>
                <span className={styles.countTag}>{col.count} Titles</span>
                <span>{col.curator}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
