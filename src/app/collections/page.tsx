import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { getCollectionSummaries } from '../../lib/collections';
import { getPublicCollections } from '../../lib/lists/listService';
import { CollectionCard } from '../../components/collections/CollectionCard';
import c from '../../components/collections/Collections.module.css';
import styles from './collections.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Collections | OTAKUVA' };

export default async function CollectionsPage() {
  const [collections, members] = await Promise.all([getCollectionSummaries(), getPublicCollections({ limit: 24 })]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Collections</h1>
        <p className={styles.subtitle}>
          Collections made by members, and lists built straight from the catalog.
        </p>
      </header>

      {/* Members' PUBLIC collections (2026-10-22) — private ones never show. */}
      <section className={styles.memberSection} aria-labelledby="member-collections">
        <div className={c.indexHead}>
          <h2 className={c.sectionTitle} id="member-collections">From members</h2>
          <Link href="/collections/new" className={c.primaryBtn}>
            <Plus size={16} aria-hidden="true" /> Make a collection
          </Link>
        </div>
        {members.items.length > 0 ? (
          <div className={c.grid}>
            {members.items.map((m) => (
              <CollectionCard key={m.id} c={m} />
            ))}
          </div>
        ) : (
          <p className={c.emptyNote}>No public collections yet — make the first one.</p>
        )}
      </section>

      <h2 className={c.sectionTitle}>From the catalog</h2>

      <div className={styles.collectionsGrid}>
        {collections.map((col) => (
          <Link key={col.slug} href={`/collections/${col.slug}`} className={styles.card}>
            <div className={styles.bannerWrap}>
              {col.coverUrl && (
                <Image src={col.coverUrl} alt="" fill sizes="(max-width: 640px) 100vw, 33vw" className={styles.bannerImg} unoptimized />
              )}
              <div className={styles.bannerOverlay} />
            </div>

            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>{col.title}</h2>
              <p className={styles.cardDesc}>{col.description}</p>
              <div className={styles.cardFooter}>
                <span className={styles.countTag}>
                  {col.count.toLocaleString('en-US')} {col.count === 1 ? 'title' : 'titles'}
                </span>
                <span>{col.rule}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
