'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Building2, Search, Sparkles, ChevronRight } from 'lucide-react';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './studios.module.css';

interface StudioItem {
  id: string;
  name: string;
  slug: string;
  about: string | null;
  totalAnimeCount: number;
  sampleAnime: {
    id: string;
    slug: string;
    canonicalTitle: string;
    posterUrl: string;
    score: number | null;
    year: number | null;
  }[];
}

export default function StudiosPage() {
  const [studios, setStudios] = useState<StudioItem[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStudios() {
      try {
        setLoading(true);
        const url = search.trim() ? `/api/studios?q=${encodeURIComponent(search.trim())}` : '/api/studios';
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setStudios(data.studios || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(fetchStudios, 200);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className={styles.container}>
      {/* 1. Header */}
      <header className={styles.header}>
        <div className={styles.pillarBadge}>
          <Sparkles size={13} />
          <span>OTAKUVA KNOWLEDGE GRAPH · PRODUCTION STUDIOS</span>
        </div>
        <h1 className={styles.pageTitle}>Japanese Animation Studios</h1>
        <p className={styles.pageSubtitle}>
          Discover the history, founding leadership, milestone timelines, and complete canonical anime catalogues of Japan&apos;s master animation houses.
        </p>
      </header>

      {/* 2. Search Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <Search size={15} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search studios (e.g. Kyoto Animation, MAPPA, Bones, Madhouse)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* 3. Studios Grid */}
      {loading ? (
        <div className={styles.loadingGrid}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      ) : studios.length === 0 ? (
        <div className={styles.emptyState}>
          <h3>No studios found</h3>
          <p>Try searching for a different studio name.</p>
        </div>
      ) : (
        <div className={styles.studiosGrid}>
          {studios.map((st) => {
            const cleanStudioName = sanitizePublicEntityName(st.name);
            return (
              <Link
                href={`/studios/${st.slug || cleanStudioName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                key={st.id}
                className={styles.studioCard}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.studioNameGroup}>
                    <div className={styles.studioIconBox}>
                      <Building2 size={20} />
                    </div>
                    <h3 className={styles.studioName}>{cleanStudioName}</h3>
                  </div>
                  <span className={styles.titlesBadge}>{st.totalAnimeCount} Titles</span>
                </div>

                {st.about && <p className={styles.studioAbout}>{st.about}</p>}

                {st.sampleAnime.length > 0 && (
                  <div className={styles.samplesRow}>
                    {st.sampleAnime.map((sa) => (
                      <div key={sa.id} className={styles.samplePosterWrap}>
                        {sa.posterUrl ? (
                          <Image
                            src={sa.posterUrl}
                            alt={sanitizePublicEntityName(sa.canonicalTitle)}
                            fill
                            className={styles.samplePosterImg}
                            unoptimized
                          />
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                <div className={styles.cardFooter}>
                  <span className={styles.exploreLink}>
                    <span>Explore Studio Profile</span>
                    <ChevronRight size={13} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
