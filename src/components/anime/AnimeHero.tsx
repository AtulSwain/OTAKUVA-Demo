'use client';
import React from 'react';
import Link from 'next/link';
import { Play, Plus, Check, Heart, Star, Share2, MessageSquare } from 'lucide-react';
import { Anime } from '../../types/anime';
import { AnimeImage } from './AnimeImage';
import { useLibrary } from '../../context/LibraryContext';
import { useToast } from '../../context/ToastContext';
import { getAnimeDisplayTitle, getAnimeJapaneseTitle } from '../../lib/animeTitleResolver';
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
  otakuvaScore?: number | null;
  otakuvaRatingCount?: number;
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
  otakuvaScore = null,
  otakuvaRatingCount = 0,
}) => {
  const { getStatus, getItem, updateStatus, toggleFavorite } = useLibrary();
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

  // The hero shows only the OTAKUVA SCORE: what OTAKUVA members rated. It
  // updates as soon as someone rates. The provider's score is not shown here.
  const hasOtakuvaScore = typeof otakuvaScore === 'number' && otakuvaRatingCount > 0;
  const otakuvaVal = hasOtakuvaScore ? otakuvaScore.toFixed(1) : '—';
  const otakuvaCountLabel = hasOtakuvaScore
    ? `${otakuvaRatingCount.toLocaleString()} rating${otakuvaRatingCount === 1 ? '' : 's'}`
    : 'No ratings yet';

  const backdropSrc =
    anime.bannerImage ||
    (anime as any).bannerUrl ||
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
  if (totalEpisodes) kickerFacts.push(`${totalEpisodes} Episode${totalEpisodes === 1 ? '' : 's'}`);
  if (anime.status && String(anime.status) !== 'UNKNOWN') kickerFacts.push(anime.status);
  if (anime.duration) kickerFacts.push(anime.duration);
  if (anime.source) kickerFacts.push(anime.source);
  if (producersList.length > 0) kickerFacts.push(producersList.join(', '));
  if ((anime as any).rating) kickerFacts.push((anime as any).rating);

  const genresList = Array.isArray(anime.genres) ? anime.genres : [];

  const handleLibraryToggle = async () => {
    if (!isInLibrary) {
      // Adding to the library is a bookmark, not a declaration that you have
      // started watching. Defaulting to 'watching' filed new entries under the
      // wrong tab, which read as the anime not being added at all.
      await updateStatus(targetKey, 'plan_to_watch');
    } else {
      await updateStatus(targetKey, currentStatus === 'watching' ? 'completed' : 'watching');
    }
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
        <AnimeImage
          src={backdropSrc}
          alt={displayTitle}
          fill
          priority
          sizes="100vw"
          className={styles.backdropImg}
        />
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
            sizes="(max-width: 640px) 100px, (max-width: 1024px) 130px, 150px"
          />
        </div>

        {/* Primary Title & Metadata Block */}
        <div className={styles.titleArea}>
          <div className={styles.kicker}>
            {kickerFacts.map((fact, i) => (
              <React.Fragment key={i}>
                {i > 0 && <span className={styles.kickerDot} aria-hidden="true">•</span>}
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
            <div className={styles.scoreInline}>
              <div title="Average of OTAKUVA members' ratings">
                <span className={styles.scoreLabel}>OTAKUVA SCORE</span>
                <span className={styles.scoreVal}>{otakuvaVal}</span>
              </div>
              <span className={styles.scoreRatingsCount}>{otakuvaCountLabel}</span>
            </div>
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
        <div className={styles.actionsRow}>
          <button
            type="button"
            className={`${styles.actionBtn} ${isInLibrary ? styles.inLibraryBtn : styles.primaryBtn}`}
            onClick={handleLibraryToggle}
          >
            {isInLibrary ? <Check size={14} /> : <Plus size={14} />}
            <span>{isInLibrary ? 'In Library' : 'Add to Library'}</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${isFavorite ? styles.favoriteActiveBtn : ''}`}
            onClick={handleFavoriteToggle}
          >
            <Heart size={13} fill={isFavorite ? 'currentColor' : 'none'} />
            <span>{isFavorite ? 'Favorited' : 'Favorite'}</span>
          </button>

          {onOpenTrailer && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={onOpenTrailer}
            >
              <Play size={13} fill="currentColor" />
              <span>Trailer</span>
            </button>
          )}

          {onOpenRatingModal && (
            <button
              type="button"
              className={`${styles.actionBtn} ${effectiveRating !== null ? styles.ratedActiveBtn : ''}`}
              onClick={onOpenRatingModal}
              title={effectiveRating !== null ? `Your rating: ★ ${effectiveRating.toFixed(1)}/10. Click to edit.` : 'Rate anime'}
            >
              {/* One icon per control: the Lucide star is the icon, so the
                  label carries the number only. It previously also prefixed a
                  ★ character, rendering two stars side by side. */}
              <Star size={13} fill={effectiveRating !== null ? 'currentColor' : 'none'} />
              <span>{effectiveRating !== null ? effectiveRating.toFixed(1) : 'Rate'}</span>
            </button>
          )}

          {onOpenReviewDialog && (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={onOpenReviewDialog}
            >
              <MessageSquare size={13} />
              <span>Review</span>
            </button>
          )}

          <button
            type="button"
            className={styles.actionBtn}
            onClick={handleShare}
            title="Share"
          >
            <Share2 size={13} />
            <span>Share</span>
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
