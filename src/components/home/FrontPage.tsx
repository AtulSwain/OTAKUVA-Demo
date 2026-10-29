'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BadgeCheck, CalendarDays, ChevronLeft, ChevronRight, Heart, MessageCircle, MessageSquare, Search, Star, Users } from 'lucide-react';
import { retentionColor, retentionLabel } from '../../lib/rating/retentionTone';
import { PeakedAt } from '../rating/PeakedAt';
import { AnimeImage } from '../anime/AnimeImage';
import { UserAvatar } from '../ui/UserAvatar';
import Seal from '../badges/Seal';
import { resolveMediaUrl } from '../../lib/mediaResolver';
import type { FrontPageData } from '../../lib/home/frontPage';
import type { ReleaseScheduleItem } from './ReleaseSchedule';
import { TypedName } from './TypedName';
import { CommunityScoreBadge } from '../rating/CommunityScoreBadge';
import { SeasonScene } from './SeasonScene';
import styles from './FrontPage.module.css';

const whole = new Intl.NumberFormat('en-US');
const DATE_UTC = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** "now" after mount only: times depend on the viewer's clock and timezone. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

function ago(iso: string, now: Date | null) {
  if (!now) return DATE_UTC.format(new Date(iso));
  const s = Math.max(0, (now.getTime() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return DATE_UTC.format(new Date(iso));
}

/** Section heading in the site's usual style: kicker with the accent bar, title, "see all" link. */
export function SectionHead({ kicker, title, href, linkLabel, id }: { kicker: string; title: string; href?: string; linkLabel?: string; id?: string }) {
  return (
    <div className={styles.head}>
      <div>
        <p className={styles.kicker}>{kicker}</p>
        <h2 className={styles.title} id={id}>{title}</h2>
      </div>
      {href && (
        <Link href={href} className={styles.more}>
          {linkLabel || 'See all'} <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

/* ───────────────────────── Masthead ───────────────────────── */

/**
 * A real count rolling up from 0 when the welcome masthead appears (ease-out,
 * ~1.2s, after the greeting). Renders the final number on the server and for
 * reduced motion; the stats row is still hidden by its fade-in when it resets.
 */
function CountUp({ to }: { to: number }) {
  const [value, setValue] = useState(to);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setValue(to);
      return;
    }
    let raf = 0;
    let start = 0;
    const DELAY = 700;
    const DURATION = 1200;
    setValue(0);
    const tick = (t: number) => {
      if (!start) start = t;
      const p = Math.min(1, Math.max(0, (t - start - DELAY) / DURATION));
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span aria-label={whole.format(to)}>{whole.format(value)}</span>;
}

export function Masthead({ data, username, displayName = null, onJoin }: { data: FrontPageData; username: string | null; displayName?: string | null; onJoin: () => void }) {
  const router = useRouter();
  const now = useNow(3_600_000);
  const [q, setQ] = useState('');
  const dateLine = now
    ? now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : null;
  // Zero counts are left out until there's something to count.
  const stats = ([
    [data.stats.anime, 'anime'],
    [data.stats.people, 'creators & cast'],
    [data.stats.reviews, data.stats.reviews === 1 ? 'review' : 'reviews'],
    [data.stats.discussions, data.stats.discussions === 1 ? 'discussion' : 'discussions'],
    [data.stats.members, data.stats.members === 1 ? 'member' : 'members'],
  ] as [number, string][]).filter(([n]) => n > 0);

  return (
    <header className={`${styles.masthead} ${username ? styles.welcome : ''}`}>
      {/* Signed in: a soft light sweeps across once the greeting lands. */}
      {username && <span className={styles.welcomeSheen} aria-hidden="true" />}
      {/* Seasonal artwork (2026-10-27): fall maple, spring sakura, … */}
      <SeasonScene season={data.season.season} />
      <p className={styles.dateline}>
        <span suppressHydrationWarning>{dateLine ?? ' '}</span>
        <span className={styles.dot} aria-hidden="true" />
        <Link href="/seasonal">{data.season.season} {data.season.year} season</Link>
      </p>
      <h1 className={`${styles.mastheadTitle} ${username ? styles.welcomeIn : ''}`}>
        {username ? (
          // "Welcome" and "back," blur in one after the other, then the name types itself (TypedName).
          <>
            <span className={styles.welcomeWord}>Welcome</span>{' '}
            <span className={styles.welcomeWord} style={{ animationDelay: '0.12s' }}>back,</span>{' '}
            {displayName ? (
              <>
                <TypedName text={displayName} />{' '}
                <span className={`${styles.mastheadHandle} ${styles.handleIn}`}>@{username}</span>
              </>
            ) : (
              <TypedName text={`@${username}`} />
            )}
          </>
        ) : (
          <>The anime world, <em>catalogued</em> and <em>talked about</em>.</>
        )}
      </h1>

      <form
        className={styles.search}
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          const term = q.trim();
          router.push(term ? `/search?q=${encodeURIComponent(term)}` : '/anime');
        }}
      >
        <Search size={18} aria-hidden="true" className={styles.searchIcon} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search anime, creators, studios…"
          aria-label="Search OTAKUVA"
        />
        <button type="submit">Search</button>
      </form>

      <div className={styles.mastheadFoot}>
        <ul className={styles.stats} aria-label="OTAKUVA in numbers">
          {stats.map(([n, label]) => (
            <li key={label}>
              <strong>{username ? <CountUp to={n} /> : whole.format(n)}</strong>
              <span>{label}</span>
            </li>
          ))}
        </ul>
        {!username && (
          <div className={styles.mastheadCtas}>
            <button type="button" className={styles.primaryBtn} onClick={onJoin}>
              Join OTAKUVA
            </button>
            <Link href="/anime" className={styles.ghostBtn}>
              Explore the catalog
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}

/* ───────────────────────── On air ───────────────────────── */

const pad = (n: number) => String(n).padStart(2, '0');


type AirItem = ReleaseScheduleItem & { episodeTo: number };

/** Episodes of one show released at the same moment (a whole-season drop) become one row. */
function mergeDrops(list: ReleaseScheduleItem[]): AirItem[] {
  const out: AirItem[] = [];
  const byKey = new Map<string, AirItem>();
  for (const i of list) {
    const key = `${i.anime.id}|${i.airingAt}`;
    const seen = byKey.get(key);
    if (seen) {
      seen.episode = Math.min(seen.episode, i.episode);
      seen.episodeTo = Math.max(seen.episodeTo, i.episode);
      continue;
    }
    const item = { ...i, episodeTo: i.episode };
    byKey.set(key, item);
    out.push(item);
  }
  return out;
}

const episodeLabel = (i: AirItem) =>
  `${i.episodeTo > i.episode ? `Episodes ${i.episode}–${i.episodeTo}` : `Episode ${i.episode}`}${i.anime.totalEpisodes ? ` of ${i.anime.totalEpisodes}` : ''}`;

/** "Premiering soon" window: everything airing within this long gets a big card. */
const SOON_MS = 2 * 60 * 60 * 1000;

/** h:mm:ss to air, ticking every second; plus a bar that fills as the premiere approaches. */
function SoonTimer({ to }: { to: string }) {
  const now = useNow(1000);
  const ms = now ? Math.max(0, new Date(to).getTime() - now.getTime()) : null;
  const text =
    ms === null
      ? '--:--:--'
      : ms === 0
        ? 'Airing now'
        : `${Math.floor(ms / 3_600_000)}:${pad(Math.floor((ms % 3_600_000) / 60_000))}:${pad(Math.floor((ms % 60_000) / 1000))}`;
  const fill = ms === null ? 0 : Math.min(100, Math.max(0, 100 - (ms / SOON_MS) * 100));
  return (
    <span className={styles.soonTimer}>
      <strong role="timer">{text}</strong>
      <span className={styles.soonBar} aria-hidden="true">
        <span style={{ width: `${fill}%` }} />
      </span>
    </span>
  );
}

/**
 * "On air" (2026-10-26, owner): episodes premiering within 2 hours get big
 * side-by-side cards with a live countdown; everything else is a list —
 * Up next and Just aired — with bigger rows than before. Aired rows link
 * straight to the Episode Guide to rate.
 */
export function OnAir({ items }: { items: ReleaseScheduleItem[] }) {
  const now = useNow();
  const railRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const { aired, soon, later, todayCount } = useMemo(() => {
    if (!now) return { aired: [] as AirItem[], soon: [] as AirItem[], later: [] as AirItem[], todayCount: 0 };
    const t = now.getTime();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfDay = startOfDay + 86_400_000;
    const upcoming = mergeDrops(items.filter((i) => new Date(i.airingAt).getTime() > t));
    return {
      aired: mergeDrops(items.filter((i) => new Date(i.airingAt).getTime() <= t).sort((a, b) => b.airingAt.localeCompare(a.airingAt))).slice(0, 8),
      soon: upcoming.filter((i) => new Date(i.airingAt).getTime() - t <= SOON_MS),
      later: upcoming.filter((i) => new Date(i.airingAt).getTime() - t > SOON_MS).slice(0, 8),
      todayCount: items.filter((i) => {
        const at = new Date(i.airingAt).getTime();
        return at >= startOfDay && at < endOfDay;
      }).length,
    };
  }, [items, now]);

  const measure = () => {
    const el = railRef.current;
    if (el) setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  };
  useEffect(() => {
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [soon.length]);
  if (items.length === 0) return null;

  const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const dayLabel = (iso: string) => {
    if (!now) return '';
    const d = new Date(iso);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const that = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diff = Math.round((that - today) / 86_400_000);
    return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : d.toLocaleDateString([], { weekday: 'short' });
  };
  const until = (iso: string) => {
    const mins = Math.max(1, Math.round((new Date(iso).getTime() - (now?.getTime() ?? 0)) / 60000));
    if (mins < 60) return `in ${mins}m`;
    const h = Math.floor(mins / 60);
    return h < 24 ? `in ${h}h ${mins % 60}m` : `in ${Math.floor(h / 24)}d`;
  };
  const scrollBy = (dir: 1 | -1) => railRef.current?.scrollBy({ left: dir * railRef.current.clientWidth * 0.85, behavior: 'smooth' });

  const row = (i: AirItem, kind: 'next' | 'aired') => (
    <li key={i.id}>
      <Link href={`/anime/${i.anime.slug}${kind === 'aired' ? '#episodes' : ''}`} className={styles.airRow}>
        <span className={styles.airThumb}>{i.anime.posterUrl && <AnimeImage src={i.anime.posterUrl} alt="" fill sizes="64px" />}</span>
        <span className={styles.airText}>
          <strong>{i.anime.title}</strong>
          <span>
            {episodeLabel(i)}
            {i.anime.type ? ` · ${i.anime.type}` : ''}
          </span>
        </span>
        <span className={styles.airWhen}>
          {kind === 'next' ? (
            <>
              <span className={styles.airPill}>{until(i.airingAt)}</span>
              <small>
                {dayLabel(i.airingAt)} · {time(i.airingAt)}
              </small>
            </>
          ) : (
            <>
              <span className={styles.airRate}>Rate</span>
              <small>{ago(i.airingAt, now!)}</small>
            </>
          )}
        </span>
      </Link>
    </li>
  );

  return (
    <section className={styles.onAir} aria-labelledby="on-air">
      <SectionHead kicker="On air" title="This week's episodes" id="on-air" href="/schedule" linkLabel="Full schedule" />
      {!now ? (
        <div className={styles.airSkeleton} aria-hidden="true" />
      ) : (
        <>
          {soon.length > 0 && (
            <div className={styles.soonBlock}>
              <div className={styles.airBar}>
                <h3 className={styles.colTitle}>
                  <span className={styles.liveDot} aria-hidden="true" /> Premiering within 2 hours
                </h3>
                {!(edges.start && edges.end) && (
                  <span className={styles.airArrows}>
                    <button type="button" onClick={() => scrollBy(-1)} disabled={edges.start} aria-label="Scroll back">
                      <ChevronLeft size={16} />
                    </button>
                    <button type="button" onClick={() => scrollBy(1)} disabled={edges.end} aria-label="Scroll forward">
                      <ChevronRight size={16} />
                    </button>
                  </span>
                )}
              </div>
              <div className={styles.airRail} ref={railRef} onScroll={measure}>
                {soon.map((i) => (
                  <article key={i.id} className={`${styles.airCard} ${styles.airCardSoon}`}>
                    <Link href={`/anime/${i.anime.slug}`} className={styles.airCardPoster} aria-label={i.anime.title}>
                      {i.anime.posterUrl && <AnimeImage src={i.anime.posterUrl} alt="" fill sizes="160px" />}
                    </Link>
                    <div className={styles.airCardBody}>
                      <span className={styles.airCardWhen}>
                        {dayLabel(i.airingAt)} · {time(i.airingAt)}
                      </span>
                      <Link href={`/anime/${i.anime.slug}`} className={styles.airCardTitle}>
                        {i.anime.title}
                      </Link>
                      <span className={styles.airCardEp}>
                        {episodeLabel(i)}
                        {i.anime.type ? ` · ${i.anime.type}` : ''}
                      </span>
                      <div className={styles.airCardFoot}>
                        <SoonTimer to={i.airingAt} />
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className={styles.airCols}>
            <div className={styles.airPanel}>
              <h3 className={styles.colTitle}>
                <CalendarDays size={14} aria-hidden="true" /> Up next
              </h3>
              {later.length ? <ul className={styles.airList}>{later.map((i) => row(i, 'next'))}</ul> : <p className={styles.muted}>Nothing else scheduled yet.</p>}
            </div>
            <div className={styles.airPanel}>
              <h3 className={styles.colTitle}>
                <span className={styles.liveDot} aria-hidden="true" /> Just aired
              </h3>
              {aired.length ? <ul className={styles.airList}>{aired.map((i) => row(i, 'aired'))}</ul> : <p className={styles.muted}>Nothing aired in the last day.</p>}
            </div>
          </div>

          {todayCount > 0 && (
            <p className={styles.airSummary}>
              <strong>{todayCount}</strong> {todayCount === 1 ? 'episode airs' : 'episodes air'} today in your time zone.{' '}
              <Link href="/schedule">See the full day →</Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}

/* ───────────────────────── Reviews ───────────────────────── */

/** A tick + "Creator review" (owner, 2026-10-27: just that — no side bar, no channel). */
function CreatorChip({ channel, label = 'Creator review' }: { channel?: string | null; label?: string }) {
  return (
    <span className={styles.creatorChip} title={channel ? `Content creator · ${channel}` : 'Content creator'}>
      <BadgeCheck size={13} aria-hidden="true" className={styles.creatorTick} /> {label}
    </span>
  );
}

export function LatestReviews({
  reviews,
  episodeNotes = [],
}: {
  reviews: FrontPageData['reviews'];
  /** Creators' latest episode ratings with a comment (2026-10-25). */
  episodeNotes?: FrontPageData['creatorEpisodeNotes'];
}) {
  const now = useNow();
  if (reviews.length === 0 && episodeNotes.length === 0) return null;
  return (
    <section className={styles.block} aria-labelledby="latest-reviews">
      <SectionHead kicker="From members & creators" title="Latest reviews" id="latest-reviews" href="/rankings" linkLabel="Top rated" />

      {/* Creators rating an episode with a comment — highlighted. */}
      {episodeNotes.length > 0 && (
        <div className={styles.creatorNotes}>
          {episodeNotes.map((n) => (
            <article key={n.id} className={`${styles.review} ${styles.reviewCreator}`}>
              <Link href={`/anime/${n.anime.slug}#retention`} className={styles.reviewAnime}>
                <span className={styles.reviewPoster}>{n.anime.posterUrl && <AnimeImage src={n.anime.posterUrl} alt="" fill sizes="44px" />}</span>
                <span className={styles.reviewAnimeText}>
                  <span className={styles.reviewOf}>Rated episode {n.episodeNumber} of</span>
                  <strong>{n.anime.title}</strong>
                </span>
                <span className={styles.noteScore} style={{ color: retentionColor(n.retention) }}>
                  {n.retention}% <small>{retentionLabel(n.retention)}</small>
                </span>
              </Link>
              {n.comment && <blockquote className={styles.quote}>{n.comment}</blockquote>}
              <footer className={styles.reviewFoot}>
                <Link href={`/profile/${encodeURIComponent(n.user.username)}`} className={styles.reviewer}>
                  <UserAvatar username={n.user.username} avatarUrl={n.user.avatarUrl} size={26} />
                  <span>@{n.user.username}</span>
                  <CreatorChip channel={n.user.channelName} label="Creator" />
                </Link>
                <span className={styles.reviewMeta} suppressHydrationWarning>
                  {ago(n.at, now)}
                </span>
              </footer>
            </article>
          ))}
        </div>
      )}

      <div className={styles.reviewGrid}>
        {reviews.slice(0, 4).map((r) => (
          <article key={r.id} className={`${styles.review} ${r.user.isCreator ? styles.reviewCreator : ''}`}>
            <Link href={`/anime/${r.anime.slug}#reviews`} className={styles.reviewAnime}>
              <span className={styles.reviewPoster}>{r.anime.posterUrl && <AnimeImage src={r.anime.posterUrl} alt="" fill sizes="44px" />}</span>
              <span className={styles.reviewAnimeText}>
                <span className={styles.reviewOf}>Review of</span>
                <strong>{r.anime.title}</strong>
              </span>
              {/* The anime's community retention (was the reviewer's 1–10 star, 2026-10-25). */}
              <PeakedAt animeId={r.anime.id} />
            </Link>
            {r.excerpt ? (
              <blockquote className={styles.quote}>{r.excerpt}</blockquote>
            ) : (
              <p className={styles.spoiler}>Contains spoilers — read it on the anime page.</p>
            )}
            <footer className={styles.reviewFoot}>
              <Link href={`/profile/${encodeURIComponent(r.user.username)}`} className={styles.reviewer}>
                <UserAvatar username={r.user.username} avatarUrl={r.user.avatarUrl} size={26} />
                <span>@{r.user.username}</span>
                {r.user.isCreator ? <CreatorChip channel={r.user.channelName} /> : <Seal tier={r.tier} size={20} decorative />}
              </Link>
              <span className={styles.reviewMeta}>
                {r.likes > 0 && (
                  <>
                    <Heart size={12} aria-hidden="true" /> {r.likes} ·{' '}
                  </>
                )}
                <span suppressHydrationWarning>{ago(r.createdAt, now)}</span>
              </span>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Rankings ───────────────────────── */

type RankItem = FrontPageData['rankings']['mostPopular'][number];

function RankTable({ title, items, metric, href }: { title: string; items: RankItem[]; metric: 'trackers' | 'score'; href: string }) {
  return (
    <div className={styles.rankCard}>
      <div className={styles.rankHead}>
        <h3>{title}</h3>
        <Link href={href} className={styles.more}>
          Full list <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>
      <ol className={styles.rankList}>
        {items.map((a, i) => (
          <li key={a.id}>
            <Link href={`/anime/${a.slug}`} className={styles.rankRow}>
              <span className={`${styles.rankNo} ${i === 0 ? styles.rankGold : i === 1 ? styles.rankSilver : i === 2 ? styles.rankBronze : ''}`}>{i + 1}</span>
              <span className={styles.rankThumb}><AnimeImage src={a.posterUrl} alt="" fill sizes="34px" /></span>
              <span className={styles.rankText}>
                <strong>{a.title}</strong>
                <span>{[a.type, a.year, a.genres.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</span>
              </span>
              <span className={styles.rankMetric}>
                {metric === 'trackers' ? (
                  <>
                    {whole.format(a.trackers)}
                    <small>tracking</small>
                  </>
                ) : (
                  // Members' OTAKUVA score + retention (blank until someone rates).
                  <CommunityScoreBadge animeId={a.id} />
                )}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Rankings({ rankings }: { rankings: FrontPageData['rankings'] }) {
  if (!rankings.mostPopular.length && !rankings.highestRated.length) return null;
  return (
    <section className={styles.block} aria-labelledby="rankings">
      <SectionHead kicker="Charts" title="Rankings" id="rankings" href="/rankings" linkLabel="All rankings" />
      <div className={`${styles.rankGrid} ${rankings.mostPopular.length && rankings.highestRated.length ? '' : styles.rankSolo}`}>
        {rankings.mostPopular.length > 0 && <RankTable title="Most popular on OTAKUVA" items={rankings.mostPopular} metric="trackers" href="/top-picks?tab=viewed" />}
        {rankings.highestRated.length > 0 && <RankTable title="Highest rated" items={rankings.highestRated} metric="score" href="/top-picks?tab=top100" />}
      </div>
    </section>
  );
}

/* ───────────────────────── This season ───────────────────────── */

export function ThisSeason({ season }: { season: FrontPageData['season'] }) {
  if (season.items.length === 0) return null;
  return (
    <section className={styles.block} aria-labelledby="this-season">
      <SectionHead
       
        kicker={`${whole.format(season.total)} titles`}
        title={`${season.season} ${season.year}`}
        id="this-season"
        href="/seasonal"
        linkLabel="Season chart"
      />
      <div className={styles.seasonRow}>
        {season.items.map((a) => (
          <Link key={a.id} href={`/anime/${a.slug}`} className={styles.seasonCard}>
            <span className={styles.seasonPoster}>
              <AnimeImage src={a.posterUrl} alt={a.title} fill sizes="150px" />
              {/* Members' OTAKUVA score + retention (not the provider score). */}
              <CommunityScoreBadge animeId={a.id} variant="overlay" />
            </span>
            <strong>{a.title}</strong>
            <span>{a.genres.slice(0, 2).join(' · ')}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── News ───────────────────────── */

type NewsItem = { id: string; slug: string; title: string; summary?: string; imageUrl?: string | null; source: string; date: string; category: string };

export function NewsDesk({ news }: { news: NewsItem[] }) {
  if (news.length === 0) return null;
  // Lead with the newest story that has a picture; the rest become headlines.
  const lead = news.find((n) => n.imageUrl) ?? news[0];
  const rest = news.filter((n) => n !== lead);
  return (
    <section className={styles.block} aria-labelledby="news-desk">
      <SectionHead kicker="Newsroom" title="Anime news" id="news-desk" href="/news" linkLabel="All news" />
      <div className={styles.newsGrid}>
        <Link href={`/news/${lead.slug || lead.id}`} className={styles.newsLead}>
          {lead.imageUrl && (
            <span className={styles.newsLeadImg}>
              <AnimeImage src={lead.imageUrl} alt="" fill sizes="(max-width: 900px) 100vw, 40vw" />
            </span>
          )}
          <span className={styles.newsCat}>{lead.category}</span>
          <strong>{lead.title}</strong>
          {lead.summary && <p>{lead.summary}</p>}
          <span className={styles.newsMeta}>
            {lead.source} · {DATE_UTC.format(new Date(lead.date))}
          </span>
        </Link>
        <ul className={styles.headlines}>
          {rest.slice(0, 4).map((n) => (
            <li key={n.id}>
              <Link href={`/news/${n.slug || n.id}`}>
                <span className={styles.newsCat}>{n.category}</span>
                <strong>{n.title}</strong>
                <span className={styles.newsMeta}>
                  {n.source} · {DATE_UTC.format(new Date(n.date))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ───────────────────────── Sidebar ───────────────────────── */

export function TrendingDiscussions({ items }: { items: FrontPageData['discussions'] }) {
  const now = useNow();
  return (
    <section className={styles.side} aria-labelledby="side-talk">
      <SectionHead kicker="Community" title="Trending talk" id="side-talk" href="/discussions" linkLabel="All" />
      {items.length ? (
        <ul className={styles.threadList}>
          {items.map((d) => (
            <li key={d.id}>
              <Link href={`/discussions/${d.id}`} className={styles.thread}>
                <strong>{d.title}</strong>
                <span>
                  {[d.anime?.title || d.community?.name, d.author ? `@${d.author.username}` : null].filter(Boolean).join(' · ')}
                </span>
                <span className={styles.threadStats}>
                  <MessageCircle size={12} aria-hidden="true" /> {d.replies} · <span suppressHydrationWarning>{ago(d.updatedAt, now)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>No threads yet — start the first one.</p>
      )}
    </section>
  );
}

export function MemberArticles({ items }: { items: FrontPageData['articles'] }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.side} aria-labelledby="side-articles">
      <SectionHead kicker="Written by members" title="Articles" id="side-articles" href="/articles" linkLabel="All" />
      <ul className={styles.threadList}>
        {items.map((a) => (
          <li key={a.id}>
            <Link href={`/articles/${a.slug}`} className={styles.thread}>
              <strong>{a.title}</strong>
              <span>{['@' + a.author, a.anime].filter(Boolean).join(' · ')}</span>
              <span className={styles.threadStats}>
                <Heart size={12} aria-hidden="true" /> {a.likeCount} · <MessageSquare size={12} aria-hidden="true" /> {a.commentCount}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CommunitiesToJoin({ items }: { items: FrontPageData['communities'] }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.side} aria-labelledby="side-communities">
      <SectionHead kicker="Find your people" title="Communities" id="side-communities" href="/community" linkLabel="All" />
      <ul className={styles.commList}>
        {items.map((c) => (
          <li key={c.id}>
            <Link href={`/community/${c.slug}`} className={styles.comm}>
              <span className={styles.commIcon} aria-hidden="true">
                {c.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={resolveMediaUrl(c.iconUrl) || undefined} alt="" />
                ) : (
                  <Users size={16} />
                )}
              </span>
              <span className={styles.commText}>
                <strong>{c.name}</strong>
                <span>
                  {whole.format(c.memberCount)} {c.memberCount === 1 ? 'member' : 'members'}
                  {c.about ? ` · ${c.about}` : ''}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OnThisDay({ items }: { items: FrontPageData['onThisDay'] }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.side} aria-labelledby="side-history">
      <SectionHead kicker="Anime history" title="This week in history" id="side-history" />
      <ul className={styles.historyList}>
        {items.map((a) => (
          <li key={a.id}>
            <Link href={`/anime/${a.slug}`} className={styles.history}>
              <span className={styles.historyYear}>{new Date(a.premiered).getUTCFullYear()}</span>
              <span className={styles.historyText}>
                <strong>{a.title}</strong>
                <span>
                  premiered {DATE_UTC.format(new Date(a.premiered)).replace(/, \d{4}$/, '')}, {a.yearsAgo} {a.yearsAgo === 1 ? 'year' : 'years'} ago{a.today ? ' today' : ''}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StudiosToExplore({ items }: { items: FrontPageData['studios'] }) {
  if (items.length === 0) return null;
  return (
    <section className={styles.side} aria-labelledby="side-studios">
      <SectionHead kicker="Database" title="Studios" id="side-studios" href="/studios" linkLabel="All" />
      <ul className={styles.studioList}>
        {items.map((s) => (
          <li key={s.id}>
            <Link href={`/studios/${s.slug}`}>
              <strong>{s.name}</strong>
              <span>{whole.format(s.works)} works</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function GenreIndex({ genres }: { genres: FrontPageData['genres'] }) {
  if (genres.length === 0) return null;
  return (
    <section className={styles.block} aria-labelledby="genre-index">
      <SectionHead kicker="Browse" title="By genre" id="genre-index" href="/browse" linkLabel="All categories" />
      <ul className={styles.genres}>
        {genres.map((g) => (
          <li key={g.slug}>
            <Link href={`/anime?genre=${encodeURIComponent(g.name)}`}>
              {g.name}
              <span>{whole.format(g.count)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
