'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronRight, User } from 'lucide-react';
import styles from './CharacterPreview.module.css';

export interface VoiceActor {
  id?: string;
  name: string;
  language?: string;
  imageUrl?: string | null;
}

export interface CharacterItem {
  id?: string;
  name: string;
  role?: string;
  image?: string;
  imageUrl?: string | null;
  slug?: string;
  voiceActors?: VoiceActor[];
  character?: {
    name: string;
    imageUrl?: string;
  };
}

interface CharacterPreviewProps {
  characters?: CharacterItem[];
  onViewAllCharacters?: () => void;
  animeFallbackPoster?: string | null;
}

interface CharacterCardItemProps {
  char: any;
  idx: number;
  animeFallbackPoster?: string | null;
}

const CharacterCardItem: React.FC<CharacterCardItemProps> = ({ char, idx, animeFallbackPoster }) => {
  const [imgError, setImgError] = React.useState(false);
  const [vaImgError, setVaImgError] = React.useState(false);

  const charName = char.name || char.character?.name || 'Character';
  const charRole = char.role || 'Main';
  const charImage =
    char.image ||
    char.imageUrl ||
    char.character?.imageUrl ||
    animeFallbackPoster ||
    '/images/placeholder-avatar.png';
  const charSlug = char.slug || charName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const primaryVA = Array.isArray(char.voiceActors) && char.voiceActors.length > 0 ? char.voiceActors[0] : null;
  const initial = (charName.trim() || 'C').charAt(0).toUpperCase();

  return (
    <div key={`${charName}-${char.id || idx}`} className={styles.characterCard}>
      <Link
        href={`/characters/${charSlug}`}
        className={styles.characterLink}
        title={`${charName} (${charRole})`}
      >
        <div className={styles.portraitWrapper}>
          {!imgError && charImage ? (
            <Image
              src={charImage}
              alt={charName}
              fill
              className={styles.portraitImg}
              unoptimized
              onError={() => setImgError(true)}
            />
          ) : (
            <div className={styles.portraitFallback}>
              {initial}
            </div>
          )}
          <span className={`${styles.roleBadge} ${charRole.toLowerCase() === 'main' ? styles.roleMain : styles.roleSupporting}`}>
            {charRole}
          </span>
        </div>

        <div className={styles.charInfo}>
          <span className={styles.charName}>{charName}</span>
        </div>
      </Link>

      {primaryVA && (
        <div className={styles.vaRow} title={`Voiced by ${primaryVA.name}`}>
          {primaryVA.imageUrl && !vaImgError ? (
            <div className={styles.vaAvatar}>
              <Image
                src={primaryVA.imageUrl}
                alt={primaryVA.name}
                fill
                className={styles.vaImg}
                unoptimized
                onError={() => setVaImgError(true)}
              />
            </div>
          ) : (
            <div className={styles.vaInitial}>
              {primaryVA.name.charAt(0)}
            </div>
          )}
          <div className={styles.vaInfo}>
            <span className={styles.vaName}>{primaryVA.name}</span>
            <span className={styles.vaLang}>{primaryVA.language || 'Japanese'}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export const CharacterPreview: React.FC<CharacterPreviewProps> = ({
  characters = [],
  onViewAllCharacters,
  animeFallbackPoster,
}) => {
  const hasCharacters = Array.isArray(characters) && characters.length > 0;

  return (
    <div className={styles.section} aria-label="Characters & Voice Cast">
      <div className={styles.headerRow}>
        <h3 className={styles.headerTitle}>Characters & Voice Cast</h3>
        {onViewAllCharacters && hasCharacters && (
          <button
            type="button"
            className={styles.viewAllLink}
            onClick={onViewAllCharacters}
          >
            <span>View All</span>
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      {!hasCharacters ? (
        <div className={styles.emptyContainer}>
          <User size={18} className={styles.emptyIcon} />
          <span className={styles.emptyText}>Character catalog is being synced from official records.</span>
        </div>
      ) : (
        <div className={styles.railScroll}>
          {characters.map((char: any, idx: number) => (
            <CharacterCardItem
              key={`${char.name || 'char'}-${char.id || idx}`}
              char={char}
              idx={idx}
              animeFallbackPoster={animeFallbackPoster}
            />
          ))}
        </div>
      )}
    </div>
  );
};
