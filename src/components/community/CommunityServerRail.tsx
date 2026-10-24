'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Compass, Home, Plus } from 'lucide-react';
import { CommunityImage } from '../ui/CommunityImage';
import styles from './CommunityServerRail.module.css';

interface RailCommunity {
  id: string;
  slug: string;
  name: string;
  iconUrl?: string | null;
}

/**
 * Far-left rail of the community workspace: back to OTAKUVA, the viewer's
 * joined communities, and discovery. Replaces the site header while inside
 * a community.
 */
export function CommunityServerRail({
  activeSlug,
  userId,
  refreshKey,
}: {
  activeSlug: string;
  userId?: string | null;
  refreshKey?: unknown;
}) {
  const [joined, setJoined] = useState<RailCommunity[]>([]);

  useEffect(() => {
    if (!userId) {
      setJoined([]);
      return;
    }
    let cancelled = false;
    fetch('/api/communities?filter=joined&limit=50')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d?.communities) setJoined(d.communities);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  return (
    <nav className={styles.rail} aria-label="Communities">
      <Link href="/" className={styles.item} aria-label="Back to OTAKUVA home" title="OTAKUVA home">
        <span className={`${styles.pill} ${styles.home}`}>
          <Home size={22} />
        </span>
      </Link>
      <span className={styles.divider} aria-hidden="true" />

      <ul className={styles.list}>
        {joined.map((c) => {
          const active = c.slug === activeSlug;
          return (
            <li key={c.id}>
              <Link
                href={`/community/${c.slug}`}
                className={`${styles.item} ${active ? styles.active : ''}`}
                aria-label={c.name}
                aria-current={active ? 'page' : undefined}
                title={c.name}
              >
                <span className={styles.indicator} aria-hidden="true" />
                <span className={styles.pill}>
                  <CommunityImage src={c.iconUrl} type="icon" communityName={c.name} />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link href="/community/create" className={styles.item} aria-label="Create a community" title="Create a community">
        <span className={`${styles.pill} ${styles.action} ${styles.create}`}>
          <Plus size={20} />
        </span>
      </Link>
      <Link href="/community" className={styles.item} aria-label="Explore communities" title="Explore communities">
        <span className={`${styles.pill} ${styles.action} ${styles.explore}`}>
          <Compass size={20} />
        </span>
      </Link>
    </nav>
  );
}
