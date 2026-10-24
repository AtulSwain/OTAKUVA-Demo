'use client';

import React from 'react';
import Link from 'next/link';
import { Compass } from 'lucide-react';
import styles from './DiscoverByMoodSection.module.css';

const MOODS = [
  { label: 'Dark & Psychological', query: 'Psychological' },
  { label: 'Feel Good', query: 'Slice of Life' },
  { label: 'Epic & High Stakes', query: 'Action' },
  { label: 'Mystery & Thriller', query: 'Mystery' },
  { label: 'Romance & Heartstrings', query: 'Romance' },
  { label: 'Mind-Bending Sci-Fi', query: 'Sci-Fi' },
  { label: 'Emotional & Tearjerkers', query: 'Drama' },
  { label: 'Grand Adventure', query: 'Adventure' },
];

export const DiscoverByMoodSection: React.FC = () => {
  return (
    <section className={styles.container} aria-label="Discover Anime by Mood">
      <div className={styles.titleRow}>
        <Compass size={18} style={{ color: 'var(--accent-primary-hover)' }} />
        <h2 className={styles.title}>Discover by Mood</h2>
      </div>

      <div className={styles.moodGrid}>
        {MOODS.map((mood) => (
          <Link
            key={mood.label}
            href={`/anime?genre=${encodeURIComponent(mood.query)}`}
            className={styles.moodChip}
          >
            <span>{mood.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
};
