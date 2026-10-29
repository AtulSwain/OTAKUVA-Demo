'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Star,
  PenLine,
  MessageCircle,
  Gauge,
  Sparkles,
  Bookmark,
  Heart,
  FileText,
  MessageSquare,
  MessagesSquare,
  ListPlus,
  Users,
  UserPlus,
  Lock,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { AnimeImage } from '../anime/AnimeImage';
import { ActivityHeatmap } from './ActivityHeatmap';
import { getScoreColor } from '../../lib/rating/ratingTiers';
import { retentionColor, retentionLabel } from '../../lib/rating/retentionTone';
import { HYPE_LEVELS, HYPE_LEVEL_INFO } from '../../lib/hype/hypeLevels';
import styles from './ProfileActivity.module.css';

type Kind =
  | 'RATED'
  | 'REVIEWED'
  | 'REVIEW_REPLY'
  | 'RETENTION'
  | 'HYPE'
  | 'LIBRARY'
  | 'FAVORITE'
  | 'ARTICLE'
  | 'ARTICLE_COMMENT'
  | 'DISCUSSION'
  | 'DISCUSSION_COMMENT'
  | 'LIST'
  | 'COMMUNITY'
  | 'FOLLOW';

interface Item {
  id: string;
  kind: Kind;
  at: string;
  anime: { id: string; slug: string; title: string; posterUrl: string | null } | null;
  title: string | null;
  href: string | null;
  value: string | number | null;
  excerpt: string | null;
  private: boolean;
}

/** How each kind looks: icon, colour, the noun for the summary. */
const KIND: Record<Kind, { icon: LucideIcon; color: string; one: string; many: string }> = {
  RATED: { icon: Star, color: '#F5B700', one: 'rating', many: 'ratings' },
  REVIEWED: { icon: PenLine, color: '#E4E4E7', one: 'review', many: 'reviews' },
  REVIEW_REPLY: { icon: MessageCircle, color: '#A1A1AA', one: 'review reply', many: 'review replies' },
  RETENTION: { icon: Gauge, color: '#22C55E', one: 'episode rated', many: 'episodes rated' },
  HYPE: { icon: Sparkles, color: '#FF5A36', one: 'hype vote', many: 'hype votes' },
  LIBRARY: { icon: Bookmark, color: '#3FB6F2', one: 'library update', many: 'library updates' },
  FAVORITE: { icon: Heart, color: '#F43F5E', one: 'favourite', many: 'favourites' },
  ARTICLE: { icon: FileText, color: '#E4E4E7', one: 'article', many: 'articles' },
  ARTICLE_COMMENT: { icon: MessageSquare, color: '#A1A1AA', one: 'article comment', many: 'article comments' },
  DISCUSSION: { icon: MessagesSquare, color: '#E4E4E7', one: 'discussion', many: 'discussions' },
  DISCUSSION_COMMENT: { icon: MessageSquare, color: '#A1A1AA', one: 'discussion reply', many: 'discussion replies' },
  LIST: { icon: ListPlus, color: '#C4C4CC', one: 'list', many: 'lists' },
  COMMUNITY: { icon: Users, color: '#C4C4CC', one: 'community', many: 'communities' },
  FOLLOW: { icon: UserPlus, color: '#C4C4CC', one: 'follow', many: 'follows' },
};

/** Filter chips → the kinds they cover. Owner-only chips are hidden for visitors. */
const FILTERS: Array<{ key: string; label: string; kinds: Kind[]; ownerOnly?: boolean }> = [
  { key: 'all', label: 'All', kinds: [] },
  { key: 'ratings', label: 'Ratings', kinds: ['RATED'] },
  { key: 'episodes', label: 'Episodes', kinds: ['RETENTION'], ownerOnly: true },
  { key: 'reviews', label: 'Reviews', kinds: ['REVIEWED', 'REVIEW_REPLY'] },
  { key: 'hype', label: 'Hype', kinds: ['HYPE'], ownerOnly: true },
  { key: 'library', label: 'Library', kinds: ['LIBRARY', 'FAVORITE'], ownerOnly: true },
  { key: 'writing', label: 'Posts & comments', kinds: ['ARTICLE', 'ARTICLE_COMMENT', 'DISCUSSION', 'DISCUSSION_COMMENT'] },
  { key: 'social', label: 'Lists & social', kinds: ['LIST', 'COMMUNITY', 'FOLLOW'] },
];

const hypeLevelFromLabel = (label: string) => HYPE_LEVELS.find((l) => HYPE_LEVEL_INFO[l].label === label) ?? null;

