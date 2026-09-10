'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { FIXTURE_ANIMES } from '../../../fixtures/anime.fixture';
import { Anime } from '../../../types/anime';
import { AnimeHero } from '../../../components/anime/AnimeHero';
import { WhereToWatch } from '../../../components/anime/WhereToWatch';
import { OtakuvaVibe } from '../../../components/anime/OtakuvaVibe';
import { CharacterPreview } from '../../../components/anime/CharacterPreview';
import { EpisodeQuickList } from '../../../components/anime/EpisodeQuickList';
import { StaffRail } from '../../../components/anime/StaffRail';
import { ProductionTimeline } from '../../../components/anime/ProductionTimeline';
import { PersonalizedRecommendations } from '../../../components/anime/PersonalizedRecommendations';
import { AnimeNewsList } from '../../../components/anime/AnimeNewsList';
import { RatingDistributionCard } from '../../../components/anime/RatingDistributionCard';
import { AnimeReviewsCard } from '../../../components/anime/AnimeReviewsCard';
import { CommunityTeaser } from '../../../components/anime/CommunityTeaser';
import { UserCollectionsCard } from '../../../components/anime/UserCollectionsCard';
import { UserActivityCard } from '../../../components/anime/UserActivityCard';
import { AnimeImage } from '../../../components/anime/AnimeImage';
import { AnimeStickyActionBar } from '../../../components/anime/AnimeStickyActionBar';
import { RatingModal } from '../../../components/rating/RatingModal';
import { WriteReviewModal } from '../../../components/review/WriteReviewModal';
import { TrailerModal } from '../../../components/ui/TrailerModal';
import { Skeleton } from '../../../components/ui/Skeleton';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { RatingSummaryResult, RatingCategoryType } from '../../../lib/rating/ratingEngine';
import { getAnimeDisplayTitle } from '../../../lib/animeTitleResolver';
import styles from './anime.module.css';

const DEFAULT_TRAILERS: Record<string, string> = {
  'monster': 'https://www.youtube.com/watch?v=O_79b7Fq370',
  'frieren-beyond-journeys-end': 'https://www.youtube.com/watch?v=qgQunxD0qLk',
  'attack-on-titan-final-season': 'https://www.youtube.com/watch?v=M_OauHnAFc8',
  'steins-gate': 'https://www.youtube.com/watch?v=uMYhjVwp0Fk',
  'jujutsu-kaisen': 'https://www.youtube.com/watch?v=pkKu9hLT-t8',
  'demon-slayer': 'https://www.youtube.com/watch?v=VQGCKyvzIM4',
  'solo-leveling': 'https://www.youtube.com/watch?v=6u_U_GjQeWw',
  'vinland-saga': 'https://www.youtube.com/watch?v=f8JrZ7Q_Fxs',
  'death-note': 'https://www.youtube.com/watch?v=NlJZ-YgAt-c',
  'fullmetal-alchemist-brotherhood': 'https://www.youtube.com/watch?v=--IcmZkvL0Q',
};

