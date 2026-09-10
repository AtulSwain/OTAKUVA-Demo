'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { MessageSquare, Heart, ArrowRight } from 'lucide-react';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './FromCommunitySection.module.css';

export const FromCommunitySection: React.FC = () => {
  const [discussions, setDiscussions] = useState<any[]>([]);

  useEffect(() => {
    async function loadDiscussions() {
      try {
        const res = await fetch('/api/discussions?limit=3');
        if (res.ok) {
          const data = await res.json();
          setDiscussions(data.discussions || data.posts || []);
        }
      } catch (e) {
        console.error('Failed to load community discussions:', e);
      }
    }
    loadDiscussions();
  }, []);

  if (discussions.length === 0) return null;

  return (
    <section className={styles.container} aria-label="Discussions From the Community">
      <div className={styles.headerRow}>
        <div className={styles.titleRow}>
          <MessageSquare size={18} style={{ color: 'var(--accent-primary-hover)' }} />
          <h2 className={styles.title}>From the Community</h2>
        </div>
        <Link href="/spaces" className={styles.viewAllLink}>
          <span>Explore Spaces</span>
          <ArrowRight size={14} />
        </Link>
      </div>

      <div className={styles.grid}>
        {discussions.slice(0, 3).map((item) => {
          const title = sanitizePublicEntityName(item.title || 'Anime Discussion');
          const snippet = item.content || item.body || '';
          const spaceName = item.community?.name || item.space?.name || 'General Anime';
          const cleanSpaceName = sanitizePublicEntityName(spaceName);

          return (
            <Link
              key={item.id}
              href={`/spaces/${item.community?.slug || 'general'}`}
              className={styles.card}
            >
              <div className={styles.cardMeta}>
                <span className={styles.spaceBadge}>{cleanSpaceName}</span>
                <span>{new Date(item.createdAt || Date.now()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>

              <h3 className={styles.cardTitle}>{title}</h3>
              {snippet && <p className={styles.cardSnippet}>{snippet}</p>}

              <div className={styles.cardFooter}>
                <span className={styles.statItem}>
                  <MessageSquare size={12} />
                  <span>{item.replyCount || item.commentsCount || 12} replies</span>
                </span>
                <span className={styles.statItem}>
                  <Heart size={12} />
                  <span>{item.likeCount || 34} likes</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};