/** The sentence for one item — plain words, the important bit emphasised. */
function Sentence({ item }: { item: Item }) {
  const a = item.anime ? <strong>{item.anime.title}</strong> : null;
  const t = item.title ? <strong>{item.title}</strong> : null;
  switch (item.kind) {
    case 'RATED':
      return <>Rated {a}</>;
    case 'REVIEWED':
      return <>Reviewed {a}</>;
    case 'REVIEW_REPLY':
      return <>Replied to a review of {a}</>;
    case 'RETENTION':
      return <>Rated {item.title ? item.title.toLowerCase() : 'an episode'} of {a}</>;
    case 'HYPE': {
      const lvl = typeof item.value === 'string' ? hypeLevelFromLabel(item.value) : null;
      // Retired levels (Excited / Curious / Not interested) still read naturally in history.
      const verb = lvl === 'HYPED' ? 'Hyped for' : item.value === 'Not interested' ? 'Not interested in' : item.value === 'Excited' ? 'Watching day one:' : item.value === 'Curious' ? 'Curious about' : 'Voted on';
      return <>{verb} {a}</>;
    }
    case 'LIBRARY':
      return <>Moved {a} to <strong>{item.value ?? 'library'}</strong></>;
    case 'FAVORITE':
      return <>Added {a} to favourites</>;
    case 'ARTICLE':
      return <>Published {t}</>;
    case 'ARTICLE_COMMENT':
      return <>Commented on {t}</>;
    case 'DISCUSSION':
      return <>Started {t}</>;
    case 'DISCUSSION_COMMENT':
      return <>Replied in {t}</>;
    case 'LIST':
      return <>Created the list {t}</>;
    case 'COMMUNITY':
      return <>{item.value === 'Founded' ? 'Founded' : 'Joined'} {t}</>;
    case 'FOLLOW':
      return <>Started following {t}</>;
    default:
      return null;
  }
}

/** The value chip on the right (score, retention, hype, list size). */
function ValueChip({ item }: { item: Item }) {
  if (item.kind === 'RATED' && typeof item.value === 'number') {
    return (
      <span className={styles.value} style={{ color: getScoreColor(item.value) }}>
        <Star size={12} fill="currentColor" aria-hidden="true" /> {item.value.toFixed(1)}
      </span>
    );
  }
  if (item.kind === 'RETENTION' && typeof item.value === 'number') {
    return (
      <span className={styles.value} style={{ color: retentionColor(item.value) }}>
        {item.value}% · {retentionLabel(item.value)}
      </span>
    );
  }
  if (item.kind === 'HYPE' && typeof item.value === 'string') {
    const lvl = hypeLevelFromLabel(item.value);
    return (
      <span className={styles.value} style={{ color: lvl ? HYPE_LEVEL_INFO[lvl].color : undefined }}>
        {item.value}
      </span>
    );
  }
  if (item.kind === 'LIST' && typeof item.value === 'number') {
    return <span className={styles.valueMuted}>{item.value} anime</span>;
  }
  return null;
}

