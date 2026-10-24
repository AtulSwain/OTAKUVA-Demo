import React from 'react';
import { FolderHeart } from 'lucide-react';
import styles from './lists.module.css';

/** Folder cover: a 2×2 collage of the list's first posters (empty tiles stay dark). */
export function ListCover({ covers, size = 'md' }: { covers: string[]; size?: 'md' | 'lg' }) {
  if (covers.length === 0) {
    return (
      <div className={`${styles.cover} ${styles.coverEmpty} ${size === 'lg' ? styles.coverLg : ''}`} aria-hidden="true">
        <FolderHeart size={size === 'lg' ? 44 : 32} />
      </div>
    );
  }
  const tiles = covers.length === 1 ? covers : [...covers, '', '', ''].slice(0, 4);
  return (
    <div className={`${styles.cover} ${covers.length === 1 ? styles.coverSingle : ''} ${size === 'lg' ? styles.coverLg : ''}`} aria-hidden="true">
      {tiles.map((src, i) =>
        src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} src={src} alt="" loading="lazy" />
        ) : (
          <span key={i} className={styles.coverBlank} />
        )
      )}
    </div>
  );
}