export default function AnimeDetailPage() {
  const params = useParams();
  const id = (params?.id as string) || '';
  const { user, openAuthModalWithIntent, consumePendingIntent, pendingIntent } = useAuth();
  const { showToast } = useToast();

  const [anime, setAnime] = useState<Anime | null>(() => {
    return FIXTURE_ANIMES.find((a) => a.id === id || a.slug === id) || null;
  });
  const [characters, setCharacters] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [relations, setRelations] = useState<any[]>([]);
  const [ratingSummary, setRatingSummary] = useState<RatingSummaryResult | null>(null);
  const [userRatingData, setUserRatingData] = useState<{
    authenticated?: boolean;
    hasRated: boolean;
    yourRating: number | null;
    yourCategoryRatings?: Partial<Record<RatingCategoryType, number>>;
  } | null>(null);
  const [guestRating, setGuestRating] = useState<{
    score: number;
    categoryScores?: Partial<Record<RatingCategoryType, number>>;
  } | null>(null);
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [userReview, setUserReview] = useState<any>(null);
  const [reviewToEdit, setReviewToEdit] = useState<any>(null);
  const [news, setNews] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(!anime);
  const [isSynopsisExpanded, setIsSynopsisExpanded] = useState(false);
  const [isTrailerOpen, setIsTrailerOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);

  // Sync guest rating from localStorage if unauthenticated
  useEffect(() => {
    if (typeof window !== 'undefined' && !user) {
      try {
        const storedKey = anime?.id ? `otakuva_guest_rating_${anime.id}` : `otakuva_guest_rating_${id}`;
        const stored = localStorage.getItem(storedKey) || localStorage.getItem(`otakuva_guest_rating_${id}`);
        if (stored) {
          setGuestRating(JSON.parse(stored));
        } else {
          setGuestRating(null);
        }
      } catch {
        // ignore
      }
    } else if (user) {
      setGuestRating(null);
    }
  }, [user, id, anime?.id]);

  // Compute effective user rating considering guest fallback
  const effectiveUserRating = userRatingData?.yourRating ?? guestRating?.score ?? null;
  const effectiveCategoryRatings = userRatingData?.yourCategoryRatings ?? guestRating?.categoryScores ?? {};

  const fetchRatingSummary = async () => {
    try {
      const [sumRes, userRateRes] = await Promise.allSettled([
        fetch(`/api/anime/${id}/rating-summary`, { cache: 'no-store' }),
        fetch(`/api/anime/${id}/rating`, { cache: 'no-store' }),
      ]);
      if (sumRes.status === 'fulfilled' && sumRes.value.ok) {
        const sumData = await sumRes.value.json();
        setRatingSummary(sumData);
      }
      if (userRateRes.status === 'fulfilled' && userRateRes.value.ok) {
        const userData = await userRateRes.value.json();
        setUserRatingData(userData);
      }
    } catch (e) {
      console.error('Error fetching rating summary:', e);
    }
  };

  // Re-fetch ratings when auth state hydrates or user logs in
  useEffect(() => {
    if (id) {
      fetchRatingSummary();
    }
  }, [user, id]);

  // Resume pending action intent after login
  useEffect(() => {
    if (user && pendingIntent) {
      const intent = consumePendingIntent();
      if (
        intent &&
        (intent.animeId === id ||
          intent.animeId === anime?.slug ||
          intent.animeId === anime?.id)
      ) {
        if (intent.type === 'RATE_ANIME') {
          const targetScore = intent.score;
          if (typeof targetScore === 'number') {
            let catScores = (intent as any).categoryScores;
            if (!catScores && typeof window !== 'undefined') {
              try {
                const stored =
                  localStorage.getItem(`otakuva_guest_rating_${anime?.id || id}`) ||
                  localStorage.getItem(`otakuva_guest_rating_${id}`);
                if (stored) catScores = JSON.parse(stored)?.categoryScores;
              } catch {}
            }

            fetch(`/api/anime/${anime?.id || id}/rating`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                score: targetScore,
                categoryScores: catScores,
              }),
            })
              .then(async (res) => {
                if (res.ok) {
                  if (typeof window !== 'undefined') {
                    localStorage.removeItem(`otakuva_guest_rating_${id}`);
                    if (anime?.id) localStorage.removeItem(`otakuva_guest_rating_${anime.id}`);
                  }
                  setGuestRating(null);
                  showToast(`★ ${targetScore.toFixed(1)} rating synced to your account!`, 'success');
                  await fetchRatingSummary();
                }
              })
              .catch((err) => console.error('Error syncing pending rating after login:', err));
          } else {
            setIsRatingModalOpen(true);
          }
        } else if (intent.type === 'OPEN_RATING_MODAL') {
          setIsRatingModalOpen(true);
        } else if (intent.type === 'WRITE_REVIEW') {
          setIsReviewModalOpen(true);
        }
      }
    }
  }, [user, pendingIntent, id, anime, consumePendingIntent, showToast]);

  useEffect(() => {
    let isCancelled = false;
    const fetchDetails = async () => {
      try {
        const [
          animeRes,
          charRes,
          staffRes,
          relRes,
          ratingSumRes,
          userRateRes,
          discRes,
          revRes,
          newsRes,
          seasonsRes,
          episodesRes,
        ] = await Promise.allSettled([
          fetch(`/api/anime/${id}`),
          fetch(`/api/anime/${id}/characters`),
          fetch(`/api/anime/${id}/staff`),
          fetch(`/api/anime/${id}/relations`),
          fetch(`/api/anime/${id}/rating-summary`),
          fetch(`/api/anime/${id}/rating`),
          fetch(`/api/discussions?animeId=${id}`),
          fetch(`/api/reviews?animeId=${id}`),
          fetch(`/api/anime/${id}/news`),
          fetch(`/api/anime/${id}/seasons`),
          fetch(`/api/anime/${id}/episodes`),
        ]);

        if (animeRes.status === 'fulfilled' && animeRes.value.ok) {
          const data = await animeRes.value.json();
          if (!isCancelled && data.anime) {
            setAnime(data.anime);
            if (data.anime.characters) setCharacters(data.anime.characters);
            if (data.anime.staff) setStaff(data.anime.staff);
            if (data.anime.relations) setRelations(data.anime.relations);
            if (data.anime.discussions) setDiscussions(data.anime.discussions);
          }
        }

        if (charRes.status === 'fulfilled' && charRes.value.ok) {
          const data = await charRes.value.json();
          if (!isCancelled && data.characters) setCharacters(data.characters);
        }

        if (staffRes.status === 'fulfilled' && staffRes.value.ok) {
          const data = await staffRes.value.json();
          if (!isCancelled && data.staff) setStaff(data.staff);
        }

        if (relRes.status === 'fulfilled' && relRes.value.ok) {
          const data = await relRes.value.json();
          if (!isCancelled && data.relations) setRelations(data.relations);
        }

        if (ratingSumRes.status === 'fulfilled' && ratingSumRes.value.ok) {
          const data = await ratingSumRes.value.json();
          if (!isCancelled) setRatingSummary(data);
        }

        if (userRateRes.status === 'fulfilled' && userRateRes.value.ok) {
          const data = await userRateRes.value.json();
          if (!isCancelled) setUserRatingData(data);
        }

        if (discRes.status === 'fulfilled' && discRes.value.ok) {
          const data = await discRes.value.json();
          if (!isCancelled && data.discussions) setDiscussions(data.discussions);
        }

        if (revRes.status === 'fulfilled' && revRes.value.ok) {
          const data = await revRes.value.json();
          if (!isCancelled && data.reviews) setReviews(data.reviews);
          if (!isCancelled) setUserReview(data.userReview ?? null);
        }

        if (newsRes.status === 'fulfilled' && newsRes.value.ok) {
          const data = await newsRes.value.json();
          if (!isCancelled && data.articles) setNews(data.articles);
        }

        if (seasonsRes.status === 'fulfilled' && seasonsRes.value.ok) {
          const data = await seasonsRes.value.json();
          if (!isCancelled) {
            if (Array.isArray(data.directSeasons) && data.directSeasons.length > 0) {
              setSeasons(data.directSeasons);
            } else if (Array.isArray(data.seasons)) {
              setSeasons(data.seasons);
            }
          }
        }

        if (episodesRes.status === 'fulfilled' && episodesRes.value.ok) {
          const data = await episodesRes.value.json();
          if (!isCancelled) {
            if (Array.isArray(data.episodes)) {
              setEpisodes(data.episodes);
            }
            if (Array.isArray(data.seasons) && data.seasons.length > 0) {
              setSeasons((prev) => (prev.length === 0 ? data.seasons : prev));
            }
          }
        }
      } catch (err) {
        console.error('Error loading anime details:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    fetchDetails();
    return () => {
      isCancelled = true;
    };
  }, [id]);

  const relatedAnimes = useMemo(() => {
    if (relations && relations.length > 0) return relations;
    return FIXTURE_ANIMES.filter((a) => a.id !== id && a.slug !== id).slice(0, 5);
  }, [id, relations]);

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Skeleton height={420} width="100%" borderRadius="10px" />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
          <Skeleton height={280} width="100%" borderRadius="10px" />
          <Skeleton height={280} width="100%" borderRadius="10px" />
        </div>
      </div>
    );
  }

  if (!anime) {
    return (
      <div className={styles.notFoundContainer}>
        <h2 className={styles.notFoundTitle}>Anime Not Found</h2>
        <p className={styles.notFoundDesc}>The requested anime record could not be found in the database.</p>
        <Link href="/anime" className={styles.backHomeBtn}>
          Back to Anime Catalog
        </Link>
      </div>
    );
  }

  const activeTrailerUrl =
    anime.trailerUrl ||
    DEFAULT_TRAILERS[anime.id] ||
    DEFAULT_TRAILERS[id] ||
    'https://www.youtube.com/watch?v=M_OauHnAFc8';

  const totalEp = anime.episodes || 25;
  const displayTitle = getAnimeDisplayTitle(anime);

  const handleDetailedRateClick = () => {
    setIsRatingModalOpen(true);
  };

  const fetchReviews = async () => {
    try {
      const revRes = await fetch(`/api/reviews?animeId=${anime?.id || id}`);
      if (revRes.ok) {
        const data = await revRes.json();
        if (data.reviews) setReviews(data.reviews);
        setUserReview(data.userReview ?? null);
      }
    } catch (e) {
      console.error('Failed to reload reviews:', e);
    }
  };

  const handleWriteReviewClick = () => {
    if (!user) {
      openAuthModalWithIntent(
        { type: 'WRITE_REVIEW', animeId: anime?.id || id, animeTitle: displayTitle },
        `Sign in to write a community review for ${displayTitle}`
      );
      return;
    }
    setIsReviewModalOpen(true);
  };

  const rawStudio = (anime as any).studio || (Array.isArray(anime.studios) && anime.studios.length > 0 ? anime.studios[0] : null);
  const mainStudioName = typeof rawStudio === 'string'
    ? rawStudio
    : rawStudio?.name || 'WIT Studio';
  const studioSlug = typeof rawStudio === 'object' && rawStudio?.slug
    ? rawStudio.slug
    : String(mainStudioName).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const genresList = Array.isArray(anime.genres) && anime.genres.length > 0
    ? anime.genres
    : ['Action', 'Dark Fantasy', 'Drama', 'Mystery', 'Shounen'];

  return (
    <div className={styles.page}>
      {/* 1. CINEMATIC HERO (Backdrop, Poster, Title, Title-Side Score, Genre Chips, Actions, Watch Progress) */}
      <AnimeHero
        anime={anime}
        userRating={effectiveUserRating}
        onOpenTrailer={() => setIsTrailerOpen(true)}
        onOpenRatingModal={handleDetailedRateClick}
        onOpenReviewDialog={handleWriteReviewClick}
        studioName={mainStudioName}
        studioSlug={studioSlug}
      />

      <main className={styles.mainContainer}>
        <div className={styles.layoutGrid}>
          {/* LEFT / MAIN COLUMN: Story, Episodes, Characters, Staff, Timeline, Franchise, Reviews */}
          <div className={styles.mainCol}>
            {/* 1. OVERVIEW & STORY SYNOPSIS */}
            <section className={styles.contentSection} aria-label="Story Overview">
              <div className={styles.sectionHead}>
                <h2 className={styles.sectionTitle}>Overview</h2>
                <span className={styles.sectionSubtitle}>
                  {anime.year ? `${anime.season || ''} ${anime.year}` : 'Official Synopsis'}
                </span>
              </div>
              <p className={`${styles.desc} ${!isSynopsisExpanded ? styles.descCollapsed : ''}`}>
                {anime.synopsis ||
                  'No synopsis available for this title.'}
              </p>
              <button
                type="button"
                className={styles.showMoreBtn}
                onClick={() => setIsSynopsisExpanded((prev) => !prev)}
              >
                <span>{isSynopsisExpanded ? 'Show Less' : 'Show More'}</span>
                {isSynopsisExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              </button>
            </section>

            {/* 2. COMPACT SEASON-AWARE EPISODE GUIDE */}
            <section className={styles.contentSection} aria-label="Episode Guide">
              <EpisodeQuickList
                animeId={anime.id}
                totalEpisodes={totalEp}
                episodesList={episodes}
                seasonsList={seasons}
                animeTitle={displayTitle}
                onOpenTrailer={() => setIsTrailerOpen(true)}
              />
            </section>

            {/* 3. CHARACTERS & VOICE CAST */}
            <section className={styles.contentSection} aria-label="Characters & Voice Cast">
              <CharacterPreview
                characters={characters}
                animeFallbackPoster={anime.posterImage}
              />
            </section>

            {/* 4. STAFF & KEY CREATORS */}
            <section className={styles.contentSection} aria-label="Staff & Creators">
              <StaffRail staff={staff} />
            </section>

            {/* 5. REAL-WORLD PRODUCTION TIMELINE */}
            <section className={styles.contentSection} aria-label="Production Timeline">
              <ProductionTimeline
                anime={anime}
                animeTitle={displayTitle}
                releaseYear={anime.year}
                relations={relations}
                news={news}
              />
            </section>

            {/* 6. OTAKUVA VIBE DIMENSIONS & PERCEPTION */}
            <section className={styles.contentSection} aria-label="OTAKUVA Vibe & Perception">
              <OtakuvaVibe
                animeTitle={displayTitle}
                categoryAggregates={ratingSummary?.categories}
                ratingCount={ratingSummary?.ratingCount ?? anime.ratingCount}
                confidence={ratingSummary?.confidence}
                rawAverage={ratingSummary?.rawAverage}
                onOpenRateModal={handleDetailedRateClick}
                genres={genresList}
                score={ratingSummary?.score ?? anime.score}
              />
            </section>

            {/* 7. COMMUNITY REVIEWS (Before Related Anime) */}
            <section className={styles.contentSection} aria-label="Community Reviews">
              <AnimeReviewsCard
                animeId={anime.id}
                animeTitle={displayTitle}
                reviews={reviews}
                userReview={userReview}
                onWriteReview={handleWriteReviewClick}
                onEditReview={(rev) => {
                  setReviewToEdit(rev);
                  setIsReviewModalOpen(true);
                }}
                onReviewsChanged={fetchReviews}
              />
            </section>

            {/* 8. RELATED ANIME GRAPH */}
            {relatedAnimes.length > 0 && (
              <section className={styles.contentSection} aria-label="Related Anime">
                <div className={styles.sectionHead}>
                  <h2 className={styles.sectionTitle}>Related Anime</h2>
                  <span className={styles.sectionSubtitle}>Franchise connection graph</span>
                </div>

                <div className={styles.relatedCardsGrid}>
                  {relatedAnimes.map((rel: any, idx: number) => {
                    const relTitle = rel.title || rel.canonicalTitle || 'Related Anime';
                    const relRole = rel.relationType || (idx === 0 ? 'Sequel' : idx === 1 ? 'Prequel' : 'Side Story');
                    return (
                      <Link
                        key={rel.id || idx}
                        href={`/anime/${rel.slug || rel.id}`}
                        className={styles.relatedCard}
                      >
                        <div className={styles.relatedThumb}>
                          <AnimeImage
                            src={rel.posterImage || rel.posterUrl}
                            alt={relTitle}
                            fill
                            sizes="(max-width: 600px) 50vw, 20vw"
                          />
                        </div>
                        <div className={styles.relatedBody}>
                          <strong className={styles.relatedTitle}>{relTitle}</strong>
                          <div className={styles.relatedMeta}>
                            <span>{rel.type || 'TV'}</span>
                            {rel.score && <span>• ★ {Number(rel.score).toFixed(1)}</span>}
                          </div>
                          <span className={styles.relationChip}>{relRole}</span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 9. PERSONALIZED RECOMMENDATIONS */}
            <section className={styles.contentSection} aria-label="Recommendations">
              <PersonalizedRecommendations animeTitle={displayTitle} />
            </section>

            {/* 10. COMMUNITY HUB TEASER */}
            <section className={styles.contentSection} aria-label="Community Discussions">
              <CommunityTeaser
                animeTitle={displayTitle}
                discussions={discussions}
              />
            </section>
          </div>

          {/* RIGHT / SIDEBAR COLUMN: Information, Where to Watch, Rating Distribution, Activity, News */}
          <aside className={styles.sidebarCol} aria-label="Information & Availability">
            {/* Format/status/episodes/duration/source/studio/producers/rating
                now live in one line in the hero (see AnimeHero's kicker) —
                no separate stacked "Information" card here anymore. */}

            {/* 2. Where to Watch */}
            <div className={styles.sidebarSection}>
              <WhereToWatch animeTitle={displayTitle} />
            </div>

            {/* 3. Community Score Breakdown & Rating Distribution */}
            <div className={styles.sidebarSection}>
              <RatingDistributionCard
                score={ratingSummary?.score ?? anime.score}
                ratingCount={ratingSummary?.ratingCount ?? anime.ratingCount}
                distribution={ratingSummary?.distribution}
                reviewCount={reviews.length + (userReview ? 1 : 0)}
                onOpenRateModal={handleDetailedRateClick}
              />
            </div>

            {/* 4. User Collections & Watch Activity */}
            <div className={styles.sidebarSection}>
              <UserActivityCard
                animeId={anime.id}
                totalEpisodes={totalEp}
                userRating={effectiveUserRating}
              />
            </div>

            <div className={styles.sidebarSection}>
              <UserCollectionsCard />
            </div>

            {/* 5. Franchise News Feed */}
            {news && news.length > 0 && (
              <div className={styles.sidebarSection}>
                <AnimeNewsList news={news} />
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* 16. MOBILE/TABLET STICKY ACTION BAR */}
      <AnimeStickyActionBar
        anime={anime}
        userRating={effectiveUserRating}
        onOpenRatingModal={handleDetailedRateClick}
        onOpenTrailer={() => setIsTrailerOpen(true)}
      />

      {/* 17. TRAILER MODAL */}
      <TrailerModal
        isOpen={isTrailerOpen}
        onClose={() => setIsTrailerOpen(false)}
        trailerUrl={activeTrailerUrl}
        title={`${displayTitle} - Official Trailer`}
      />

      {/* 18. DETAILED RATING MODAL */}
      <RatingModal
        isOpen={isRatingModalOpen}
        onClose={() => setIsRatingModalOpen(false)}
        animeId={anime.id}
        animeTitle={displayTitle}
        currentRating={effectiveUserRating}
        currentCategoryRatings={effectiveCategoryRatings}
        onRatingSaved={async (score, categoryScores) => {
          setUserRatingData({
            authenticated: Boolean(user),
            hasRated: true,
            yourRating: score,
            yourCategoryRatings: categoryScores,
          });
          if (!user) {
            setGuestRating({ score, categoryScores });
          }
          await fetchRatingSummary();
        }}
        onRatingDeleted={async () => {
          setUserRatingData({
            authenticated: Boolean(user),
            hasRated: false,
            yourRating: null,
            yourCategoryRatings: {},
          });
          setGuestRating(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem(`otakuva_guest_rating_${id}`);
            if (anime?.id) localStorage.removeItem(`otakuva_guest_rating_${anime.id}`);
          }
          await fetchRatingSummary();
        }}
      />

      {/* 19. WRITE REVIEW MODAL */}
      <WriteReviewModal
        isOpen={isReviewModalOpen}
        onClose={() => {
          setIsReviewModalOpen(false);
          setReviewToEdit(null);
        }}
        animeId={anime.id}
        animeTitle={displayTitle}
        initialReview={reviewToEdit}
        onSuccess={() => {
          fetchReviews();
          fetchRatingSummary();
        }}
      />
    </div>
  );
}
