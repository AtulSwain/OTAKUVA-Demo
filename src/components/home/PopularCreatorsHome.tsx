'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Users2, User, ArrowRight } from 'lucide-react';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './PopularCreatorsHome.module.css';

interface CreatorPreview {
  id: string;
  name: string;
  slug: string;
  primaryRole?: string;
  imageUrl?: string | null;
}

const FALLBACK_CREATORS: CreatorPreview[] = [
  { id: '1', name: 'Keiichiro Saito', slug: 'keiichiro-saito', primaryRole: 'Director (Frieren, Bocchi)', imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80' },
  { id: '2', name: 'Hayao Miyazaki', slug: 'hayao-miyazaki', primaryRole: 'Director (Studio Ghibli)', imageUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80' },
  { id: '3', name: 'Hiroyuki Sawano', slug: 'hiroyuki-sawano', primaryRole: 'Composer (Attack on Titan)', imageUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80' },
  { id: '4', name: 'Makoto Shinkai', slug: 'makoto-shinkai', primaryRole: 'Director (Your Name, Suzume)', imageUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=200&auto=format&fit=crop&q=80' },
];

export const PopularCreatorsHome: React.FC = () => {
  const [creators, setCreators] = useState<CreatorPreview[]>(FALLBACK_CREATORS);

  useEffect(() => {
    async function loadCreators() {
      try {
        const res = await fetch('/api/people?limit=4');
        if (res.ok) {
          const data = await res.json();
          if (data.people && data.people.length > 0) {
            setCreators(data.people.slice(0, 4));
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadCreators();
  }, []);

  return (
    <section className={styles.container} aria-label="Creators and Directors">
      <div className={styles.headerRow}>
        <div className={styles.titleRow}>
          <Users2 size={18} style={{ color: 'var(--accent-primary-hover)' }} />
          <h2 className={styles.title}>Creators &amp; Directors</h2>
        </div>
        <Link href="/people" className={styles.viewAllLink}>
          <span>Encyclopedia</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className={styles.grid}>
        {creators.map((p) => {
          const cleanName = sanitizePublicEntityName(p.name);
          const role = p.primaryRole || 'Director / Creator';

          return (
            <Link
              key={p.id || p.slug}
              href={`/person/${p.slug || p.id}`}
              className={styles.personCard}
            >
              <div className={styles.avatarWrap}>
                {p.imageUrl ? (
                  <Image
                    src={p.imageUrl}
                    alt={cleanName}
                    width={44}
                    height={44}
                    className={styles.avatarImg}
                    unoptimized
                  />
                ) : (
                  <User size={20} />
                )}
              </div>

              <div className={styles.details}>
                <h3 className={styles.personName}>{cleanName}</h3>
                <span className={styles.roleText}>{role}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};
