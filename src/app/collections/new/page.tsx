import React from 'react';
import type { Metadata } from 'next';
import { PageHead } from '../../../components/ui/PageHead';
import { CollectionBuilder } from '../../../components/collections/CollectionBuilder';
import styles from '../../../components/collections/Collections.module.css';

export const metadata: Metadata = { title: 'Make a collection | OTAKUVA', robots: { index: false } };

/** /collections/new[?anime=<slug>] — the collection builder (2026-10-22). */
export default function NewCollectionPage({ searchParams }: { searchParams: { anime?: string } }) {
  const start = typeof searchParams.anime === 'string' && searchParams.anime.length <= 200 ? searchParams.anime : null;
  return (
    <div className={styles.page}>
      <PageHead kicker="Collections" title="Make a collection">
        Pick a banner, name it, add anime — keep it to yourself or share it with everyone.
      </PageHead>
      <CollectionBuilder startAnime={start} />
    </div>
  );
}
