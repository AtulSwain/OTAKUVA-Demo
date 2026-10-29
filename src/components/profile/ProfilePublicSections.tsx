'use client';

/**
 * The profile tabs anyone can see: the anime a member rated, their public
 * collections and their communities. Each loads its own data, only when its
 * tab opens. Nothing here shows private things — ratings are public,
 * collections are PUBLIC ones only, PRIVATE communities are filtered server
 * side (and joined ones respect the member's showJoinedCommunities setting).
 */
import { retentionColor, retentionLabel } from '../../lib/rating/retentionTone';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, MessageSquare, Layers, Users } from 'lucide-react';
import { AnimeImage } from '../anime/AnimeImage';
import { CollectionCard, type CollectionCardData } from '../collections/CollectionCard';
import styles from './ProfilePublicSections.module.css';

interface RatedItem {
  anime: { id: string; slug: string; title: string; posterUrl: string | null; year: number | null; type: string | null };
  retention: number;
  episodes: number;
  ratedAt: string;
  reviewed: boolean;
}

function Empty({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}>{icon}</span>
      <p className={styles.emptyTitle}>{title}</p>
      {sub && <p className={styles.emptySub}>{sub}</p>}
    </div>
  );
}

export function ProfileRatings({ username, name, limit, onSeeAll }: { username: string; name: string; limit?: number; onSeeAll?: () => void }) {
  const [items, setItems] = useState<RatedItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async (before: string | null) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: String(limit ?? 36), ...(before ? { before } : {}) });
      const r = await fetch(`/api/users/${encodeURIComponent(username)}/ratings?${qs}`, { cache: 'no-store' });
      const d = r.ok ? await r.json() : { items: [], total: 0, nextCursor: null };
      setItems((prev) => (before && prev ? [...prev, ...d.items] : d.items));
      setTotal(d.total);
      setCursor(d.nextCursor);
    } catch {
      setItems((prev) => prev ?? []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setItems(null);
    load(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  if (items === null) return <p className={styles.loading}>Loading ratings…</p>;
  if (items.length === 0) {
    return limit ? null : <Empty icon={<Star size={28} />} title="No ratings yet" sub={`${name} hasn't rated any episodes yet.`} />;
  }

  return (
    <section>
      {limit && (
        <div className={styles.head}>
          <h2 className={styles.title}>
            Rated <span className={styles.count}>{total.toLocaleString('en-US')}</span>
          </h2>
          {onSeeAll && total > items.length && (
            <button type="button" className={styles.seeAll} onClick={onSeeAll}>
              See all
            </button>
          )}
        </div>
      )}
      <ul className={styles.posterGrid}>
        {items.map((r) => (
          <li key={r.anime.id}>
            <Link href={`/anime/${r.anime.slug}`} className={styles.poster}>
              <span className={styles.posterArt}>
                {r.anime.posterUrl && <AnimeImage src={r.anime.posterUrl} alt="" fill sizes="180px" />}
                <span
                  className={styles.myScore}
                  style={{ color: retentionColor(r.retention) }}
                  title={`${name}'s retention · ${r.episodes} ${r.episodes === 1 ? 'episode' : 'episodes'} rated`}
                >
                  {r.retention}% · {retentionLabel(r.retention)}
                </span>
                {r.reviewed && (
                  <span className={styles.reviewedTag} title="Also reviewed">
                    <MessageSquare size={11} aria-hidden="true" /> Reviewed
                  </span>
                )}
              </span>
              <span className={styles.posterTitle}>{r.anime.title}</span>
              <span className={styles.posterMeta}>{[r.anime.type, r.anime.year].filter(Boolean).join(' · ')}</span>
            </Link>
          </li>
        ))}
      </ul>
      {!limit && cursor && (
        <button type="button" className={styles.more} onClick={() => load(cursor)} disabled={loading}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </section>
  );
}

export function ProfileCollections({ username, name, isSelf }: { username: string; name: string; isSelf: boolean }) {
  const [items, setItems] = useState<CollectionCardData[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/collections/public?user=${encodeURIComponent(username)}&limit=48`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => !cancelled && setItems(d.items || []))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (items === null) return <p className={styles.loading}>Loading collections…</p>;
  return (
    <section className={styles.stack}>
      {isSelf && (
        <p className={styles.note}>
          Only your <strong>public</strong> collections show here.{' '}
          <Link href="/library/lists">Manage all your lists</Link>
        </p>
      )}
      {items.length === 0 ? (
        <Empty
          icon={<Layers size={28} />}
          title="No public collections"
          sub={isSelf ? 'Make a collection public and it will appear on your profile.' : `${name} hasn't published a collection yet.`}
        />
      ) : (
        <div className={styles.collectionGrid}>
          {items.map((c) => (
            <CollectionCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </section>
  );
}

interface CommunityRow {
  slug: string;
  name: string;
  memberCount: number;
  role: 'FOUNDER' | 'MEMBER' | 'MODERATOR';
}

export function ProfileCommunities({ username, name }: { username: string; name: string }) {
  const [rows, setRows] = useState<CommunityRow[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/users/${encodeURIComponent(username)}/badges`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { communities: [] }))
      .then((d) => !cancelled && setRows(d.communities || []))
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [username]);

  if (rows === null) return <p className={styles.loading}>Loading communities…</p>;
  if (rows.length === 0) return <Empty icon={<Users size={28} />} title="No communities to show" sub={`${name} isn't showing any communities.`} />;
  return (
    <ul className={styles.communities}>
      {rows.map((c) => (
        <li key={c.slug}>
          <Link href={`/community/${c.slug}`} className={styles.community}>
            <span className={styles.communityMark} aria-hidden="true">
              {c.name.charAt(0).toUpperCase()}
            </span>
            <span className={styles.communityText}>
              <strong>{c.name}</strong>
              <span>
                {c.memberCount.toLocaleString('en-US')} {c.memberCount === 1 ? 'member' : 'members'}
              </span>
            </span>
            <span className={`${styles.role} ${c.role === 'FOUNDER' ? styles.roleFounder : ''}`}>
              {c.role === 'FOUNDER' ? 'Founder' : c.role === 'MODERATOR' ? 'Moderator' : 'Member'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
