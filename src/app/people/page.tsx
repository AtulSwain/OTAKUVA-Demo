'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Search, User, Mic, Film, Sparkles, Filter } from 'lucide-react';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './people.module.css';

const ROLE_FILTERS = [
  { id: 'ALL', label: 'All Creators & Cast' },
  { id: 'VOICE_ACTOR', label: 'Voice Actors (Seiyuu)' },
  { id: 'DIRECTOR', label: 'Directors' },
  { id: 'WRITER', label: 'Writers & Creators' },
  { id: 'MUSIC', label: 'Music & Sound' },
];

export default function PeopleDirectoryPage() {
  const [people, setPeople] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeRole, setActiveRole] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    let isCancelled = false;
    async function loadPeople() {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams();
        if (searchQuery.trim()) queryParams.set('q', searchQuery.trim());
        if (activeRole !== 'ALL') queryParams.set('role', activeRole);

        const res = await fetch(`/api/people?${queryParams.toString()}`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            setPeople(data.people || []);
            setTotalCount(data.totalCount || 0);
          }
        }
      } catch (err) {
        console.error('Error fetching people:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }

    const timer = setTimeout(loadPeople, 250);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, activeRole]);

  return (
    <div className={styles.container}>
      {/* 1. Header */}
      <header className={styles.header}>
        <div className={styles.pillarBadge}>
          <Sparkles size={13} />
          <span>OTAKUVA KNOWLEDGE GRAPH · PEOPLE &amp; CREATORS</span>
        </div>
        <h1 className={styles.pageTitle}>Creators, Directors &amp; Voice Actors</h1>
        <p className={styles.pageSubtitle}>
          Explore the master database of Japanese voice actors (Seiyuu), directors, animators, composers, and storytellers powering the anime medium.
        </p>
      </header>

      {/* 2. Search & Role Filter Bar */}
      <div className={styles.controlsBar}>
        <div className={styles.searchBox}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by name (e.g. Hideo Kojima, Mamoru Hosoda, Romi Park)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.roleFilters}>
          {ROLE_FILTERS.map((rf) => (
            <button
              key={rf.id}
              type="button"
              className={`${styles.rolePill} ${activeRole === rf.id ? styles.rolePillActive : ''}`}
              onClick={() => setActiveRole(rf.id)}
            >
              {rf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Results Metrics */}
      <div className={styles.metricsRow}>
        <span className={styles.resultsCount}>
          <strong>{totalCount}</strong> Verified Creators in Database
        </span>
      </div>

      {/* 4. People Grid */}
      {loading ? (
        <div className={styles.loadingGrid}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      ) : people.length === 0 ? (
        <div className={styles.emptyState}>
          <User size={32} />
          <h3>No creators found</h3>
          <p>Try searching for a different name or resetting the role filter.</p>
          <button
            type="button"
            className={styles.resetBtn}
            onClick={() => {
              setSearchQuery('');
              setActiveRole('ALL');
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className={styles.peopleGrid}>
          {people.map((person) => (
            <Link key={person.id} href={`/person/${person.slug}`} className={styles.personCard}>
              <div className={styles.avatarWrapper}>
                {person.imageUrl ? (
                  <Image
                    src={person.imageUrl}
                    alt={person.name}
                    fill
                    className={styles.avatarImg}
                    unoptimized
                  />
                ) : (
                  <div className={styles.avatarPlaceholder}>
                    <User size={28} />
                  </div>
                )}
              </div>

              <div className={styles.personInfo}>
                <h3 className={styles.personName}>{sanitizePublicEntityName(person.name)}</h3>
                {person.nativeName && <span className={styles.nativeName}>{person.nativeName}</span>}

                {/* Key Roles & Notable Credits */}
                {person.topStaffRoles.length > 0 && (
                  <div className={styles.creditsList}>
                    <span className={styles.creditsCategory}>Key Production:</span>
                    {person.topStaffRoles.map((sr: any, idx: number) => (
                      <span key={idx} className={styles.creditItem}>
                        <Film size={12} aria-hidden="true" /> {sr.role} — <em>{sr.anime.canonicalTitle}</em>
                      </span>
                    ))}
                  </div>
                )}

                {person.topVoiceRoles.length > 0 && (
                  <div className={styles.creditsList}>
                    <span className={styles.creditsCategory}>Voice Roles:</span>
                    {person.topVoiceRoles.map((vr: any, idx: number) => (
                      <span key={idx} className={styles.creditItem}>
                        <Mic size={12} aria-hidden="true" /> {vr.character.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
