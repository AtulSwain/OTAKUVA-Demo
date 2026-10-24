'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimeImage } from '../anime/AnimeImage';
import { SectionHead } from '../ui/SectionHead';
import { useAuth } from '../../context/AuthContext';
import { HYPE_LEVELS, HYPE_LEVEL_INFO, type HypeCounts, type HypeLevel } from '../../lib/hype/hypeLevels';
import { HYPE_ICONS, HypeBar } from './HypeMeter';
import { HypeFx } from './HypeFx';
import styles from './Hype.module.css';

interface BoardItem {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  type: string | null;
  season: string | null;
  year: number | null;
  premiereAt: string | null;
  premiereText?: string | null;
  counts: HypeCounts;
  total: number;
  percent: number | null;
}

/** "Premieres Nov 20 · in 31 days" — from the stored date only. */
function premiereLabel(item: BoardItem, now: number | null) {
  if (item.premiereAt) {
    const t = new Date(item.premiereAt).getTime();
    const date = new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (now === null) return date;
    const days = Math.ceil((t - now) / 86_400_000);
    return days <= 0 ? `${date} · today` : days === 1 ? `${date} · tomorrow` : `${date} · in ${days} days`;
  }
  if (item.premiereText) return item.premiereText;
  return item.season && item.year ? `${item.season} ${item.year}` : 'Date to be announced';
}

