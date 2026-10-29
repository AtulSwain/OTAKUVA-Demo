'use client';
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Play, Plus, Check, Heart, Gauge, Share2, MessageSquare, ChevronDown, Trash2, FolderPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAnimeLists } from '../lists/useAnimeLists';
import { Anime } from '../../types/anime';
import { AnimeImage } from './AnimeImage';
import { pickBanner, trailerStills } from '../../lib/media/heroArt';
import { RetentionBadge } from '../rating/RetentionBadge';
import { durationMinutes, formatRuntime, isMovieType } from '../../lib/anime/runtime';
import type { RetentionBadgeKey, RetentionStatus } from '../../lib/rating/retentionScore';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { getAnimeDisplayTitle, getAnimeJapaneseTitle } from '../../lib/animeTitleResolver';
import { formatContentRating } from '../../lib/contentRating';
import { formatAnimeStatus } from '../../lib/anime/animeStatus';
import styles from './AnimeHero.module.css';

interface AnimeHeroProps {
  anime: Anime;
  userRating?: number | null;
  /** Omitted when the anime has no recorded trailer — the button is hidden. */
  onOpenTrailer?: () => void;
  onOpenRatingModal?: () => void;
  onOpenReviewDialog?: () => void;
  /** Studio name/slug, already resolved by the page (handles the
   *  string-vs-object `anime.studio` shapes) — passed in rather than
   *  re-derived here so the hero line and the studio link always agree. */
  studioName?: string;
  studioSlug?: string;
  /** Lowest unwatched released episode, computed server-side. */
  nextEpisodeNumber?: number | null;
  /** Average of OTAKUVA members' ratings (null until someone rates). */
  /** Kept for callers; the hero now shows retention instead (2026-10-25). */
  otakuvaScore?: number | null;
  otakuvaRatingCount?: number;
  /** The anime's community retention — the score the hero shows. */
  retention?: { value: number | null; status?: RetentionStatus; badge?: RetentionBadgeKey | null; totalRatings?: number } | null;
  /** False for a title that hasn't aired yet — hides the score display and
   *  the Rate/Review actions, since there's nothing to rate yet. */
  hasPremiered?: boolean;
  /** Shown right under Add to Library, same width (the Hype button, 2026-10-27). */
  belowLibrary?: React.ReactNode;
}

