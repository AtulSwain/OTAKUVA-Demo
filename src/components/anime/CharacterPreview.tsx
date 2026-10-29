'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import styles from './CharacterPreview.module.css';

export interface VoiceActor {
  id?: string;
  personId?: string;
  slug?: string;
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
  /** Kept for callers; no longer used — a character without a photo shows its initial, not the anime's poster. */
  animeFallbackPoster?: string | null;
}

type Filter = 'ALL' | 'MAIN' | 'SUPPORTING';
const ROLE_ORDER: Record<string, number> = { main: 0, supporting: 1, background: 2 };
const roleOf = (c: any) => String(c.role || 'Supporting');

/** Japanese voice actor first, then any other. */
function primaryVoice(c: any): VoiceActor | null {
  const list: VoiceActor[] = Array.isArray(c.voiceActors) ? c.voiceActors : [];
  return list.find((v) => (v.language || '').toLowerCase() === 'japanese') ?? list[0] ?? null;
}

function CharacterCard({ char }: { char: any }) {
  const [imgError, setImgError] = useState(false);
  const [vaImgError, setVaImgError] = useState(false);
  const name = char.name || char.character?.name || 'Character';
  const role = roleOf(char);
  const image = char.image || char.imageUrl || char.character?.imageUrl || null;
  const slug = char.slug || char.id;
  const va = primaryVoice(char);
  const vaSlug = va ? va.slug || va.personId || va.id : null;
  const initial = (name.trim() || 'C').charAt(0).toUpperCase();
  const isMain = role.toLowerCase() === 'main';

  return (
    <article className={styles.card}>
      <Link href={`/character/${slug}`} className={styles.portrait} title={`${name} (${role})`}>
        {image && !imgError ? (
          <Image src={image} alt={name} fill sizes="180px" className={styles.portraitImg} unoptimized onError={() => setImgError(true)} />
        ) : (
          <span className={styles.portraitFallback}>{initial}</span>
        )}
        <span className={styles.shade} aria-hidden="true" />
        <span className={`${styles.role} ${isMain ? styles.roleMain : ''}`}>{role}</span>
        <span className={styles.name}>{name}</span>
      </Link>
      {va ? (
        <Link
          href={vaSlug ? `/person/${vaSlug}` : '#'}
          className={styles.va}
          title={`Voiced by ${va.name}`}
          onClick={(e) => {
            if (!vaSlug) e.preventDefault();
          }}
        >
          <span className={styles.vaAvatar}>
            {va.imageUrl && !vaImgError ? (
              <Image src={va.imageUrl} alt="" fill sizes="28px" className={styles.vaImg} unoptimized onError={() => setVaImgError(true)} />
            ) : (
              <span className={styles.vaInitial}>{va.name.charAt(0)}</span>
            )}
          </span>
          <span className={styles.vaText}>
            <span className={styles.vaName}>{va.name}</span>
            <span className={styles.vaLang}>{va.language || 'Japanese'}</span>
          </span>
        </Link>
      ) : (
        <span className={styles.vaNone}>Voice actor not listed</span>
      )}
    </article>
  );
}

/**
 * Characters & Voice Cast (modernised 2026-10-25): every character we hold
 * for the anime, main cast first, filterable by role, in a scrollable rail.
 * Portrait cards with the name over the art, the Japanese voice actor below.
 * Characters come from AniList (scripts/import_characters_studios_anilist.ts)
 * or earlier Jikan imports; a missing photo shows the initial.
 */
export const CharacterPreview: React.FC<CharacterPreviewProps> = ({ characters = [], onViewAllCharacters }) => {
  const [filter, setFilter] = useState<Filter>('ALL');
  const railRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const sorted = useMemo(
    () => [...(characters || [])].sort((a, b) => (ROLE_ORDER[roleOf(a).toLowerCase()] ?? 3) - (ROLE_ORDER[roleOf(b).toLowerCase()] ?? 3)),
    [characters]
  );
  const counts = useMemo(() => {
    const main = sorted.filter((c) => roleOf(c).toLowerCase() === 'main').length;
    return { ALL: sorted.length, MAIN: main, SUPPORTING: sorted.length - main };
  }, [sorted]);
  const shown = filter === 'ALL' ? sorted : sorted.filter((c) => (roleOf(c).toLowerCase() === 'main') === (filter === 'MAIN'));
  const voiceActors = useMemo(() => new Set(sorted.map((c) => primaryVoice(c)?.name).filter(Boolean)).size, [sorted]);

  const measure = () => {
    const el = railRef.current;
    if (el) setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [shown.length]);
  const scrollBy = (dir: 1 | -1) => railRef.current?.scrollBy({ left: dir * railRef.current.clientWidth * 0.85, behavior: 'smooth' });

  return (
    <div className={styles.section} aria-label="Characters & Voice Cast">
      <div className={styles.head}>
        <div className={styles.headText}>
          <h3 className={styles.title}>Characters & Voice Cast</h3>
          {sorted.length > 0 && (
            <span className={styles.sub}>
              {sorted.length} {sorted.length === 1 ? 'character' : 'characters'}
              {voiceActors > 0 && ` · ${voiceActors} voice ${voiceActors === 1 ? 'actor' : 'actors'}`}
            </span>
          )}
        </div>
        {sorted.length > 0 && (
          <div className={styles.controls}>
            {counts.MAIN > 0 && counts.SUPPORTING > 0 && (
              <div className={styles.filters} role="tablist" aria-label="Filter by role">
                {(['ALL', 'MAIN', 'SUPPORTING'] as Filter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    role="tab"
                    aria-selected={filter === f}
                    className={`${styles.filter} ${filter === f ? styles.filterOn : ''}`}
                    onClick={() => setFilter(f)}
                  >
                    {f === 'ALL' ? 'All' : f === 'MAIN' ? 'Main' : 'Supporting'} <small>{counts[f]}</small>
                  </button>
                ))}
              </div>
            )}
            {!(edges.start && edges.end) && (
              <span className={styles.arrows}>
                <button type="button" className={styles.arrow} onClick={() => scrollBy(-1)} disabled={edges.start} aria-label="Scroll back">
                  <ChevronLeft size={16} />
                </button>
                <button type="button" className={styles.arrow} onClick={() => scrollBy(1)} disabled={edges.end} aria-label="Scroll forward">
                  <ChevronRight size={16} />
                </button>
              </span>
            )}
            {onViewAllCharacters && (
              <button type="button" className={styles.viewAll} onClick={onViewAllCharacters}>
                View all <ChevronRight size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          <User size={18} aria-hidden="true" />
          <span>No characters on record for this anime yet.</span>
        </div>
      ) : (
        <div className={styles.rail} ref={railRef} onScroll={measure} key={filter}>
          {shown.map((char: any, idx: number) => (
            <CharacterCard key={`${char.id || char.name}-${idx}`} char={char} />
          ))}
        </div>
      )}
    </div>
  );
};
