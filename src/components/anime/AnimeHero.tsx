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
  onOpenTrailer: () => void;
  onOpenRatingModal?: () => void;
  onOpenReviewDialog?: () => void;
  /** Studio name/slug, already resolved by the page (handles the
   *  string-vs-object `anime.studio` shapes) — passed in rather than
   *  re-derived here so the hero line and the studio link always agree. */
  studioName?: string;
  studioSlug?: string;
}

export const AnimeHero: React.FC<AnimeHeroProps> = ({
  anime,
  userRating,
  onOpenTrailer,
  onOpenRatingModal,
  onOpenReviewDialog,
  studioName,
  studioSlug,
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
  const totalEpisodes = anime.episodes || 24;
  const watchedEpisodes = libraryItem?.episodesWatched || (currentStatus === 'completed' ? totalEpisodes : currentStatus === 'watching' ? 1 : 0);
  const progressPercent = totalEpisodes > 0 ? Math.round((watchedEpisodes / totalEpisodes) * 100) : 0;
  const nextEpisode = Math.min(watchedEpisodes + 1, totalEpisodes);

  const scoreVal = anime.score ? Number(anime.score).toFixed(1) : '—';
  const ratingCount = anime.ratingCount || (anime as any).scoredBy
    ? `${Math.round(((anime.ratingCount || (anime as any).scoredBy) as number) / 1000)}K`
    : null;

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

  const kickerFacts: string[] = [
    anime.type || 'TV',
    String(anime.year || 2024),
    `${totalEpisodes} Episodes`,
    anime.status || 'Finished',
  ];
  if (anime.duration) kickerFacts.push(anime.duration);
  if (anime.source) kickerFacts.push(anime.source);
  if (producersList.length > 0) kickerFacts.push(producersList.join(', '));
  if ((anime as any).rating) kickerFacts.push((anime as any).rating);

  const genresList = Array.isArray(anime.genres) && anime.genres.length > 0
    ? anime.genres
    : ['Action', 'Drama', 'Fantasy'];

  const handleLibraryToggle = async () => {
    if (!isInLibrary) {
      await updateStatus(targetKey, 'watching');
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
              <div>
                <span className={styles.scoreLabel}>OTAKUVA SCORE</span>
                <span className={styles.scoreVal}>{scoreVal}</span>
              </div>
              <span className={styles.scoreStars} aria-hidden="true">★★★★★</span>
              {ratingCount && <span className={styles.scoreRatingsCount}>{ratingCount}</span>}
            </div>
          </div>

          {/* Japanese Title */}
          {japaneseTitle && japaneseTitle !== displayTitle && (
            <div className={styles.japaneseTitle}>{japaneseTitle}</div>
          )}

          {/* Genre Chips */}
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

          <button
            type="button"
            className={styles.actionBtn}
            onClick={onOpenTrailer}
          >
            <Play size={13} fill="currentColor" />
            <span>Trailer</span>
          </button>

          {onOpenRatingModal && (
            <button
              type="button"
              className={`${styles.actionBtn} ${effectiveRating !== null ? styles.ratedActiveBtn : ''}`}
              onClick={onOpenRatingModal}
              title={effectiveRating !== null ? `Your rating: ★ ${effectiveRating.toFixed(1)}/10. Click to edit.` : 'Rate anime'}
            >
              <Star size={13} fill={effectiveRating !== null ? 'currentColor' : 'none'} />
              <span>{effectiveRating !== null ? `★ ${effectiveRating.toFixed(1)}` : 'Rate'}</span>
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

        {/* Watch Progress Card */}
        <div className={styles.progressBox}>
          <div className={styles.progressTop}>
            <span>Your Progress</span>
            <strong>{watchedEpisodes} / {totalEpisodes} episodes</strong>
          </div>
          <div className={styles.progressBar}>
            <span className={styles.progressFill} style={{ width: `${progressPercent}%` }} />
          </div>
          <div className={styles.progressBottom}>
            Continue with <strong>Episode {nextEpisode}</strong> • {progressPercent}% complete
          </div>
        </div>
      </div>
    </section>
  );
};
