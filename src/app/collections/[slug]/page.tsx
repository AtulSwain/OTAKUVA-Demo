import React from 'react';
import { CommunityScoreBadge } from '../../../components/rating/CommunityScoreBadge';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Layers, ArrowLeft } from 'lucide-react';
import { AnimePoster } from '../../../components/ui/AnimePoster';
import { getCollectionAnime, getCollectionDef } from '../../../lib/collections';
import { ShareButton } from './ShareButton';
import styles from '../collections.module.css';

export const dynamic = 'force-dynamic';

// Unknown slugs render the not-found page (they used to show the first
// collection). Note: with the root loading.tsx streaming, Next 14 sends these
// with status 200 + noindex rather than 404 — same as every dynamic route here.
export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const def = getCollectionDef(params.slug);
  if (!def) notFound();
  return { title: `${def.title} | OTAKUVA` };
}

/**
 * One collection: the titles that match its rule, in its order. Unknown slugs
 * 404 (they used to fall back to the first collection). Year, type, studio
 * and score are shown only when known — no 2024 / "TV" / "Studio" / 9.0
 * placeholders. The old "Save Collection" button only toggled local state
 * while claiming "Saved to Library", so it was removed.
 */
export default async function CollectionDetailPage({ params }: { params: { slug: string } }) {
  const def = getCollectionDef(params.slug);
  if (!def) notFound();
  const { total, items } = await getCollectionAnime(def, 50);

  return (
    <div className={styles.container}>
      <Link href="/collections" className={styles.detailMeta} style={{ textDecoration: 'none' }}>
        <ArrowLeft size={14} aria-hidden="true" />
        <span>All collections</span>
      </Link>

      <div className={styles.detailHero}>
        <div className={styles.detailKicker}>
          <Layers size={16} aria-hidden="true" />
          <span>Collection</span>
        </div>
        <h1 className={styles.detailTitle}>{def.title}</h1>
        <p className={styles.subtitle}>{def.description}</p>
        <div className={styles.detailMeta}>
          <span>{def.rule}</span>
          <span aria-hidden="true">·</span>
          <span>
            {total.toLocaleString('en-US')} {total === 1 ? 'title' : 'titles'}
            {total > items.length ? ` (top ${items.length} shown)` : ''}
          </span>
        </div>
        <div className={styles.actionsRow}>
          <ShareButton title={def.title} />
        </div>
      </div>

      {items.length === 0 ? (
        <p className={styles.subtitle}>No titles in the catalog match this collection yet.</p>
      ) : (
        <div className={styles.rankedList}>
          {items.map((anime, idx) => {
            const meta = [anime.year ? String(anime.year) : null, anime.type, anime.studio].filter(Boolean).join(' · ');
            return (
              <Link key={anime.id} href={`/anime/${anime.slug || anime.id}`} className={styles.rankedRow}>
                <span className={styles.rankNumber}>{String(idx + 1).padStart(2, '0')}</span>
                <AnimePoster src={anime.posterUrl} alt={anime.title} width={40} height={56} />
                <div className={styles.rankedInfo}>
                  <span className={styles.rankedTitle}>{anime.title}</span>
                  {meta && <span className={styles.rankedMeta}>{meta}</span>}
                </div>
                {/* Members' OTAKUVA score + retention (not the provider score). */}
                <div className={styles.rankedScore}>
                  <CommunityScoreBadge animeId={anime.id} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
