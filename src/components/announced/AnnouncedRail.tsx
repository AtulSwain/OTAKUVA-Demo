'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Building2, CalendarDays, ChevronRight, Sparkles } from 'lucide-react';
import type { AnnouncedAnime } from '../../lib/announcements/announcedAnime';
import { isWideBanner, trailerStills } from '../../lib/media/heroArt';
import { SectionHead } from '../ui/SectionHead';
import { sourceLabel } from './AnnouncedCard';
import styles from './Announced.module.css';

const LIST_COUNT = 6;

function metaLine(a: AnnouncedAnime): string {
  const src = sourceLabel(a.source);
  return [a.type, src].filter(Boolean).join(' · ');
}

const mainStudio = (a: AnnouncedAnime) => a.studios[0]?.name ?? null;

/** How long each announcement stays in the big card. */
const SLIDE_MS = 6000;
/** How often the open page checks for newer announcements (only while the tab is visible). */
const POLL_MS = 5 * 60 * 1000;

/**
 * Homepage "Just Announced" (2026-11-01): front-page layout like the rest of
 * the homepage — a big card with art and a hairline list beside it. The big
 * card is a slider: it moves through the announcements one by one (6s each),
 * shown by a row of thin lines on top, one per announcement, that fill in
 * turn (tap one to jump there). It pauses while hovered or focused, follows
 * the row you hover in the list, swipes on phones, and doesn't auto-advance
 * under "reduce motion" (the line never runs, so it never ends). No slide
 * counter and no arrows (owner, 2026-11-02).
 * Always newest first (the API's order), and it re-checks every few minutes
 * while the tab is open, so a new announcement appears at the top by itself.
 */
