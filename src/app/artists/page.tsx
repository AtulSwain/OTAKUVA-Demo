'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Palette, Search, ArrowRight } from 'lucide-react';
import { FIXTURE_ANIMES } from '../../fixtures/anime.fixture';
import { ScrollReveal } from '../../components/ui/ScrollReveal';
import styles from '../directory/directory.module.css';

interface DirectoryEntry {
  id: string;
  name: string;
  category: 'Artist' | 'Creator' | 'Studio' | 'Production' | 'Anime';
  href: string;
  subtitle: string;
}

const INITIAL_ARTISTS_ENTRIES: DirectoryEntry[] = [
  // Creators & Key Artists
  { id: 'keiichiro-saito', name: 'Keiichiro Saito', category: 'Creator', href: '/person/keiichiro-saito', subtitle: 'Director · Frieren, Bocchi the Rock!' },
  { id: 'hayao-miyazaki', name: 'Hayao Miyazaki', category: 'Creator', href: '/person/hayao-miyazaki', subtitle: 'Director & Visionary · Studio Ghibli' },
  { id: 'hiroyuki-sawano', name: 'Hiroyuki Sawano', category: 'Artist', href: '/person/hiroyuki-sawano', subtitle: 'Composer · Attack on Titan, Solo Leveling' },
  { id: 'makoto-shinkai', name: 'Makoto Shinkai', category: 'Creator', href: '/person/makoto-shinkai', subtitle: 'Director · Your Name., Suzume' },
  { id: 'shinichiro-watanabe', name: 'Shinichiro Watanabe', category: 'Creator', href: '/person/shinichiro-watanabe', subtitle: 'Director · Cowboy Bebop' },
  { id: 'yoko-kanno', name: 'Yoko Kanno', category: 'Artist', href: '/person/yoko-kanno', subtitle: 'Composer · Cowboy Bebop, Ghost in the Shell' },
  // Studios
  { id: 'madhouse', name: 'Madhouse', category: 'Studio', href: '/studio/madhouse', subtitle: 'Est. 1972 · Tokyo, Japan' },
  { id: 'mappa', name: 'MAPPA', category: 'Studio', href: '/studio/mappa', subtitle: 'Est. 2011 · Suginami, Tokyo' },
  { id: 'ufotable', name: 'Ufotable', category: 'Studio', href: '/studio/ufotable', subtitle: 'Est. 2000 · Suginami, Tokyo' },
  { id: 'kyoto-animation', name: 'Kyoto Animation', category: 'Studio', href: '/studio/kyoto-animation', subtitle: 'Est. 1981 · Uji, Kyoto' },
  { id: 'bones', name: 'Bones', category: 'Studio', href: '/studio/bones', subtitle: 'Est. 1998 · Suginami, Tokyo' },
  { id: 'trigger', name: 'Trigger', category: 'Studio', href: '/studio/trigger', subtitle: 'Est. 2011 · Suginami, Tokyo' },
  { id: 'wit-studio', name: 'Wit Studio', category: 'Studio', href: '/studio/wit-studio', subtitle: 'Est. 2012 · Musashino, Tokyo' },
  { id: 'cloverworks', name: 'CloverWorks', category: 'Studio', href: '/studio/cloverworks', subtitle: 'Est. 2018 · Suginami, Tokyo' },
  // Production
  { id: 'toho-animation', name: 'TOHO animation', category: 'Production', href: '/production', subtitle: 'Production & Planning · Tokyo' },
  { id: 'aniplex', name: 'Aniplex', category: 'Production', href: '/production', subtitle: 'Planning & Distribution · Tokyo' },
  { id: 'kadokawa', name: 'Kadokawa Corporation', category: 'Production', href: '/production', subtitle: 'Publisher & Committee Lead · Tokyo' },
  { id: 'bandai-namco', name: 'Bandai Namco Filmworks', category: 'Production', href: '/production', subtitle: 'Production & IP Management · Tokyo' },
  // Canonical Anime
  ...FIXTURE_ANIMES.map((a) => ({
    id: a.id,
    name: (a as any).canonicalTitle || a.title || 'Untitled Anime',
    category: 'Anime' as const,
    href: `/anime/${a.slug || a.id}`,
    subtitle: `${a.year || 2024} · ${a.type || 'TV'} · ★ ${(a.score || 9.0).toFixed(2)}`,
  })),
];

const ALPHABET = ['ALL', '#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
const CATEGORIES = ['All', 'Artist', 'Creator', 'Studio', 'Production', 'Anime'] as const;

export default function ArtistsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLetter, setSelectedLetter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEntries = useMemo(() => {
    return INITIAL_ARTISTS_ENTRIES.filter((entry) => {
      // Category filter
      const matchCat = selectedCategory === 'All' || entry.category === selectedCategory;

      // Letter filter
      let matchLetter = true;
      if (selectedLetter !== 'ALL') {
        const firstChar = entry.name.charAt(0).toUpperCase();
        if (selectedLetter === '#') {
          matchLetter = /^[0-9]/.test(firstChar);
        } else {
          matchLetter = firstChar === selectedLetter;
        }
      }

      // Search query
      const matchSearch =
        searchQuery.trim() === '' ||
        entry.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.subtitle.toLowerCase().includes(searchQuery.toLowerCase());

      return matchCat && matchLetter && matchSearch;
    });
  }, [selectedCategory, selectedLetter, searchQuery]);

  return (
    <div className={styles.page}>
      {/* 1. Hero Header */}
      <div className={styles.hero}>
        <div className={styles.badge}>
          <Palette size={12} />
          <span>Artists &amp; Creators Directory</span>
        </div>
        <h1 className={styles.heroTitle}>Artists &amp; Creative Directory</h1>
        <p className={styles.heroSubtitle}>
          Complete index of directors, voice actors, composers, animators, and production studios across the OTAKUVA ecosystem.
        </p>
      </div>

      {/* 2. Category Filter Bar */}
      <div className={styles.categoryBar}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`${styles.categoryPill} ${selectedCategory === cat ? styles.categoryPillActive : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 3. Search & Alphabet Scrubber Row */}
      <div className={styles.searchAlphabetRow}>
        <div className={styles.searchBox}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Filter artists, directors, studios..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className={styles.alphabetScrubber}>
          {ALPHABET.map((letter) => (
            <button
              key={letter}
              type="button"
              className={`${styles.alphaLetter} ${selectedLetter === letter ? styles.alphaLetterActive : ''}`}
              onClick={() => setSelectedLetter(letter)}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Results Section */}
      <div className={styles.resultsMeta}>
        <span>Showing <strong>{filteredEntries.length}</strong> matching entries</span>
        {searchQuery && (
          <button
            type="button"
            className={styles.clearSearchBtn}
            onClick={() => setSearchQuery('')}
          >
            Clear search
          </button>
        )}
      </div>

      {filteredEntries.length > 0 ? (
        <div className={styles.grid}>
          {filteredEntries.map((entry, idx) => (
            <ScrollReveal key={entry.id} delayMs={idx * 15}>
              <Link href={entry.href} className={styles.entryCard}>
                <div className={styles.cardTop}>
                  <span className={`${styles.typeBadge} ${styles[`typeBadge${entry.category}`] || ''}`}>
                    {entry.category}
                  </span>
                  <ArrowRight size={13} className={styles.arrowIcon} />
                </div>
                <h3 className={styles.cardName}>{entry.name}</h3>
                <p className={styles.cardSubtitle}>{entry.subtitle}</p>
              </Link>
            </ScrollReveal>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p>No entries found matching your filter criteria.</p>
        </div>
      )}
    </div>
  );
}