export const AnimeHero: React.FC<AnimeHeroProps> = ({
  anime,
  userRating,
  onOpenTrailer,
  onOpenRatingModal,
  onOpenReviewDialog,
  studioName,
  studioSlug,
  nextEpisodeNumber = null,
  retention = null,
  hasPremiered = true,
  belowLibrary,
}) => {
  const { getStatus, getItem, updateStatus, toggleFavorite, removeFromLibrary } = useLibrary();
  const [menuOpen, setMenuOpen] = useState(false);
  // Custom lists, inside the Add to Library menu (loaded when it opens).
  const { user: authUser, openAuthModal } = useAuth();
  const listKey = (anime as any).otakuva_anime_id || anime.id || anime.slug;
  const animeLists = useAnimeLists(listKey, getAnimeDisplayTitle(anime));
  const loadAnimeLists = animeLists.load;
  useEffect(() => {
    if (menuOpen && authUser) loadAnimeLists();
  }, [menuOpen, authUser, loadAnimeLists]);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);
  const { showToast } = useToast();

  const targetKey = (anime as any).otakuva_anime_id || anime.id || anime.slug;
  const currentStatus = getStatus(targetKey) || (anime.slug ? getStatus(anime.slug) : undefined) || (anime.id ? getStatus(anime.id) : undefined);
  const isInLibrary = Boolean(currentStatus);
  const libraryItem = getItem(targetKey) || (anime.slug ? getItem(anime.slug) : undefined) || (anime.id ? getItem(anime.id) : undefined);
  const isFavorite = libraryItem?.isFavorite || false;
  const effectiveRating = (userRating !== undefined && userRating !== null ? userRating : libraryItem?.personalRating) ?? null;

  const displayTitle = getAnimeDisplayTitle(anime);
  const japaneseTitle = getAnimeJapaneseTitle(anime);
  // Progress is the viewer's recorded progress only. It used to assume 24
  // episodes when the count was unknown and "1 watched" for any WATCHING
  // entry; the next episode comes from the server (lowest unwatched released
  // episode), not watched + 1.
  const totalEpisodes = typeof anime.episodes === 'number' && anime.episodes > 0 ? anime.episodes : null;
  const watchedEpisodes = libraryItem?.episodesWatched ?? 0;
  const progressPercent = totalEpisodes ? Math.min(100, Math.round((watchedEpisodes / totalEpisodes) * 100)) : null;

  // The hero's score is the anime's community retention (2026-10-25, owner):
  // the mean of its rated episodes' scores, with its badge once there's
  // enough data. The 1–10 member rating still exists (Rate) but isn't the
  // headline score any more.
  const retentionValue = retention?.value ?? null;
  const retentionStatus: RetentionStatus = retention?.status ?? (retentionValue !== null ? 'provisional' : 'unrated');
  const retentionCount = retention?.totalRatings ?? 0;

  // A real wide banner fills the hero crisply; a poster never gets
  // stretched to full width — it becomes a soft colour backdrop instead,
  // and the sharp poster card beside the title carries the artwork.
  const bannerSrc = pickBanner(anime.bannerImage, (anime as any).bannerUrl);
  // No banner → a still from the anime's own official trailer (a related,
  // wide image — owner, 2026-10-25), before falling back to the poster.
  const stills = bannerSrc ? [] : trailerStills((anime as any).trailerUrl);
  const backdropSrc =
    bannerSrc ||
    anime.posterImage ||
    (anime as any).posterUrl;

  const posterSrc =
    anime.posterImage ||
    (anime as any).posterUrl ||
    backdropSrc;

  // One consolidated fact line instead of a separate stacked "Information"
  // sidebar card: everything about the release (format/year/episodes/status
  // plus duration/source/studio/producers/rating) lives here now. Studio
  // stays a real link; every other fact is plain text.
  const producersList = Array.isArray((anime as any).producers)
    ? (anime as any).producers
        .slice(0, 2)
        .map((p: any) => (typeof p === 'string' ? p : p?.name))
        .filter(Boolean)
    : [];

  // Only facts on record; missing ones are simply not listed.
  const kickerFacts: string[] = [];
  if (anime.type && String(anime.type) !== 'UNKNOWN') kickerFacts.push(anime.type);
  if (anime.year) kickerFacts.push(String(anime.year));
  // A movie shows its runtime ("Runtime 1h 47m"), not "1 Episode · 107 mins".
  const movie = isMovieType(anime.type);
  const runtime = movie ? formatRuntime(durationMinutes(anime.duration)) : null;
  if (totalEpisodes && !movie) kickerFacts.push(`${totalEpisodes} Episode${totalEpisodes === 1 ? '' : 's'}`);
  const airingStatusLabel = formatAnimeStatus(anime.status);
  if (airingStatusLabel) kickerFacts.push(airingStatusLabel);
  if (runtime) kickerFacts.push(`Runtime ${runtime}`);
  else if (anime.duration) kickerFacts.push(anime.duration);
  if (anime.source) kickerFacts.push(anime.source);
  if (producersList.length > 0) kickerFacts.push(producersList.join(', '));

  // Shown as its own badge rather than folded into the plain-text kicker
  // facts above — an age rating reads as a classification, not a fact in
  // a list, and deserves to stand out the way it does on the source data.
  const contentRating = formatContentRating((anime as any).rating);

  const genresList = Array.isArray(anime.genres) ? anime.genres : [];

  const LIBRARY_OPTIONS: { status: 'plan_to_watch' | 'watching' | 'completed' | 'on_hold' | 'dropped'; label: string }[] = [
    { status: 'plan_to_watch', label: 'Plan to watch' },
    { status: 'watching', label: 'Watching' },
    { status: 'completed', label: 'Completed' },
    { status: 'on_hold', label: 'On hold' },
    { status: 'dropped', label: 'Dropped' },
  ];
  const statusLabel = LIBRARY_OPTIONS.find((o) => o.status === currentStatus)?.label;
  // Not in the library yet: offer the two ways to start (Watching / Plan to
  // watch). Once it's in: Watching, Completed, On hold, Dropped to move it
  // along — plus Plan to watch only while that's its current status.
  const menuStatusOptions = isInLibrary
    ? LIBRARY_OPTIONS.filter((o) => o.status !== 'plan_to_watch' || currentStatus === 'plan_to_watch')
    : (['watching', 'plan_to_watch'] as const).map((st) => LIBRARY_OPTIONS.find((o) => o.status === st)!);

  const handlePickStatus = async (status: (typeof LIBRARY_OPTIONS)[number]['status']) => {
    setMenuOpen(false);
    await updateStatus(targetKey, status);
  };

  const handleRemove = async () => {
    setMenuOpen(false);
    await removeFromLibrary(targetKey);
  };

  const handleFavoriteToggle = async () => {
    await toggleFavorite(targetKey);
  };

  const handleShare = async () => {
    if (typeof window !== 'undefined') {
      try {
        if (navigator.share) {
          await navigator.share({
            title: displayTitle,
            url: window.location.href,
          });
        } else {
          await navigator.clipboard.writeText(window.location.href);
          showToast('Share link copied to clipboard', 'info');
        }
      } catch {
        showToast('Share link copied to clipboard', 'info');
      }
    }
  };

  return (
    <section className={styles.heroSection} aria-label={`${displayTitle} Hero`}>
      {/* 1. Backdrop Artwork & Vignette */}
      <div className={styles.backdropWrapper}>
        {stills.length > 0 ? (
          <TrailerBackdrop key={stills[0]} stills={stills} fallback={backdropSrc} />
        ) : (
          <AnimeImage
            src={backdropSrc}
            alt=""
            fill
            priority
            unoptimized
            sizes="100vw"
            className={bannerSrc ? styles.backdropImg : `${styles.backdropImg} ${styles.backdropAmbient}`}
          />
        )}
        <div className={styles.backdropOverlay} />
      </div>

      {/* 2. Overlapping Poster & Editorial Title Block */}
      <div className={styles.heroInner}>
        {/* Left Poster */}
        <div className={styles.poster}>
          <AnimeImage
            src={posterSrc}
            alt={displayTitle}
            fill
            priority
            unoptimized
            sizes="(max-width: 640px) 120px, 220px"
          />
        </div>

        {/* Primary Title & Metadata Block */}
        <div className={styles.titleArea}>
          <div className={styles.kicker}>
            {contentRating && (
              <span
                className={`${styles.ratingBadge} ${contentRating.isMature ? styles.ratingBadgeMature : ''}`}
                title={contentRating.description}
              >
                {contentRating.code}
              </span>
            )}
            {kickerFacts.map((fact, i) => (
              <React.Fragment key={i}>
                {(i > 0 || contentRating) && <span className={styles.kickerDot} aria-hidden="true">•</span>}
                <span>{fact}</span>
              </React.Fragment>
            ))}
            {studioName && (
              <>
                <span className={styles.kickerDot} aria-hidden="true">•</span>
                <Link href={`/studios/${studioSlug || ''}`} className={styles.kickerLink}>
                  {studioName}
                </Link>
              </>
            )}
          </div>

          {/* Title Line with Title-Side Score */}
          <div className={styles.titleLine}>
            <h1 className={styles.mainTitle}>{displayTitle}</h1>
            {hasPremiered && (
              <a href="#retention" className={styles.scoreInline} title="Retention: the average of this anime's episode scores, as members rated them">
                <span className={styles.scoreVal}>{retentionValue !== null ? `${retentionValue}%` : '—'}</span>
                <span className={styles.scoreMeta}>
                  <span className={styles.scoreLabel}>Retention</span>
                  {retentionStatus === 'unrated' ? (
                    <span className={styles.scoreRatingsCount}>No ratings yet</span>
                  ) : (
                    <RetentionBadge status={retentionStatus} badge={retention?.badge ?? null} value={retentionValue} size="xs" />
                  )}
                </span>
              </a>
            )}
          </div>

          {/* Japanese Title */}
          {japaneseTitle && japaneseTitle !== displayTitle && (
            <div className={styles.japaneseTitle}>{japaneseTitle}</div>
          )}

          {/* Genre Chips */}
          {genresList.length > 0 && (
          <div className={styles.chipsRow}>
            {genresList.map((g) => (
              <Link
                key={g}
                href={`/anime?genre=${encodeURIComponent(g)}`}
                className={styles.chip}
              >
                {g}
              </Link>
            ))}
          </div>
          )}
        </div>

        {/* Primary Actions Row */}
        <div className={`${styles.actionsRow} ${belowLibrary ? styles.actionsRowStacked : ''}`}>
          <div className={belowLibrary ? styles.libraryStack : styles.libraryCell}>
          <div className={styles.libraryMenuWrap} ref={menuRef}>
            <button
              type="button"
              className={`${styles.actionBtn} ${isInLibrary ? styles.inLibraryBtn : styles.primaryBtn}`}
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
            >
              {isInLibrary ? <Check size={14} /> : <Plus size={14} />}
              <span>{isInLibrary ? statusLabel || 'In Library' : 'Add to Library'}</span>
              <ChevronDown size={13} />
            </button>
            {menuOpen && (
              <div className={styles.libraryMenu} role="menu" aria-label="Add to library">
                {isInLibrary && <span className={styles.menuHeading}>Status</span>}
                {menuStatusOptions.map((o) => (
                  <button
                    key={o.status}
                    type="button"
                    role="menuitemradio"
                    aria-checked={currentStatus === o.status}
                    className={`${styles.libraryMenuItem} ${currentStatus === o.status ? styles.libraryMenuItemOn : ''}`}
                    onClick={() => handlePickStatus(o.status)}
                  >
                    <span>{o.label}</span>
                    {currentStatus === o.status && <Check size={14} />}
                  </button>
                ))}
                <button
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={isFavorite}
                  className={`${styles.libraryMenuItem} ${isFavorite ? styles.libraryMenuItemOn : ''}`}
                  onClick={() => {
                    setMenuOpen(false);
                    handleFavoriteToggle();
                  }}
                >
                  <span>Favorites</span>
                  <Heart size={13} fill={isFavorite ? 'currentColor' : 'none'} />
                </button>
                <div className={styles.listsSection} role="group" aria-label="Your collections">
                  <span className={styles.listsHeading}>Your collections</span>
                  {!authUser ? (
                    <button
                      type="button"
                      className={styles.libraryMenuItem}
                      onClick={() => {
                        setMenuOpen(false);
                        openAuthModal('login');
                      }}
                    >
                      <span>Sign in to make collections</span>
                    </button>
                  ) : (
                    <>
                      {animeLists.lists === null ? (
                        <span className={styles.listsNote}>Loading…</span>
                      ) : animeLists.error ? (
                        <span className={styles.listsNote}>{animeLists.error}</span>
                      ) : (
                        <div className={styles.listsScroll}>
                          {animeLists.lists.map((l) => (
                            <button
                              key={l.id}
                              type="button"
                              role="menuitemcheckbox"
                              aria-checked={Boolean(l.containsAnime)}
                              className={styles.libraryMenuItem}
                              onClick={() => animeLists.toggle(l)}
                              disabled={animeLists.busyId === l.id}
                            >
                              <span className={styles.listName}>
                                {l.name}
                                <span className={styles.listCount}>{l.count}</span>
                              </span>
                              <span className={`${styles.listTick} ${l.containsAnime ? styles.listTickOn : ''}`} aria-hidden="true">
                                {l.containsAnime && <Check size={12} strokeWidth={3} />}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Collections (2026-10-22): "Make a collection" opens the builder
                          with this anime already in it; Manage on the left. */}
                      <div className={styles.listsFooter}>
                        <Link href="/library/lists" className={styles.manageLists} onClick={() => setMenuOpen(false)}>
                          Manage
                        </Link>
                        <Link
                          href={`/collections/new?anime=${encodeURIComponent(anime.slug || listKey)}`}
                          className={styles.makeCollection}
                          onClick={() => setMenuOpen(false)}
                        >
                          <FolderPlus size={14} aria-hidden="true" /> Make a collection
                        </Link>
                      </div>
                    </>
                  )}
                </div>
                {isInLibrary && (
                  <button type="button" role="menuitem" className={`${styles.libraryMenuItem} ${styles.libraryMenuDanger}`} onClick={handleRemove}>
                    <span>Remove from library</span>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
          {belowLibrary}
          </div>

          {/* No 1–10 stars any more (owner, 2026-10-25) — rating is per
              episode (retention); this jumps to the Episode Guide. */}
          {hasPremiered && onOpenRatingModal && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.pairBtn}`}
              onClick={onOpenRatingModal}
              title="Rate how well each episode kept you watching"
            >
              <Gauge size={13} aria-hidden="true" />
              <span>Rate episodes</span>
            </button>
          )}

          {hasPremiered && onOpenReviewDialog && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.pairBtn}`}
              onClick={onOpenReviewDialog}
            >
              <MessageSquare size={13} />
              <span>Review</span>
            </button>
          )}

          {/* Secondary actions: round icon buttons. The label stays in the
              DOM (visually hidden) so screen readers still announce it. */}
          {onOpenTrailer && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.trailerBtn}`}
              onClick={onOpenTrailer}
              title="Watch trailer"
            >
              <Play size={15} fill="currentColor" />
              <span className={styles.trailerLabel}>Trailer</span>
            </button>
          )}

          <button
            type="button"
            className={`${styles.actionBtn} ${styles.iconBtn} ${isFavorite ? styles.favoriteActiveBtn : ''}`}
            onClick={handleFavoriteToggle}
            aria-pressed={isFavorite}
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} />
            <span className={styles.srOnly}>{isFavorite ? 'Favorited' : 'Favorite'}</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${styles.iconBtn}`}
            onClick={handleShare}
            title="Share"
          >
            <Share2 size={17} />
            <span className={styles.srOnly}>Share</span>
          </button>
        </div>

        {/* Watch Progress — only for anime in the viewer's library */}
        {isInLibrary && (
          <div className={styles.progressBox}>
            <div className={styles.progressTop}>
              <span>Your Progress</span>
              <strong>
                {watchedEpisodes}
                {totalEpisodes ? ` / ${totalEpisodes}` : ''} episode{(totalEpisodes ?? watchedEpisodes) === 1 ? '' : 's'}
                {totalEpisodes ? '' : ' watched'}
              </strong>
            </div>
            {progressPercent !== null && (
              <div
                className={styles.progressBar}
                role="progressbar"
                aria-valuenow={progressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Episodes watched"
              >
                <span className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
              </div>
            )}
            {(nextEpisodeNumber !== null || progressPercent !== null) && (
              <div className={styles.progressBottom}>
                {nextEpisodeNumber !== null && (
                  <>Continue with <strong>Episode {nextEpisodeNumber}</strong></>
                )}
                {nextEpisodeNumber !== null && progressPercent !== null && ' • '}
                {progressPercent !== null && `${progressPercent}% complete`}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

/**
 * Hero background from the official trailer's stills, best first. YouTube
 * answers a missing size with a tiny 120x90 stand-in (or an error), so a
 * still narrower than 400px moves on to the next size; if none works the
 * soft blurred poster is used, as before.
 */
function TrailerBackdrop({ stills, fallback }: { stills: string[]; fallback?: string | null }) {
  const [i, setI] = useState(0);
  const next = () => setI((n) => n + 1);
  if (i >= stills.length) {
    return fallback ? (
      <AnimeImage src={fallback} alt="" fill priority unoptimized sizes="100vw" className={`${styles.backdropImg} ${styles.backdropAmbient}`} />
    ) : null;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={stills[i]}
      alt=""
      aria-hidden="true"
      decoding="async"
      fetchPriority="high"
      className={`${styles.backdropImg} ${styles.backdropTrailer}`}
      onLoad={(e) => {
        if (e.currentTarget.naturalWidth < 400) next();
      }}
      onError={next}
    />
  );
}
