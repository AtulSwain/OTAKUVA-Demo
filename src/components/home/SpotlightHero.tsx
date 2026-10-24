'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Play, Plus, Check, Calendar, Sparkles } from 'lucide-react';
import { Anime } from '../../types/anime';
import { AnimeImage } from '../anime/AnimeImage';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { getAnimeDisplayTitle } from '../../lib/animeTitleResolver';
import { pickBanner } from '../../lib/media/heroArt';
import styles from './SpotlightHero.module.css';

/** "3 hours ago" / "yesterday" — client-only (depends on the current time). */
function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  if (mins < 60) return rtf.format(-Math.max(1, mins), 'minute');
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-Math.round(hours / 24), 'day');
}

interface SpotlightHeroProps {
  animeList: Anime[];
  onOpenTrailer?: (trailerUrl: string, title: string) => void;
}

export const SpotlightHero: React.FC<SpotlightHeroProps> = ({
  animeList,
  onOpenTrailer,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // Times are shown in the viewer's own timezone, which the server can't
  // know; render a timezone-free label first and localise after mount so
  // server and client HTML match.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { getStatus, updateStatus } = useLibrary();
  const { showToast } = useToast();

  const activeList = animeList || [];

  // Swipe: the slide follows the finger, then snaps to the next/previous title.
  // touch-action: pan-y (CSS) leaves vertical page scrolling to the browser.
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ id: number; x: number; y: number; t: number; horizontal: boolean | null } | null>(null);
  const suppressClick = useRef(false);
  const SWIPE_DISTANCE = 56;
  const SWIPE_VELOCITY = 0.45; // px per ms

  const goTo = (delta: number) => {
    if (activeList.length <= 1) return;
    setCurrentIndex((prev) => (prev + delta + activeList.length) % activeList.length);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' || activeList.length <= 1) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), horizontal: null };
    setPaused(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      d.horizontal = Math.abs(dx) > Math.abs(dy);
      if (d.horizontal) {
        setDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }
    }
    if (d.horizontal) setDragX(dx);
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    setPaused(false);
    if (!d.horizontal) return;
    const dx = e.clientX - d.x;
    const velocity = Math.abs(dx) / Math.max(1, performance.now() - d.t);
    suppressClick.current = true; // the release of a swipe must not also "tap" a link
    setDragging(false);
    setDragX(0);
    if (Math.abs(dx) > SWIPE_DISTANCE || velocity > SWIPE_VELOCITY) goTo(dx < 0 ? 1 : -1);
  };

  const dragStyle: React.CSSProperties | undefined =
    dragX !== 0
      ? { transform: `translate3d(${dragX}px, 0, 0)`, opacity: Math.max(0.35, 1 - Math.abs(dragX) / 600), transition: dragging ? 'none' : undefined }
      : undefined;

  // Auto-rotate hero every 8s
  useEffect(() => {
    if (activeList.length <= 1 || paused) return;
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % activeList.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [activeList.length, paused]);

  if (activeList.length === 0) return null;

  const currentAnime = activeList[currentIndex] || activeList[0];
  const displayTitle = getAnimeDisplayTitle(currentAnime as Anime);
  const targetKey = (currentAnime as any).otakuva_anime_id || currentAnime.id || (currentAnime as any).slug;
  const currentStatus = getStatus(targetKey) || (currentAnime.slug ? getStatus(currentAnime.slug) : undefined);
  const isInLibrary = Boolean(currentStatus);

  const handleLibraryToggle = async () => {
    if (!isInLibrary) {
      await updateStatus(targetKey, 'watching');
    } else {
      await updateStatus(targetKey, currentStatus === 'watching' ? 'completed' : 'watching');
    }
  };

  // Real wide banner → full-bleed and crisp. Otherwise the poster becomes a
  // soft colour field and is shown sharp at its true size on the right,
  // instead of being stretched (and blurred) across the whole hero.
  const bannerSrc = pickBanner((currentAnime as any).bannerUrl, currentAnime.bannerImage);
  const posterSrc = (currentAnime as any).largePosterUrl || currentAnime.posterImage || (currentAnime as any).posterUrl;
  const backdropSrc = bannerSrc || posterSrc;

  // The badge says OTAKUVA SCORE, so it shows OTAKUVA members' average —
  // not the provider score it used to show under that name.
  const otakuvaCount = currentAnime.otakuvaRatingCount ?? 0;
  const scoreVal =
    typeof currentAnime.otakuvaScore === 'number' && otakuvaCount > 0
      ? currentAnime.otakuvaScore.toFixed(1)
      : '—';
  const scoreCountLabel = otakuvaCount > 0 ? `${otakuvaCount.toLocaleString('en-US')} rating${otakuvaCount === 1 ? '' : 's'}` : 'No ratings yet';
  // Facts on record only — this used to fill gaps with "TV", 2026,
  // "24 Episodes" and "Finished".
  const metaText = [
    currentAnime.type,
    currentAnime.year ? String(currentAnime.year) : null,
    typeof currentAnime.episodes === 'number' && currentAnime.episodes > 0 ? `${currentAnime.episodes} Episodes` : null,
    currentAnime.status,
  ].filter(Boolean).join(' • ');

  const statusText = String(currentAnime.status || '').toLowerCase();
  const latestEpisode = (currentAnime as any).latestEpisode as number | undefined;
  const latestAiredAt = (currentAnime as any).latestAiredAt as string | undefined;
  const badge = latestEpisode
    ? 'New Episode'
    : statusText.includes('air') ? 'Airing Now' : statusText.includes('upcoming') || statusText.includes('not yet') ? 'Coming Soon' : 'Featured';
  const genres = (currentAnime.genres || []).slice(0, 3).map((g: any) => (typeof g === 'string' ? g : g?.name)).filter(Boolean);
  const metaLine = [currentAnime.type, ...genres].filter(Boolean).join(' · ');
  const hasSynopsis = Boolean(currentAnime.synopsis) && !/^no synopsis/i.test(String(currentAnime.synopsis).trim());
  const trailer = (currentAnime as any).trailerUrl as string | undefined;
  const scoreLine = otakuvaCount > 0 ? `OTAKUVA ${scoreVal} · ${scoreCountLabel}` : null;

  const releasedLine = latestEpisode
    ? `Episode ${latestEpisode} out now${mounted && latestAiredAt ? ` · released ${formatRelative(latestAiredAt)}` : ''}`
    : null;

  const nextAiringEpisode = (currentAnime as any).nextAiringEpisode as number | null | undefined;
  const nextAiringAt = (currentAnime as any).nextAiringAt as string | null | undefined;
  const nextEpisodeLine = (() => {
    if (!nextAiringEpisode || !nextAiringAt) return null;
    const d = new Date(nextAiringAt);
    if (Number.isNaN(d.getTime()) || d.getTime() < Date.now()) return null;
    if (!mounted) return `Episode ${nextAiringEpisode} coming soon`;
    const day = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    return `Episode ${nextAiringEpisode} airs ${day}, ${time}`;
  })();

  return (
    <section
      className={styles.hero}
      aria-label="Featured Anime Spotlight"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onClickCapture={(e) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') goTo(1);
        else if (e.key === 'ArrowLeft') goTo(-1);
      }}
    >
      <div className={styles.heroArt} key={currentAnime.id}>
        <AnimeImage
          src={backdropSrc}
          alt=""
          fill
          priority
          unoptimized
          sizes="100vw"
          className={bannerSrc ? styles.heroBackdropImg : `${styles.heroBackdropImg} ${styles.heroAmbient}`}
        />
        <div className={styles.heroOverlay} />
      </div>

      {!bannerSrc && posterSrc && (
        <div className={styles.heroPoster} key={`p-${currentAnime.id}`} aria-hidden="true" style={dragStyle}>
          <AnimeImage src={posterSrc} alt="" fill priority unoptimized sizes="300px" />
        </div>
      )}

      <div className={`${styles.heroContent} ${dragging ? styles.dragging : ''}`} key={`c-${currentAnime.id}`} style={dragStyle}>
        <div className={styles.metaTop}>
          <span className={styles.badge}>{badge}</span>
          {metaLine && <span className={styles.metaText}>{metaLine}</span>}
        </div>
        <h1 className={styles.title}>{displayTitle}</h1>
        {scoreLine && <p className={styles.rankLine}>{scoreLine}</p>}
        {releasedLine && (
          <p className={styles.nextEpisodeLine}>
            <Sparkles size={13} aria-hidden="true" /> {releasedLine}
          </p>
        )}
        {nextEpisodeLine && (
          <p className={styles.nextEpisodeLine}>
            <Calendar size={13} aria-hidden="true" /> {nextEpisodeLine}
          </p>
        )}
        {hasSynopsis && <p className={styles.synopsis}>{currentAnime.synopsis}</p>}

        <div className={styles.actionsRow}>
          <Link href={`/anime/${currentAnime.slug || currentAnime.id}`} className={styles.btnPrimary}>
            View Details
          </Link>
          <button
            type="button"
            className={`${styles.btnCircle} ${isInLibrary ? styles.btnCircleOn : ''}`}
            onClick={handleLibraryToggle}
            aria-label={isInLibrary ? 'In your library' : 'Add to library'}
            title={isInLibrary ? 'In your library' : 'Add to library'}
          >
            {isInLibrary ? <Check size={20} /> : <Plus size={20} />}
          </button>
          {trailer && onOpenTrailer && (
            <button type="button" className={styles.btnGhost} onClick={() => onOpenTrailer(trailer, displayTitle)}>
              <Play size={16} fill="currentColor" />
              <span>Trailer</span>
            </button>
          )}
        </div>
      </div>

      {activeList.length > 1 && (
        <div className={styles.indicatorsRow} role="tablist" aria-label="Featured titles">
          {activeList.map((_, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={currentIndex === idx}
              className={`${styles.indicatorDot} ${currentIndex === idx ? styles.indicatorDotActive : ''}`}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Show featured title ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
};
