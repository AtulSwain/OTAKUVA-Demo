'use client';

import React from 'react';
import Link from 'next/link';
import styles from './UserCollectionsCard.module.css';

interface CollectionItem {
  name: string;
  slug: string;
  savesCount: number;
}

interface UserCollectionsCardProps {
  collections?: CollectionItem[];
}

export const UserCollectionsCard: React.FC<UserCollectionsCardProps> = ({ collections }) => {
  const items: CollectionItem[] = collections && collections.length > 0
    ? collections
    : [
        { name: 'Dark Anime & Psychological Masterpieces', slug: 'dark-anime', savesCount: 842 },
        { name: 'My All-Time S-Tier Favorites', slug: 's-tier-favorites', savesCount: 514 },
        { name: 'Anime I Need to Finish Before I Die', slug: 'must-finish-anime', savesCount: 129 },
      ];

  return (
    <div className={styles.card} aria-label="Public User Collections">
      <h3 className={styles.heading}>Users&apos; Collections</h3>
      {items.map((col) => (
        <Link key={col.slug} href={`/collections/${col.slug}`} className={styles.row}>
          <span className={styles.collectionName}>{col.name}</span>
          <span className={styles.savesCount}>{col.savesCount.toLocaleString()} saves</span>
        </Link>
      ))}
    </div>
  );
};
