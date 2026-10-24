import React from 'react';
import Link from 'next/link';
import { AnimeImage } from '../anime/AnimeImage';
import styles from './PosterCard.module.css';

export interface PosterCardProps {
  href: string;
  src?: string | null;
  alt: string;
  title: string;
  meta?: React.ReactNode;
  sizes?: string;
  children?: React.ReactNode;
}

export const PosterCard: React.FC<PosterCardProps> = ({ href, src, alt, title, meta, sizes = '180px', children }) => (
  <Link href={href} className={styles.card}>
    <div className={styles.artwork}>
      <AnimeImage src={src} alt={alt} fill sizes={sizes} />
    </div>
    <strong className={styles.title}>{title}</strong>
    {meta && <span className={styles.meta}>{meta}</span>}
    {children}
  </Link>
);
