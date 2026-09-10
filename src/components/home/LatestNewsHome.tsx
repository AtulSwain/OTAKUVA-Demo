'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Newspaper, ArrowRight, Clock } from 'lucide-react';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './LatestNewsHome.module.css';

export const LatestNewsHome: React.FC = () => {
  const [articles, setArticles] = useState<any[]>([]);

  useEffect(() => {
    async function loadNews() {
      try {
        const res = await fetch('/api/news?limit=4');
        if (res.ok) {
          const data = await res.json();
          setArticles(data.articles || []);
        }
      } catch (e) {
        console.error('Failed to fetch home news:', e);
      }
    }
    loadNews();
  }, []);

  if (articles.length === 0) return null;

  return (
    <section className={styles.container} aria-label="Latest Anime News & Dispatches">
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <Newspaper size={18} className={styles.icon} />
          <h2 className={styles.title}>Latest News &amp; Industry Dispatches</h2>
        </div>
        <Link href="/news" className={styles.viewAllLink}>
          <span>View All News</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className={styles.grid}>
        {articles.map((art) => {
          const cleanTitle = sanitizePublicEntityName(art.title);
          return (
            <article key={art.id} className={styles.newsCard}>
              {art.imageUrl && (
                <div className={styles.thumbnailWrap}>
                  <Image
                    src={art.imageUrl}
                    alt={cleanTitle}
                    fill
                    className={styles.thumbnailImg}
                    unoptimized
                  />
                  <span className={styles.categoryBadge}>{art.category}</span>
                </div>
              )}
              <div className={styles.cardContent}>
                <div className={styles.metaRow}>
                  <span className={styles.sourceName}>{art.sourceName}</span>
                  <span className={styles.metaDot}>•</span>
                  <span className={styles.publishedDate}>
                    <Clock size={11} />
                    <span>
                      {new Date(art.publishedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </span>
                </div>

                <h3 className={styles.articleTitle}>
                  <Link href={`/news/${art.slug}`}>{cleanTitle}</Link>
                </h3>

                {art.summary && <p className={styles.articleSummary}>{art.summary}</p>}

                <div className={styles.cardFooter}>
                  <Link href={`/news/${art.slug}`} className={styles.readMoreLink}>
                    <span>Read in News Reader</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
