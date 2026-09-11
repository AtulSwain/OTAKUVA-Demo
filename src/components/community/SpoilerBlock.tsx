'use client';

import React, { useState } from 'react';
import { Eye } from 'lucide-react';
import { useLibrary } from '../../context/LibraryContext';
import styles from './SpoilerBlock.module.css';

interface SpoilerBlockProps {
  spoilerLevel: string; // "NO_SPOILER", "ANIME_SPOILER", "EPISODE_SPOILER", "MANGA_SPOILER"
  animeId?: string | null;
  animeSlug?: string | null;
  episodeNumber?: number | null;
  /** "inline" is the compact one-line gate used inside comments. */
  variant?: 'block' | 'inline';
  children: React.ReactNode;
}

export const SpoilerBlock: React.FC<SpoilerBlockProps> = ({
  spoilerLevel,
  animeId,
  animeSlug,
  episodeNumber,
  variant = 'block',
  children,
}) => {
  const { library } = useLibrary();
  const [revealed, setRevealed] = useState(spoilerLevel === 'NO_SPOILER');

  if (spoilerLevel === 'NO_SPOILER' || revealed) {
    return <>{children}</>;
  }

  // Progress-aware checks
  const targetId = animeSlug || animeId;
  const userEntry = targetId ? library[targetId] : null;
  const userWatched = userEntry?.episodesWatched || 0;
  const userCompleted = userEntry?.status === 'completed';

  let spoilerMessage = 'Content hidden.';
  if (spoilerLevel === 'MANGA_SPOILER') {
    spoilerMessage = 'Contains Manga Spoilers (Unadapted Plot).';
  } else if (spoilerLevel === 'EPISODE_SPOILER' && episodeNumber) {
    if (userWatched < episodeNumber && !userCompleted) {
      spoilerMessage = `Contains Episode ${episodeNumber} Spoilers (You watched up to Ep ${userWatched}).`;
    } else {
      spoilerMessage = `Contains Episode ${episodeNumber} Spoilers.`;
    }
  } else if (spoilerLevel === 'ANIME_SPOILER') {
    spoilerMessage = 'Contains Full Series Anime Spoilers.';
  }

  if (variant === 'inline') {
    return (
      <button type="button" className={styles.inlineSpoiler} onClick={() => setRevealed(true)}>
        <Eye size={12} aria-hidden="true" />
        <span>
          <strong>Spoiler</strong> · {spoilerMessage.replace(/.$/, '')} — tap to reveal
        </span>
      </button>
    );
  }

  return (
    <div className={styles.spoilerContainer}>
      <div className={styles.spoilerBadge}>SPOILER</div>
      <div className={styles.spoilerWarning}>
        <span className={styles.warningText}>{spoilerMessage}</span>
      </div>
      <button
        type="button"
        className={styles.revealBtn}
        onClick={() => setRevealed(true)}
      >
        <Eye size={13} />
        <span>Show Spoiler</span>
      </button>
    </div>
  );
};
