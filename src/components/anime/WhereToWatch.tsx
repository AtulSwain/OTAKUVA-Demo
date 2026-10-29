'use client';

import React, { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import styles from './WhereToWatch.module.css';

interface WhereToWatchProps {
  /** Verified availability for this anime (StreamingAvailability / external links). */
  streamingPlatforms?: Array<{
    name: string;
    accessType?: string | null;
    url: string;
    /** Official site icon + brand colour (AniList), when known. */
    iconUrl?: string | null;
    color?: string | null;
  }>;
}

/**
 * Logos supplied by the owner (2026-10-26), in public/brand/streaming/.
 * `fill`: the image is the whole tile (Prime Video's blue square);
 * otherwise it sits on `bg`. Every other platform uses AniList's official
 * icon (saved locally by scripts/sync_streaming_platforms.ts) on its brand
 * colour; with no icon, a plain letter tile. Netflix keeps AniList's icon —
 * the image provided was a watermarked stock preview.
 */
const LOCAL_LOGOS: Record<string, { src: string; fill?: boolean; bg?: string; tint?: string }> = {
  'amazon prime video': { src: '/brand/streaming/prime-video.png', fill: true, tint: '#0779FF' },
  'amazon prime': { src: '/brand/streaming/prime-video.png', fill: true, tint: '#0779FF' },
  'prime video': { src: '/brand/streaming/prime-video.png', fill: true, tint: '#0779FF' },
  crunchyroll: { src: '/brand/streaming/crunchyroll.png', bg: '#ffffff' },
};

function PlatformLogo({ name, iconUrl, color }: { name: string; iconUrl?: string | null; color?: string | null }) {
  const [broken, setBroken] = useState(false);
  const local = LOCAL_LOGOS[name.trim().toLowerCase()];
  if (local) {
    return (
      <span className={`${styles.logo} ${local.fill ? styles.logoFill : ''}`} style={{ ['--brand' as string]: local.bg || local.tint || color || '#3a3a40' }} aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={local.src} alt="" loading="lazy" />
      </span>
    );
  }
  if (!iconUrl || broken) {
    // No icon: a plain letter tile — never a stand-in logo (owner, 2026-10-26).
    return (
      <span className={`${styles.logo} ${styles.logoPlain}`} aria-hidden="true">
        <span className={styles.logoLetter}>{name.trim().slice(0, 1).toUpperCase()}</span>
      </span>
    );
  }
  return (
    <span className={styles.logo} style={{ ['--brand' as string]: color || '#3a3a40' }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={iconUrl} alt="" width={26} height={26} loading="lazy" onError={() => setBroken(true)} />
    </span>
  );
}

/**
 * Lists only availability recorded for this anime (never a default set of
 * services). Redesigned 2026-10-26 (owner): official logos + brand colours.
 */
export const WhereToWatch: React.FC<WhereToWatchProps> = ({ streamingPlatforms = [] }) => {
  return (
    <section className={styles.section} aria-label="Where to Watch">
      <div className={styles.sectionHead}>
        <h2 className={styles.title}>Where to Watch</h2>
        {streamingPlatforms.length > 0 && <span className={styles.count}>{streamingPlatforms.length}</span>}
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
              style={{ ['--brand' as string]: LOCAL_LOGOS[p.name.trim().toLowerCase()]?.tint || p.color || '#5a5a62' }}
              title="Availability can vary by region"
              aria-label={`Watch on ${p.name} (opens in a new tab)`}
            >
              <PlatformLogo name={p.name} iconUrl={p.iconUrl} color={p.color} />
              <span className={styles.platformText}>
                <span className={styles.platformName}>{p.name}</span>
                <span className={styles.watchLine}>{p.accessType || 'Watch now'}</span>
              </span>
              <ArrowUpRight size={16} className={styles.externalIcon} aria-hidden="true" />
            </a>
          ))}
        </div>
      ) : (
        <p className={styles.empty}>No verified streaming information for this title yet.</p>
      )}
    </section>
  );
};
