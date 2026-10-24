import React from 'react';
import Link from 'next/link';
import { Layers } from 'lucide-react';
import { AnimeImage } from '../anime/AnimeImage';
import { UserAvatar } from '../ui/UserAvatar';
import styles from './Collections.module.css';

export interface CollectionCardData {
  id: string;
  name: string;
  description?: string | null;
  shareToken: string;
  bannerUrl: string | null;
  covers: string[];
  count: number;
  owner: { username: string; avatarUrl: string | null };
}

/**
 * A member's public collection: its banner (or, without one, a strip of its
 * posters), name, owner and size. Opens the collection's public page.
 */
export function CollectionCard({ c }: { c: CollectionCardData }) {
  return (
    <Link href={`/l/${c.shareToken}`} className={styles.card}>
      <span className={styles.cardArt}>
        {c.bannerUrl ? (
          <AnimeImage src={c.bannerUrl} alt="" fill sizes="(max-width: 640px) 85vw, 420px" className={styles.cardBanner} />
        ) : (
          <span className={styles.cardCollage} aria-hidden="true">
            {c.covers.slice(0, 4).map((src, i) => (
              <span key={i} className={styles.cardCollageItem}>
                <AnimeImage src={src} alt="" fill sizes="120px" />
              </span>
            ))}
          </span>
        )}
        <span className={styles.cardShade} aria-hidden="true" />
        <span className={styles.cardCount}>
          <Layers size={12} aria-hidden="true" /> {c.count}
        </span>
      </span>
      <span className={styles.cardBody}>
        <strong className={styles.cardName}>{c.name}</strong>
        <span className={styles.cardOwner}>
          <UserAvatar username={c.owner.username} avatarUrl={c.owner.avatarUrl} size={20} />
          @{c.owner.username}
        </span>
      </span>
    </Link>
  );
}