function useBoard(kind: HypeLevel | 'upcoming', limit: number) {
  const { user } = useAuth();
  const [data, setData] = useState<{ items: BoardItem[]; mine: Record<string, HypeLevel> } | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetch(`/api/hype/board?level=${kind}&limit=${limit}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setData(d ?? { items: [], mine: {} }))
      .catch(() => !cancelled && setData({ items: [], mine: {} }));
    return () => {
      cancelled = true;
    };
  }, [kind, limit, user?.id]);
  return data;
}

function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  return now;
}

/** Plain-language copy per level, so nobody has to decode colours. */
const COPY: Record<HypeLevel, { people: string; you: string; tab: string }> = {
  HYPED: { people: 'hyped', you: "You're hyped", tab: 'Upcoming anime people are counting down to' },
  SKIP: { people: 'not hyped', you: "You're not hyped", tab: 'Upcoming anime people are not hyped for' },
};

/** One upcoming anime: poster, premiere, the hype bar and (signed in) your pick. */
export function HypeCard({ item, mine, focus, rank }: { item: BoardItem; mine?: HypeLevel; focus?: HypeLevel; rank?: number }) {
  const now = useNow();
  const MineIcon = mine ? HYPE_ICONS[mine] : null;
  const FocusIcon = focus ? HYPE_ICONS[focus] : null;
  const n = focus ? item.counts[focus] : 0;
  const share = focus && item.total > 0 ? Math.round((n / item.total) * 100) : 0;
  return (
    <Link href={`/anime/${item.slug || item.id}`} className={styles.card}>
      <div className={styles.poster}>
        <AnimeImage src={item.posterUrl} alt={item.title} fill sizes="180px" />
        {rank !== undefined && <span className={styles.rank}>#{rank}</span>}
        <span className={styles.premiereChip}>{premiereLabel(item, now)}</span>
      </div>
      <div className={styles.cardBody}>
        <strong className={styles.cardTitle}>{item.title}</strong>
        {focus && FocusIcon ? (
          <>
            <span className={styles.voteLine} style={{ color: HYPE_LEVEL_INFO[focus].color }}>
              <FocusIcon size={13} aria-hidden={true} />
              <strong>{n}</strong> {n === 1 ? 'person is' : 'people are'} {COPY[focus].people}
            </span>
            <span className={styles.shareBar} aria-hidden="true">
              <span style={{ width: `${share}%`, background: HYPE_LEVEL_INFO[focus].color }} />
            </span>
            <span className={styles.cardMeta}>
              {share}% of {item.total} {item.total === 1 ? 'voter' : 'voters'}
            </span>
          </>
        ) : (
          <>
            <HypeBar counts={item.counts} total={item.total} height={5} />
            <span className={styles.cardMeta}>
              {item.percent !== null
                ? `${item.percent}% hype · ${item.total} votes`
                : item.total > 0
                  ? `${item.total} ${item.total === 1 ? 'vote' : 'votes'} so far`
                  : 'Be the first to vote'}
            </span>
          </>
        )}
        {mine && MineIcon && (
          <span className={styles.youLine} style={{ color: HYPE_LEVEL_INFO[mine].color }}>
            <MineIcon size={12} aria-hidden={true} /> {COPY[mine].you}
          </span>
        )}
      </div>
    </Link>
  );
}

function Rail({ items, mine, focus, ranked }: { items: BoardItem[]; mine: Record<string, HypeLevel>; focus?: HypeLevel; ranked?: boolean }) {
  return (
    <div className={styles.rail}>
      {items.map((i, idx) => (
        <HypeCard key={i.id} item={i} mine={mine[i.id]} focus={focus} rank={ranked ? idx + 1 : undefined} />
      ))}
    </div>
  );
}

function RailSkeleton() {
  return (
    <div className={styles.rail} aria-hidden="true">
      {Array.from({ length: 7 }, (_, i) => (
        <span key={i} className={styles.cardSkeleton} />
      ))}
    </div>
  );
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

const BOARD_TITLE: Record<HypeLevel, string> = {
  HYPED: 'Most Hyped',
  SKIP: 'Not Hyped',
};

/** "Oct 22, 2026 · TV" — exact date when known, else month/year/season. */
function leaderMeta(item: BoardItem) {
  const when = item.premiereAt
    ? new Date(item.premiereAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : item.premiereText || (item.season && item.year ? `${item.season} ${item.year}` : 'Date TBA');
  return [when, item.type].filter(Boolean).join(' · ');
}

/** "in 2 days" / "tomorrow" — only for an exact upcoming date. */
function countdown(item: BoardItem, now: number | null) {
  if (!item.premiereAt || now === null) return null;
  const days = Math.ceil((new Date(item.premiereAt).getTime() - now) / 86_400_000);
  return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
}

/** Counts up from 0 to `target` once shown (instant under reduced motion). */
function useCountUp(target: number, ms = 800) {
  const [v, setV] = useState(target);
  useEffect(() => {
    if (typeof window === 'undefined' || window.matchMedia('(prefers-reduced-motion: reduce)').matches || target <= 0) {
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    setV(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

/** One ranked upcoming anime: poster with rank + countdown tags, title, gauge. */
function LeaderCard({ item, rank, level, mine }: { item: BoardItem; rank: number; level: HypeLevel; mine?: HypeLevel }) {
  const now = useNow();
  const Icon = HYPE_ICONS[level];
  const n = item.counts[level];
  const shownN = useCountUp(n);
  const soon = countdown(item, now);
  return (
    <Link href={`/anime/${item.slug || item.id}`} className={styles.lbCard}>
      <span className={styles.lbPoster}>
        <AnimeImage src={item.posterUrl} alt={item.title} fill sizes="190px" />
        <span className={`${styles.lbRank} ${rank === 1 ? styles.lbGold : rank === 2 ? styles.lbSilver : rank === 3 ? styles.lbBronze : ''}`}>
          {String(rank).padStart(2, '0')}
        </span>
        {soon && <span className={styles.lbSoon}>{soon}</span>}
        {/* Top-right on the poster: the level's icon + exact count (owner, 2026-10-22). */}
        <span
          className={`${styles.lbCount} ${styles['lbCount' + level] ?? ''} ${mine === level ? styles.lbCountMine : ''}`}
          style={{ ['--c' as string]: HYPE_LEVEL_INFO[level].color, ['--d' as string]: `${Math.min(rank - 1, 10) * 70}ms` }}
          title={`${n.toLocaleString('en-US')} ${n === 1 ? 'person is' : 'people are'} ${COPY[level].people}${mine === level ? ' — including you' : ''}`}
        >
          {/* Same flame / haze as the level's button, running inside the pill. */}
          <HypeFx level={level} active />
          <Icon size={13} aria-hidden={true} className={styles.lbCountIcon} />
          {/* Exact count — never rounded (owner: "perfect accuracy"); counts up on show. */}
          <strong>{shownN.toLocaleString('en-US')}</strong>
        </span>
      </span>
      <span className={styles.lbInfo}>
        <strong className={styles.lbTitle}>{item.title}</strong>
        <span className={styles.lbMeta}>{leaderMeta(item)}</span>
      </span>
    </Link>
  );
}

/**
 * Homepage hype leaderboard (2026-10-20; two levels since 2026-10-22): "Most Hyped / Not Hyped"
 * in the site's own section style — a row of level buttons and tall
 * poster cards (gradient rank tag, countdown tag, ten-segment gauge of how
 * much of that show's vote is this feeling). Sits straight on the page, no
 * panel. Only anime that got that vote appear; blank until someone votes.
 */
export function HypeBoard() {
  const [level, setLevel] = useState<HypeLevel>('HYPED');
  const board = useBoard(level, 20);
  const railRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const measure = () => {
    const el = railRef.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [board]);
  const scrollBy = (dir: 1 | -1) => {
    const el = railRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  };

  return (
    <section className={styles.block} aria-labelledby="hype-leaderboard">
      <div className={styles.lbHead}>
        <div>
          <p className={styles.lbKicker}>Hype meter</p>
          <h2 className={styles.lbHeading} id="hype-leaderboard">
            {BOARD_TITLE[level]}
          </h2>
          <p className={styles.lbSummary}>
            <i style={{ background: HYPE_LEVEL_INFO[level].color }} aria-hidden="true" />
            {HYPE_LEVEL_INFO[level].hint}
            {board && board.items.length > 0 && (
              <>
                {' · '}
                {board.items.length} anime ·{' '}
                {(() => {
                  const votes = board.items.reduce((sum, it) => sum + it.counts[level], 0);
                  return `${votes.toLocaleString('en-US')} ${HYPE_LEVEL_INFO[level].label.toLowerCase()} ${votes === 1 ? 'vote' : 'votes'}`;
                })()}
              </>
            )}
          </p>
        </div>
        <div className={styles.lbControls}>
        <div className={styles.lbLevels} role="tablist" aria-label="Rank by">
          {HYPE_LEVELS.map((l) => {
            const Icon = HYPE_ICONS[l];
            const on = l === level;
            return (
              <button
                key={l}
                type="button"
                role="tab"
                aria-selected={on}
                className={`${styles.lbLevel} ${on ? styles.lbLevelOn : ''}`}
                style={{ ['--c' as string]: HYPE_LEVEL_INFO[l].color }}
                onClick={() => setLevel(l)}
                title={HYPE_LEVEL_INFO[l].label}
              >
                <HypeFx level={l} active={on} />
                <Icon size={15} aria-hidden={true} className={styles.lbLevelIcon} />
                <span className={styles.lbLevelText}>{HYPE_LEVEL_INFO[l].label}</span>
              </button>
            );
          })}
        </div>
        {board && board.items.length > 0 && !(edges.start && edges.end) && (
          <span className={styles.lbArrows}>
            <button type="button" className={styles.lbArrow} onClick={() => scrollBy(-1)} disabled={edges.start} aria-label="Scroll back">
              <ChevronLeft size={16} />
            </button>
            <button type="button" className={styles.lbArrow} onClick={() => scrollBy(1)} disabled={edges.end} aria-label="Scroll forward">
              <ChevronRight size={16} />
            </button>
          </span>
        )}
        </div>
      </div>

      {!board ? (
        <div className={styles.rail} aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className={styles.cardSkeleton} />
          ))}
        </div>
      ) : board.items.length > 0 ? (
        <div className={styles.rail} ref={railRef} onScroll={measure} key={level}>
          {board.items.map((item, i) => (
            <LeaderCard key={item.id} item={item} rank={i + 1} level={level} mine={board.mine[item.id]} />
          ))}
        </div>
      ) : (
        <div className={styles.lbEmpty} style={{ ['--c' as string]: HYPE_LEVEL_INFO[level].color }}>
          <span className={styles.lbEmptyIcon}>{React.createElement(HYPE_ICONS[level], { size: 20, 'aria-hidden': true })}</span>
          <p className={styles.leaderEmpty}>
            Quiet so far. Open any upcoming anime and call it <strong>{HYPE_LEVEL_INFO[level].label}</strong> — your pick shows up here
            for everyone.
          </p>
        </div>
      )}
    </section>
  );
}

/** Homepage "Upcoming anime": what premieres next, soonest first, with each show's hype. */
export function UpcomingRail() {
  const data = useBoard('upcoming', 20);
  if (data && data.items.length === 0) return null;
  return (
    <section className={styles.block} aria-labelledby="upcoming-anime">
      <SectionHead kicker="Premiering soon" title="Upcoming anime" id="upcoming-anime" href="/upcoming" linkLabel="All upcoming" />
      {data ? <Rail items={data.items} mine={data.mine} /> : <RailSkeleton />}
    </section>
  );
}
