'use client';

import React, { useEffect, useState } from 'react';
import { CommunityScoreBadge } from '../../../components/rating/CommunityScoreBadge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import styles from './page.module.css';
import { ArrowLeft } from 'lucide-react';

interface ProductionItem {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
  episodes: number | null;
  score: number | null;
  year: number | null;
  startDate: string | null;
  posterUrl: string;
  bannerUrl: string | null;
  relationship: string;
  position: number;
  genres: string[];
  studios: (string | { id: string; name: string; slug: string | null })[];
}

interface FranchiseDetail {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  totalProductions: number;
  productions: ProductionItem[];
  releaseOrder: ProductionItem[];
  recommendedOrder: ProductionItem[];
}

export default function FranchisePage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const [franchise, setFranchise] = useState<FranchiseDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'timeline' | 'release' | 'recommended'>('timeline');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFranchise() {
      try {
        setLoading(true);
        const res = await fetch(`/api/franchises/${params.slug}`);
        if (!res.ok) throw new Error('Failed to load franchise');
        const data = await res.json();
        setFranchise(data.franchise);
      } catch (err: any) {
        setError(err.message || 'An error occurred');
      } finally {
        setLoading(false);
      }
    }
    fetchFranchise();
  }, [params.slug]);

  if (loading) {
    return (
      <div className={styles.container}>
        <p style={{ color: '#8B8D98' }}>Loading franchise timeline...</p>
      </div>
    );
  }

  if (error || !franchise) {
    return (
      <div className={styles.container}>
        <Link href="/anime" className={styles.backLink}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to Catalog
        </Link>
        <h1 className={styles.title}>Franchise Not Found</h1>
        <p className={styles.description}>No franchise information found for &ldquo;{params.slug}&rdquo;.</p>
      </div>
    );
  }

  const currentList =
    activeTab === 'release'
      ? franchise.releaseOrder
      : activeTab === 'recommended'
      ? franchise.recommendedOrder
      : franchise.productions;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/anime" className={styles.backLink}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to Catalog
        </Link>
        <h1 className={styles.title}>{franchise.name}</h1>
        {franchise.description && <p className={styles.description}>{franchise.description}</p>}
        <div className={styles.metaInfo}>
          <span>{franchise.totalProductions} Productions</span>
          <span>•</span>
          <span>Canonical Franchise Timeline</span>
        </div>
      </div>

      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'timeline' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('timeline')}
        >
          Timeline
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'release' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('release')}
        >
          Release Order
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'recommended' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('recommended')}
        >
          Recommended Order
        </button>
      </div>

      <div className={styles.timeline}>
        {currentList.map((item, idx) => (
          <Link href={`/anime/${item.slug || item.id}`} key={item.id} className={styles.card}>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#8B8D98', minWidth: '28px' }}>
              {idx + 1}
            </div>
            {item.posterUrl ? (
              <Image
                src={item.posterUrl}
                alt={item.title}
                width={64}
                height={90}
                className={styles.poster}
                unoptimized
              />
            ) : (
              <div className={styles.poster} />
            )}
            <div className={styles.cardContent}>
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{item.title}</h3>
                <span className={styles.badge}>{item.relationship}</span>
                <span className={styles.badge}>{item.type}</span>
              </div>
              <div className={styles.cardMeta}>
                <span>{item.year || 'Unknown Year'}</span>
                {item.studios.length > 0 && (
                  <span>
                    {item.studios.map((s: any, sIdx: number) => {
                      const studioName = typeof s === 'string' ? s : s?.name;
                      if (!studioName) return null;
                      // The whole production card above is itself a <Link>, so
                      // these can't be nested <Link>/<a> tags (invalid HTML,
                      // breaks hydration) — navigate imperatively instead and
                      // stop the click from also triggering the card's link.
                      const studioHref = typeof s === 'object' && (s?.slug || s?.id) ? `/studio/${s.slug || s.id}` : null;
                      return (
                        <React.Fragment key={s?.id || studioName}>
                          {sIdx > 0 && ', '}
                          {studioHref ? (
                            <span
                              role="link"
                              tabIndex={0}
                              className={styles.studioLink}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                router.push(studioHref);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  router.push(studioHref);
                                }
                              }}
                            >
                              {studioName}
                            </span>
                          ) : (
                            studioName
                          )}
                        </React.Fragment>
                      );
                    })}
                  </span>
                )}
                {/* Members' OTAKUVA score + retention (not the provider score). */}
                <CommunityScoreBadge animeId={item.id} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