export function AnnouncedRail() {
  const [items, setItems] = useState<AnnouncedAnime[] | null>(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  // Bumped on every change so the slide timer restarts.
  const [cycle, setCycle] = useState(0);
  const touchX = useRef<number | null>(null);
  const firstId = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/announced?limit=${LIST_COUNT + 1}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (!alive) return;
          if (!d) {
            setItems((prev) => prev ?? []);
            return;
          }
          const next: AnnouncedAnime[] = Array.isArray(d.items) ? d.items : [];
          // Something newer arrived: show it straight away.
          if (firstId.current !== null && next[0] && next[0].id !== firstId.current) {
            setActive(0);
            setCycle((c) => c + 1);
          }
          firstId.current = next[0]?.id ?? null;
          setItems(next);
        })
        .catch(() => alive && setItems((prev) => prev ?? []));
    void load();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  // The very latest announcement first, then the rest in order.
  const slides = useMemo(() => (items ?? []).slice(0, LIST_COUNT + 1), [items]);

  const go = useCallback(
    (i: number) => {
      if (slides.length === 0) return;
      setActive(((i % slides.length) + slides.length) % slides.length);
      setCycle((c) => c + 1);
    },
    [slides.length]
  );

  if (items && items.length === 0) return null;

  const current = slides[active];

  return (
    <section className={styles.block} aria-labelledby="home-announced">
      <SectionHead kicker="Studio news" title="Just Announced" id="home-announced" href="/announced" linkLabel="All announcements" />
      {!items || !current ? (
        <div className={styles.desk} aria-hidden="true">
          <div className={`${styles.skeleton} ${styles.deskLeadSkeleton}`} />
          <div className={styles.deskList}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={`${styles.skeleton} ${styles.rowSkeleton}`} />
            ))}
          </div>
        </div>
      ) : (
        // Pointer anywhere over the card or the list pauses the slider.
        <div className={styles.desk} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div
            className={`${styles.stage} ${paused ? styles.stagePaused : ''}`}
            role="region"
            aria-roledescription="carousel"
            aria-label="Latest announcements"
            onFocus={() => setPaused(true)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setPaused(false);
            }}
            onTouchStart={(e) => {
              touchX.current = e.touches[0]?.clientX ?? null;
            }}
            onTouchEnd={(e) => {
              const start = touchX.current;
              touchX.current = null;
              const end = e.changedTouches[0]?.clientX;
              if (start == null || end == null || Math.abs(end - start) < 40) return;
              go(end < start ? active + 1 : active - 1);
            }}
          >
            <div key={current.id} className={styles.slide} aria-roledescription="slide" aria-label={`${active + 1} of ${slides.length}`}>
              <DeskLead anime={current} />
            </div>

            {/* One line per announcement: done ones full, the current one fills,
                then the slider moves on. Tap a line to jump to it. */}
            {slides.length > 1 && (
              <div className={styles.progress}>
                {slides.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    className={styles.progressTrack}
                    onClick={() => go(i)}
                    aria-label={`Show ${a.title}`}
                    aria-current={i === active ? 'true' : undefined}
                  >
                    {i < active && <span className={`${styles.progressFill} ${styles.progressDone}`} />}
                    {i === active && (
                      <span
                        key={cycle}
                        className={`${styles.progressFill} ${styles.progressRun}`}
                        style={{ animationDuration: `${SLIDE_MS}ms` }}
                        onAnimationEnd={() => go(active + 1)}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <ul className={styles.deskList}>
            {slides.map((a, i) => (
              <li key={a.id}>
                <Link
                  href={`/anime/${a.slug}`}
                  className={`${styles.row} ${i === active ? styles.rowActive : ''}`}
                  aria-current={i === active ? 'true' : undefined}
                  onMouseEnter={() => {
                    if (i !== active) go(i);
                  }}
                >
                  <span className={styles.rowPoster}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {a.posterUrl ? <img src={a.posterUrl} alt="" loading="lazy" /> : null}
                  </span>
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>
                      {a.title}
                      {a.isNew && <span className={styles.rowNew}>New</span>}
                    </span>
                    <span className={styles.rowMeta}>{[metaLine(a), mainStudio(a)].filter(Boolean).join(' · ')}</span>
                    <span className={styles.rowDate}>
                      <CalendarDays size={12} aria-hidden="true" />
                      {a.premiere ? a.premiere : 'Date not announced'}
                    </span>
                  </span>
                  <ChevronRight size={16} className={styles.rowChevron} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function DeskLead({ anime: a }: { anime: AnnouncedAnime }) {
  const banner = isWideBanner(a.bannerUrl) ? a.bannerUrl : null;
  const studio = mainStudio(a);
  return (
    <Link href={`/anime/${a.slug}`} className={styles.deskLead}>
      <DeskArt banner={banner} trailerUrl={a.trailerUrl} posterUrl={a.posterUrl} />
      <span className={styles.deskBody}>
        <span className={styles.deskPoster}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {a.posterUrl ? <img src={a.posterUrl} alt="" /> : null}
        </span>
        <span className={styles.deskText}>
          <span className={styles.deskKicker}>
            <Sparkles size={12} aria-hidden="true" /> {a.isNew ? 'New announcement' : 'Latest announcement'}
          </span>
          <span className={styles.deskTitle}>{a.title}</span>
          {a.englishTitle && <span className={styles.deskAlt}>{a.englishTitle}</span>}
          <span className={styles.deskFacts}>
            <span>{metaLine(a)}</span>
            <span>
              <CalendarDays size={13} aria-hidden="true" /> {a.premiere ? `Premieres ${a.premiere}` : 'Date not announced'}
            </span>
            {studio && (
              <span>
                <Building2 size={13} aria-hidden="true" /> {studio}
              </span>
            )}
          </span>
          {a.synopsis && <span className={styles.deskSynopsis}>{a.synopsis}</span>}
          {a.genres.length > 0 && (
            <span className={styles.deskGenres}>
              {a.genres.slice(0, 3).map((g) => (
                <span key={g}>{g}</span>
              ))}
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}

/**
 * Lead background: the AniList banner, else a still from the anime's own
 * trailer (best quality first, stepping down if YouTube has no such size),
 * else the poster blurred. Same order as the anime page hero.
 */
function DeskArt({ banner, trailerUrl, posterUrl }: { banner: string | null; trailerUrl: string | null; posterUrl: string | null }) {
  const candidates = banner ? [banner] : trailerStills(trailerUrl);
  const [i, setI] = useState(0);
  const src = candidates[i];
  return (
    <span className={styles.deskArt} aria-hidden="true">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          onError={() => setI((n) => n + 1)}
          // YouTube answers a missing size with a 120px grey stand-in, not an error.
          onLoad={(e) => {
            if (!banner && e.currentTarget.naturalWidth < 400) setI((n) => n + 1);
          }}
        />
      ) : posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={posterUrl} alt="" className={styles.deskArtBlur} />
      ) : null}
    </span>
  );
}
