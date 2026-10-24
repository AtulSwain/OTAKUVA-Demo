'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { SectionHead } from '../ui/SectionHead';
import { CollectionCard, type CollectionCardData } from './CollectionCard';
import styles from './Collections.module.css';

/**
 * Homepage "Collections" rail (2026-10-22): members' PUBLIC collections,
 * newest activity first. Hidden until there's at least one.
 */
export function MemberCollectionsRail() {
  const [items, setItems] = useState<CollectionCardData[] | null>(null);

  useEffect(() => {
    let live = true;
    fetch('/api/collections/public?limit=12', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setItems(Array.isArray(d?.items) ? d.items : []))
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, []);

  if (!items || items.length === 0) return null;

  return (
    <section className={styles.railBlock} aria-labelledby="member-collections">
      <SectionHead kicker="Made by members" title="Collections" id="member-collections" href="/collections" linkLabel="All collections" />
      <div className={styles.rail}>
        {items.map((c) => (
          <CollectionCard key={c.id} c={c} />
        ))}
        <Link href="/collections/new" className={styles.makeCard}>
          <span className={styles.makeIcon}>
            <Plus size={20} aria-hidden="true" />
          </span>
          <strong>Make a collection</strong>
          <span>Group anime you love and share it</span>
        </Link>
      </div>
    </section>
  );
}
