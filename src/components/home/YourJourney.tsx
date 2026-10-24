'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import styles from './YourJourney.module.css';

interface Stats { totalAnime: number; episodesWatched: number; estimatedHours: string; }

export const YourJourney: React.FC = () => {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/stats').then((response) => response.ok ? response.json() : null).then(setStats).catch(() => setStats(null));
  }, []);

  const values = [
    ['Titles watched', stats?.totalAnime ?? '—'],
    ['Episodes', stats?.episodesWatched ?? '—'],
    ['Days of anime', stats ? `${(parseFloat(stats.estimatedHours) / 24).toFixed(1)}` : '—'],
    ['Reviews', '—'],
  ];

  return (
    <section className={styles.section} aria-label="Your Journey">
      <div className={styles.sectionHead}><h2>Your Journey</h2><Link href="/stats">View statistics →</Link></div>
      <div className={styles.journey}>
        <div className={styles.stats}>
          {values.map(([label, value]) => <div key={label} className={styles.stat}><strong>{value}</strong><span>{label}</span></div>)}
        </div>
        <div className={styles.genres}>
          <p>Top genres</p>
          <strong>Build your library to see your patterns.</strong>
          <span>Your watch history will shape this view over time.</span>
        </div>
      </div>
    </section>
  );
};