function relTime(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function dayLabel(iso: string, now: number) {
  const d = new Date(iso);
  const today = new Date(now);
  const y = new Date(now - 86_400_000);
  const same = (x: Date, z: Date) => x.toDateString() === z.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, y)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

/**
 * Profile activity (2026-10-20): what the member has done, from every feature —
 * a "what they've been up to" summary, the activity calendar, filter chips
 * and a day-grouped feed with plain sentences. The owner sees private items
 * (marked with a lock); visitors only see public ones (enforced server-side).
 */
export function ProfileActivity({ username, compact = false, onSeeAll }: { username: string; compact?: boolean; onSeeAll?: () => void }) {
  const [filter, setFilter] = useState('all');
  const [items, setItems] = useState<Item[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [days, setDays] = useState<Array<{ date: string; count: number }> | undefined>(undefined);
  const [totals, setTotals] = useState<Partial<Record<Kind, number>>>({});
  const [isOwner, setIsOwner] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  const kindsFor = useCallback((key: string) => FILTERS.find((f) => f.key === key)?.kinds ?? [], []);
  const limit = compact ? 8 : 25;

  const load = useCallback(
    async (key: string, before: string | null, withStats: boolean) => {
      const kinds = kindsFor(key);
      const q = new URLSearchParams({ limit: String(limit) });
      if (kinds.length) q.set('kinds', kinds.join(','));
      if (before) q.set('before', before);
      if (!withStats) q.set('stats', '0');
      const res = await fetch(`/api/users/${encodeURIComponent(username)}/activity?${q}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('load failed');
      return res.json();
    },
    [username, kindsFor, limit]
  );

  // First load (with calendar + totals), and again whenever the filter changes.
  useEffect(() => {
    let cancelled = false;
    setItems(null);
    setNow(Date.now());
    load(filter, null, days === undefined)
      .then((d) => {
        if (cancelled) return;
        setItems(d.items || []);
        setCursor(d.nextCursor ?? null);
        setIsOwner(Boolean(d.isOwner));
        if (d.days) setDays(d.days);
        if (d.totals) setTotals(d.totals);
      })
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, username]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const d = await load(filter, cursor, false);
      setItems((cur) => [...(cur || []), ...(d.items || [])]);
      setCursor(d.nextCursor ?? null);
    } catch {
      /* keep what we have */
    } finally {
      setLoadingMore(false);
    }
  };

  const summary = useMemo(
    () =>
      (Object.entries(totals) as Array<[Kind, number]>)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1]),
    [totals]
  );

  const groups = useMemo(() => {
    const out: Array<{ label: string; items: Item[] }> = [];
    for (const it of items || []) {
      const label = dayLabel(it.at, now);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(it);
      else out.push({ label, items: [it] });
    }
    return out;
  }, [items, now]);

  const visibleFilters = FILTERS.filter((f) => !f.ownerOnly || isOwner);

  return (
    <section className={styles.wrap} aria-label="Activity">
      {/* What they've been up to (last 12 months) */}
      <div className={styles.head}>
        <div>
          <p className={styles.kicker}>Activity</p>
          <h2 className={styles.title}>{isOwner ? "What you've been up to" : 'Recent activity'}</h2>
        </div>
        {compact && onSeeAll && (
          <button type="button" className={styles.seeAll} onClick={onSeeAll}>
            See all <ArrowRight size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {summary.length > 0 && (
        <ul className={styles.summary} aria-label="Last 12 months">
          {summary.map(([k, n]) => {
            const Icon = KIND[k].icon;
            return (
              <li key={k}>
                <span className={styles.summaryIcon} style={{ color: KIND[k].color }}>
                  <Icon size={14} aria-hidden="true" />
                </span>
                <strong>{n.toLocaleString('en-US')}</strong> {n === 1 ? KIND[k].one : KIND[k].many}
              </li>
            );
          })}
        </ul>
      )}

      {!compact && <ActivityHeatmap days={days} />}

      {!compact && (
        <div className={styles.filters} role="tablist" aria-label="Show">
          {visibleFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              className={`${styles.filter} ${filter === f.key ? styles.filterOn : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {items === null ? (
        <ul className={styles.feed} aria-hidden="true">
          {Array.from({ length: compact ? 4 : 6 }, (_, i) => (
            <li key={i} className={styles.skeleton} />
          ))}
        </ul>
      ) : items.length === 0 ? (
        <p className={styles.empty}>
          {filter === 'all'
            ? isOwner
              ? 'Nothing yet — rate an anime, hype an upcoming show or write a review and it shows up here.'
              : 'No public activity yet.'
            : 'Nothing here for this filter yet.'}
        </p>
      ) : (
        <div className={styles.groups}>
          {groups.map((g) => (
            <div key={g.label} className={styles.group}>
              <p className={styles.dayLabel}>{g.label}</p>
              <ul className={styles.feed}>
                {g.items.map((it) => {
                  const Icon = KIND[it.kind].icon;
                  const body = (
                    <>
                      <span className={styles.icon} style={{ color: KIND[it.kind].color }}>
                        <Icon size={15} aria-hidden="true" />
                      </span>
                      <span className={styles.text}>
                        <span className={styles.sentence}>
                          <Sentence item={it} />
                        </span>
                        {it.excerpt && <span className={styles.excerpt}>{it.excerpt}</span>}
                        <span className={styles.meta}>
                          {relTime(it.at, now)}
                          {it.private && (
                            <span className={styles.private} title="Only you can see this">
                              <Lock size={10} aria-hidden="true" /> Only you
                            </span>
                          )}
                        </span>
                      </span>
                      <ValueChip item={it} />
                      {it.anime && (
                        <span className={styles.thumb}>
                          <AnimeImage src={it.anime.posterUrl} alt="" fill sizes="44px" />
                        </span>
                      )}
                    </>
                  );
                  return (
                    <li key={it.id}>
                      {it.href ? (
                        <Link href={it.href} className={styles.row}>
                          {body}
                        </Link>
                      ) : (
                        <div className={styles.row}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {!compact && cursor && (
            <button type="button" className={styles.more} onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
