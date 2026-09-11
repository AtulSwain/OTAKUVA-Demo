'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import styles from './WhereToWatch.module.css';

interface WhereToWatchProps {
  /** Verified availability for this anime (StreamingAvailability / external links). */
  streamingPlatforms?: Array<{
    name: string;
    accessType?: string | null;
    url: string;
  }>;
}

/**
 * Lists only availability recorded for this anime. It used to list
 * Crunchyroll, Netflix, Prime Video and Hulu for every title, which told
 * people a show was streaming somewhere it may never have been.
 */
export const WhereToWatch: React.FC<WhereToWatchProps> = ({ streamingPlatforms = [] }) => {
  return (
    <section className={styles.section} aria-label="Where to Watch">
      <div className={styles.sectionHead}>
        <h2 className={styles.title}>Where to Watch</h2>
        {streamingPlatforms.length > 0 && (
          <span className={styles.subtitle}>Availability can vary by region</span>
        )}
      </div>
      {streamingPlatforms.length > 0 ? (
        <div className={styles.platformsGrid}>
          {streamingPlatforms.map((p) => (
            <a
              key={`${p.name}-${p.url}`}
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.platformCard}
              aria-label={`Watch on ${p.name} (opens in a new tab)`}
            >
              <div className={styles.platformName}>
                <span>{p.name}</span>
                <ExternalLink size={12} className={styles.externalIcon} aria-hidden="true" />
              </div>
              {p.accessType && <span className={styles.accessType}>{p.accessType}</span>}
            </a>
          ))}
        </div>
      ) : (
        <p className={styles.subtitle}>No verified streaming information for this title yet.</p>
      )}
    </section>
  );
};
