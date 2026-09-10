'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Building2, Star, ArrowRight } from 'lucide-react';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './PopularStudiosHome.module.css';

interface StudioPreview {
  id: string;
  name: string;
  slug: string;
  establishedYear?: number | null;
  averageScore?: number | null;
  animeCount?: number;
  topWork?: string;
}

const FALLBACK_STUDIOS: StudioPreview[] = [
  { id: '1', name: 'Madhouse', slug: 'madhouse', establishedYear: 1972, averageScore: 9.35, animeCount: 24, topWork: 'Frieren' },
  { id: '2', name: 'MAPPA', slug: 'mappa', establishedYear: 2011, averageScore: 8.85, animeCount: 18, topWork: 'Jujutsu Kaisen' },
  { id: '3', name: 'Ufotable', slug: 'ufotable', establishedYear: 2000, averageScore: 8.92, animeCount: 12, topWork: 'Demon Slayer' },
  { id: '4', name: 'Kyoto Animation', slug: 'kyoto-animation', establishedYear: 1981, averageScore: 9.15, animeCount: 20, topWork: 'Violet Evergarden' },
  { id: '5', name: 'Bones', slug: 'bones', establishedYear: 1998, averageScore: 9.61, animeCount: 22, topWork: 'Fullmetal Alchemist' },
];

export const PopularStudiosHome: React.FC = () => {
  const [studios, setStudios] = useState<StudioPreview[]>(FALLBACK_STUDIOS);

  useEffect(() => {
    async function loadStudios() {
      try {
        const res = await fetch('/api/studios?limit=5&sortBy=score');
        if (res.ok) {
          const data = await res.json();
          if (data.studios && data.studios.length > 0) {
            setStudios(data.studios.slice(0, 5));
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadStudios();
  }, []);

  return (
    <section className={styles.container} aria-label="Popular Production Studios">
      <div className={styles.headerRow}>
        <div className={styles.titleRow}>
          <Building2 size={18} style={{ color: 'var(--accent-primary-hover)' }} />
          <h2 className={styles.title}>Production Studios</h2>
        </div>
        <Link href="/studios" className={styles.viewAllLink}>
          <span>All Studios</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className={styles.grid}>
        {studios.map((s) => {
          const cleanName = sanitizePublicEntityName(s.name);
          const score = s.averageScore ? s.averageScore.toFixed(1) : '9.0';
          const est = s.establishedYear ? `Est. ${s.establishedYear}` : 'Production Studio';

          return (
            <Link
              key={s.id || s.slug}
              href={`/studio/${s.slug || s.id}`}
              className={styles.studioCard}
            >
              <div className={styles.topRow}>
                <div className={styles.logoIcon}>
                  <Building2 size={16} />
                </div>
                <div className={styles.scoreBadge}>
                  <Star size={11} fill="currentColor" />
                  <span>{score}</span>
                </div>
              </div>

              <div>
                <h3 className={styles.studioName}>{cleanName}</h3>
                <span className={styles.metaText}>{est}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};
