'use client';

import React from 'react';
import styles from './WhereToWatch.module.css';

interface WhereToWatchProps {
  animeTitle?: string;
  streamingPlatforms?: Array<{
    name: string;
    accessType: string;
    url?: string;
  }>;
}

export const WhereToWatch: React.FC<WhereToWatchProps> = ({
  animeTitle = 'this anime',
  streamingPlatforms,
}) => {
  const platforms = streamingPlatforms && streamingPlatforms.length > 0
    ? streamingPlatforms
    : [
        { name: 'Crunchyroll', accessType: 'Subscription / Simulcast', url: 'https://www.crunchyroll.com' },
        { name: 'Netflix', accessType: 'Subscription', url: 'https://www.netflix.com' },
        { name: 'Prime Video', accessType: 'Availability varies by region', url: 'https://www.primevideo.com' },
        { name: 'Hulu', accessType: 'Subscription (US)', url: 'https://www.hulu.com' },
      ];

  return (
    <section className={styles.section} aria-label="Where to Watch">
      <div className={styles.sectionHead}>
        <h2 className={styles.title}>Where to Watch</h2>
        <span className={styles.subtitle}>Availability can vary by region</span>
      </div>
      <div className={styles.platformsGrid}>
        {platforms.map((p) => (
          <a
            key={p.name}
            href={p.url || `https://www.google.com/search?q=${encodeURIComponent(`${animeTitle} watch on ${p.name}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.platformCard}
            aria-label={`Watch on ${p.name} (Opens in new tab)`}
          >
            <div className={styles.platformName}>
              <span>{p.name}</span>
              <span className={styles.externalIcon}>↗</span>
            </div>
            <span className={styles.accessType}>{p.accessType}</span>
          </a>
        ))}
      </div>
    </section>
  );
};
