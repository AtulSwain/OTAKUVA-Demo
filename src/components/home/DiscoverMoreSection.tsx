'use client';

import React from 'react';
import Link from 'next/link';
import styles from './DiscoverMoreSection.module.css';

interface CategoryItem {
  title: string;
  subtitle: string;
  href: string;
}

export const DiscoverMoreSection: React.FC = () => {
  const categories: CategoryItem[] = [
    { title: 'Top Ranked', subtitle: 'Leaderboards & scores', href: '/rankings' },
    { title: 'Seasonal Anime', subtitle: 'This season’s broadcasts', href: '/seasonal' },
    { title: 'Airing Schedule', subtitle: 'Broadcast calendar', href: '/airing' },
    { title: 'Animation Studios', subtitle: 'Studios & their works', href: '/studios' },
    { title: 'Artists', subtitle: 'Directors, writers & voice cast', href: '/artists' },
    { title: 'Community Hub', subtitle: 'Discussions & reviews', href: '/community' },
  ];

  return (
    <section className={styles.section} aria-label="Discover More OTAKUVA">
      <div className={styles.sectionHead}>
        <div>
          <p className={styles.kicker}>Explore further</p>
          <h2 className={styles.title}>Discover More</h2>
        </div>
        <span className={styles.subtitle}>Explore the full database</span>
      </div>

      <div className={styles.grid}>
        {categories.map((cat) => (
          <Link key={cat.title} href={cat.href} className={styles.categoryCard}>
            <strong className={styles.categoryName}>{cat.title}</strong>
            <span className={styles.categoryCount}>{cat.subtitle}</span>
          </Link>
        ))}
      </div>
    </section>
  );
};
