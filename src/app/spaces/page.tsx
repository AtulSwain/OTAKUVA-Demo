'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Users, Search, MessageSquare, Plus } from 'lucide-react';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './spaces.module.css';

export default function SpacesPage() {
  const [spaces, setSpaces] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSpaces() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set('q', search.trim());
        const res = await fetch(`/api/communities?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setSpaces(data.communities || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(loadSpaces, 200);
    return () => clearTimeout(timer);
  }, [search]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Anime Spaces & Communities</h1>
        <p className={styles.subtitle}>
          Join dedicated interest hubs, participate in episode discussions, and share verified reviews.
        </p>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={16} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search anime spaces..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>
          Loading community spaces...
        </div>
      ) : spaces.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>
          No spaces found matching &ldquo;{search}&rdquo;.
        </div>
      ) : (
        <div className={styles.spacesGrid}>
          {spaces.map((space) => {
            const cleanName = sanitizePublicEntityName(space.name);
            return (
              <Link
                key={space.id}
                href={`/spaces/${space.slug || space.id}`}
                className={styles.spaceCard}
              >
                <div className={styles.cardHeader}>
                  <h2 className={styles.spaceTitle}>{cleanName}</h2>
                  <span className={styles.categoryTag}>{space.category || 'General'}</span>
                </div>

                {space.description && (
                  <p className={styles.spaceDesc}>{space.description}</p>
                )}

                <div className={styles.cardFooter}>
                  <span>{space.memberCount || 1} Members</span>
                  <span>{space.discussionCount || 0} Discussions</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
