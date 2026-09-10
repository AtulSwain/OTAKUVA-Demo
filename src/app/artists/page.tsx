'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Palette, Search, ArrowRight } from 'lucide-react';
import { ScrollReveal } from '../../components/ui/ScrollReveal';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import styles from '../directory/directory.module.css';

interface DirectoryEntry {
  id: string;
  name: string;
  category: 'Artist' | 'Studio';
  href: string;
  subtitle: string;
}

const ALPHABET = ['ALL', '#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];
const CATEGORIES = ['All', 'Artist', 'Studio'] as const;

// Builds the subtitle from verified fields only. Anything absent is simply
// omitted rather than filled in with an assumed role, year, or location.
function personSubtitle(person: any): string {
  const parts: string[] = [];

  const primaryRole = person.topStaffRoles?.[0]?.role;
  if (primaryRole) parts.push(primaryRole);

  const knownFor = (person.topStaffRoles || [])
    .map((sr: any) => sr.anime?.canonicalTitle)
    .filter(Boolean)
    .slice(0, 2)
    .join(', ');
  if (knownFor) parts.push(knownFor);

  return parts.join(' · ');
}

function studioSubtitle(studio: any): string {
  const parts: string[] = [];
  if (studio.foundedYear) parts.push(`Est. ${studio.foundedYear}`);
  if (studio.country) parts.push(studio.country);
  if (studio.totalAnimeCount) parts.push(`${studio.totalAnimeCount} works`);
  return parts.join(' · ');
}

export default function ArtistsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedLetter, setSelectedLetter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadDirectory() {
      setIsLoading(true);
      setError(false);
      try {
        const q = searchQuery.trim();
        const suffix = q ? `&q=${encodeURIComponent(q)}` : '';

        const [peopleRes, studiosRes] = await Promise.all([
          fetch(`/api/people?limit=60${suffix}`),
          fetch(`/api/studios?limit=60${suffix}`),
        ]);

        if (!peopleRes.ok || !studiosRes.ok) {
          throw new Error('Directory request failed');
        }

        const [peopleData, studiosData] = await Promise.all([
          peopleRes.json(),
          studiosRes.json(),
        ]);
        if (cancelled) return;

        const people: DirectoryEntry[] = (peopleData.people || []).map((p: any) => ({
          id: `person-${p.id}`,
          name: p.name,
          category: 'Artist' as const,
          href: `/person/${p.slug}`,
          subtitle: personSubtitle(p),
        }));

        const studios: DirectoryEntry[] = (studiosData.studios || []).map((s: any) => ({
          id: `studio-${s.id}`,
          name: s.displayTitle || s.name,
          category: 'Studio' as const,
          href: `/studio/${s.slug}`,
          subtitle: studioSubtitle(s),
        }));

        setEntries(
          [...people, ...studios].sort((a, b) => a.name.localeCompare(b.name))
        );
      } catch (err) {
        console.error('Failed to load artists directory:', err);
        if (!cancelled) {
          setError(true);
          setEntries([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    const timer = setTimeout(loadDirectory, searchQuery.trim() ? 250 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, reloadToken]);

  // Category and letter narrow the fetched set client-side; the text query is
  // served by the API so it searches the whole catalog, not just this page.
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchCat = selectedCategory === 'All' || entry.category === selectedCategory;

      let matchLetter = true;
      if (selectedLetter !== 'ALL') {
        const firstChar = entry.name.charAt(0).toUpperCase();
        matchLetter = selectedLetter === '#' ? /^[0-9]/.test(firstChar) : firstChar === selectedLetter;
      }

      return matchCat && matchLetter;
    });
  }, [entries, selectedCategory, selectedLetter]);

  const handleRetry = useCallback(() => setReloadToken((t) => t + 1), []);

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
          Index of directors, voice actors, composers, animators, and production studios recorded in the OTAKUVA catalog.
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
      {!isLoading && !error && (
        <div className={styles.resultsMeta}>
          <span>
            Showing <strong>{filteredEntries.length}</strong> matching entries
          </span>
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
      )}

      {isLoading ? (
        <div className={styles.resultsMeta}>
          <span>Loading directory…</span>
        </div>
      ) : error ? (
        <ErrorState
          title="Couldn't load the directory"
          message="The artists and studios directory is temporarily unavailable. Your library and tracking data are unaffected."
          onRetry={handleRetry}
        />
      ) : filteredEntries.length > 0 ? (
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
                {entry.subtitle && <p className={styles.cardSubtitle}>{entry.subtitle}</p>}
              </Link>
            </ScrollReveal>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Palette}
          title="No entries found"
          description={
            searchQuery.trim()
              ? `No artists or studios in the catalog match "${searchQuery.trim()}".`
              : 'No artists or studios have been recorded in the catalog yet.'
          }
          actionLabel={searchQuery.trim() ? 'Clear search' : undefined}
          onAction={searchQuery.trim() ? () => setSearchQuery('') : undefined}
        />
      )}
    </div>
  );
}
