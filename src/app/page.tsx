'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Star, ArrowRight, Play } from 'lucide-react';
import { Anime } from '../types/anime';
import { SpotlightHero } from '../components/home/SpotlightHero';
import { EditorsPickFeature } from '../components/home/EditorsPickFeature';
import { DiscoverMoreSection } from '../components/home/DiscoverMoreSection';
import { AnimeImage } from '../components/anime/AnimeImage';
import { TrailerModal } from '../components/ui/TrailerModal';
import { Skeleton } from '../components/ui/Skeleton';
import { useAuth } from '../context/AuthContext';
import { getAnimeDisplayTitle } from '../lib/animeTitleResolver';
import styles from './page.module.css';

type HomeAnime = Anime & {
  otakuva_anime_id?: string;
  otakuvaScore?: number | null;
  ratingCount?: number | null;
  scoredBy?: number | null;
  canonicalTitle?: string;
  posterUrl?: string;
  bannerUrl?: string;
  trendMomentum?: string;
  trendRank?: string;
};

type ContinueItem = {
  id: string;
  anime: HomeAnime;
  episodesWatched: number;
  totalEpisodes: number | null;
  updatedAt: string;
};

type AiringItem = {
  id: string;
  episodeNumber: number;
  airingAt: string;
  anime: HomeAnime;
};

type StudioItem = {
  id: string;
  slug: string;
  name: string;
  description?: string;
  imageUrl?: string | null;
  projectCount?: number;
  knownFor: HomeAnime[];
};

type CreatorItem = {
  id: string;
  slug: string;
  name: string;
  role?: string;
  about?: string;
  imageUrl?: string | null;
  knownFor: HomeAnime[];
};

type NewsItem = {
  id: string;
  slug: string;
  title: string;
  summary?: string;
  imageUrl?: string | null;
  source: string;
  date: string;
  category: string;
  readTime?: string;
};

type CommunityItem = {
  id: string;
  title: string;
  slug: string;
  replies: number;
  username?: string;
  contentType?: string;
  communityName?: string | null;
  communitySlug?: string | null;
};

type HomeData = {
  hero: HomeAnime[];
  trending: HomeAnime[];
  continueWatching: ContinueItem[];
  airing: AiringItem[];
  topRated: HomeAnime[];
  editorsPicks: any[];
  studios: StudioItem[];
  creators: CreatorItem[];
  news: NewsItem[];
  community: {
    discussions: CommunityItem[];
    communities: any[];
  };
  recommendations: HomeAnime[];
};

export default function HomePage() {
  const { user } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [trailerModal, setTrailerModal] = useState<{ isOpen: boolean; url: string; title: string }>({
    isOpen: false,
    url: '',
    title: '',
  });

  useEffect(() => {
    let isCancelled = false;
    async function loadHome() {
      try {
        const res = await fetch('/api/home');
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && json.sections) {
            setData(json.sections);
          }
        }
      } catch (e) {
        console.error('Failed to load home sections:', e);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }
    loadHome();
    return () => {
      isCancelled = true;
    };
  }, []);

  const openTrailer = (url: string, title: string) => {
    setTrailerModal({ isOpen: true, url, title });
  };

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingContainer}>
          <Skeleton height={580} width="100%" borderRadius="10px" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} height={240} width="100%" borderRadius="8px" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const heroList = data?.hero || [];
  const trendingList = data?.trending || [];
  const continueList = data?.continueWatching || [];
  const airingList = data?.airing || [];
  const topRatedList = data?.topRated || [];
  const editorsPickItem = data?.editorsPicks?.[0] || null;
  const studiosList = data?.studios || [];
  const creatorsList = data?.creators || [];
  const newsList = data?.news || [];
  const discussionsList = data?.community?.discussions || [];

  return (
    <div className={styles.page}>
      {/* 1. CINEMATIC HERO */}
      <SpotlightHero
        animeList={heroList}
        onOpenTrailer={openTrailer}
      />

      <main className={styles.main}>
        {/* 2. CONTINUE WATCHING */}
        <section className={styles.section} aria-label="Continue Watching">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>For you</p>
              <h2 className={styles.sectionTitle}>Continue Watching</h2>
            </div>
            <span className={styles.sectionSub}>Your progress</span>
          </div>

          {user && continueList.length > 0 ? (
            <div className={styles.continueRail}>
              {continueList.map((item) => {
                const animeTitle = getAnimeDisplayTitle(item.anime);
                const total = item.totalEpisodes || 24;
                const progressPct = Math.round((item.episodesWatched / total) * 100);

                return (
                  <Link key={item.id} href={`/anime/${item.anime.slug || item.anime.id}`} className={styles.card}>
                    <div className={styles.continuePosterWrapper}>
                      <AnimeImage
                        src={item.anime.bannerImage || item.anime.posterImage}
                        alt={animeTitle}
                        fill
                        sizes="300px"
                      />
                    </div>
                    <div className={styles.cardBody}>
                      <strong className={styles.cardTitle}>{animeTitle}</strong>
                      <span className={styles.cardMeta}>
                        Episode {item.episodesWatched} of {total}
                      </span>
                      <div className={styles.progressBar}>
                        <span className={styles.progressFill} style={{ width: `${progressPct}%` }} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={styles.guestOnboardingCard}>
              <div>
                <h3 className={styles.guestHeading}>Build your anime library</h3>
                <p className={styles.guestText}>Track what you watch, episode by episode, rating by rating.</p>
              </div>
              <Link href="/anime" className={styles.guestBtn}>
                Start Tracking
              </Link>
            </div>
          )}
        </section>

        {/* 3. TRENDING NOW */}
        <section className={styles.section} aria-label="Trending Anime">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Right now</p>
              <h2 className={styles.sectionTitle}>Trending Now</h2>
            </div>
            <Link href="/rankings" className={styles.sectionSub}>
              What&apos;s moving on OTAKUVA →
            </Link>
          </div>

          <div className={styles.rail}>
            {trendingList.map((anime, idx) => {
              const displayTitle = getAnimeDisplayTitle(anime);
              const rankStr = String(idx + 1).padStart(2, '0');
              const score = typeof anime.score === 'number' && anime.score > 0 ? Number(anime.score).toFixed(1) : '—';
              const momentum = anime.trendMomentum || null;

              return (
                <Link key={anime.id} href={`/anime/${anime.slug || anime.id}`} className={styles.card}>
                  <div className={styles.posterWrapper}>
                    <span className={styles.rankBadge}>{rankStr}</span>
                    <AnimeImage
                      src={anime.posterImage || anime.posterUrl}
                      alt={displayTitle}
                      fill
                      sizes="180px"
                    />
                  </div>
                  <div className={styles.cardBody}>
                    <strong className={styles.cardTitle}>{displayTitle}</strong>
                    <div className={styles.cardScore}>
                      <Star size={11} fill="currentColor" />
                      <span>{score}</span>
                    </div>
                    {momentum && <span className={styles.trendMomentum}>{momentum}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 4. THIS SEASON */}
        <section className={styles.section} aria-label="Seasonal Anime Broadcasts">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Seasonal</p>
              <h2 className={styles.sectionTitle}>This Season</h2>
            </div>
            <Link href="/seasonal" className={styles.sectionSub}>
              Summer 2026 · Explore season →
            </Link>
          </div>

          <div className={styles.rail}>
            {airingList.map((item) => {
              const displayTitle = getAnimeDisplayTitle(item.anime);
              const score = typeof item.anime?.score === 'number' && item.anime.score > 0 ? Number(item.anime.score).toFixed(1) : '—';
              const epText = item.episodeNumber ? `Airing • EP ${item.episodeNumber}` : 'Airing';

              return (
                <Link key={item.id} href={`/anime/${item.anime.slug || item.anime.id}`} className={styles.card}>
                  <div className={styles.posterWrapper}>
                    <AnimeImage
                      src={item.anime.posterImage || item.anime.posterUrl}
                      alt={displayTitle}
                      fill
                      sizes="180px"
                    />
                  </div>
                  <div className={styles.cardBody}>
                    <strong className={styles.cardTitle}>{displayTitle}</strong>
                    <span className={styles.cardMeta}>{epText}</span>
                    <div className={styles.cardScore}>
                      <Star size={11} fill="currentColor" />
                      <span>{score}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 5. OTAKUVA TOP RATED */}
        <section className={styles.section} aria-label="OTAKUVA Top Rated Leaderboard">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Community signal</p>
              <h2 className={styles.sectionTitle}>OTAKUVA Top Rated</h2>
            </div>
            <Link href="/rankings" className={styles.sectionSub}>
              The highest-rated stories →
            </Link>
          </div>

          <div className={styles.rail}>
            {topRatedList.map((anime, idx) => {
              const displayTitle = getAnimeDisplayTitle(anime);
              const rankStr = String(idx + 1).padStart(2, '0');
              const score = typeof anime.score === 'number' && anime.score > 0 ? Number(anime.score).toFixed(1) : '—';
              const count = typeof anime.ratingCount === 'number' ? anime.ratingCount : (typeof anime.scoredBy === 'number' ? anime.scoredBy : 0);
              const ratingCount = count >= 1000000
                ? `${(count / 1000000).toFixed(1)}M ratings`
                : count >= 1000
                ? `${Math.round(count / 1000)}K ratings`
                : count > 0
                ? `${count} ratings`
                : null;

              return (
                <Link key={anime.id} href={`/anime/${anime.slug || anime.id}`} className={styles.card}>
                  <div className={styles.posterWrapper}>
                    <span className={styles.rankBadge}>{rankStr}</span>
                    <AnimeImage
                      src={anime.posterImage || anime.posterUrl}
                      alt={displayTitle}
                      fill
                      sizes="180px"
                    />
                  </div>
                  <div className={styles.cardBody}>
                    <strong className={styles.cardTitle}>{displayTitle}</strong>
                    <div className={styles.cardScore}>
                      <Star size={11} fill="currentColor" />
                      <span>{score}</span>
                    </div>
                    {ratingCount && <span className={styles.cardMeta}>{ratingCount}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* 6. EDITOR'S PICK (MAGAZINE FEATURE) */}
        <EditorsPickFeature anime={editorsPickItem} />

        {/* 7. STUDIOS */}
        <section className={styles.section} aria-label="Animation Studios Spotlight">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Behind the stories</p>
              <h2 className={styles.sectionTitle}>Studios</h2>
            </div>
            <Link href="/studios" className={styles.sectionSub}>
              Explore production →
            </Link>
          </div>

          <div className={styles.rail}>
            {studiosList.map((studio) => (
              <Link key={studio.id} href={`/studios/${studio.slug || studio.id}`} className={styles.card}>
                <div className={styles.posterWrapper}>
                  <AnimeImage
                    src={studio.imageUrl || (studio.knownFor?.[0]?.posterImage)}
                    alt={studio.name}
                    fill
                    sizes="180px"
                  />
                </div>
                <div className={styles.cardBody}>
                  <strong className={styles.cardTitle}>{studio.name}</strong>
                  <span className={styles.cardMeta}>{studio.projectCount || 24} projects</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 8. CREATORS */}
        <section className={styles.section} aria-label="Creators and Directors">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>The people</p>
              <h2 className={styles.sectionTitle}>Creators</h2>
            </div>
            <Link href="/creators" className={styles.sectionSub}>
              Directors · Writers · Artists →
            </Link>
          </div>

          <div className={styles.rail}>
            {creatorsList.map((creator) => (
              <Link key={creator.id} href={`/creators/${creator.slug || creator.id}`} className={styles.card}>
                <div className={styles.posterWrapper}>
                  <AnimeImage
                    src={creator.imageUrl || (creator.knownFor?.[0]?.posterImage)}
                    alt={creator.name}
                    fill
                    sizes="180px"
                  />
                </div>
                <div className={styles.cardBody}>
                  <strong className={styles.cardTitle}>{creator.name}</strong>
                  <span className={styles.cardMeta}>{creator.role || 'Director'}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 9. LATEST ANIME NEWS */}
        <section className={styles.section} aria-label="Latest Anime News">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Editorial</p>
              <h2 className={styles.sectionTitle}>Latest Anime News</h2>
            </div>
            <Link href="/news" className={styles.sectionSub}>
              View all news →
            </Link>
          </div>

          <div className={styles.newsGrid}>
            {newsList.slice(0, 3).map((article, idx) => (
              <Link key={article.id} href={`/news/${article.slug || article.id}`} className={styles.newsCard}>
                <div className={styles.newsArtwork}>
                  <AnimeImage
                    src={article.imageUrl}
                    alt={article.title}
                    fill
                    sizes="(max-width: 900px) 100vw, 33vw"
                    className={styles.newsArtworkImg}
                  />
                  <div className={styles.newsOverlay} />
                </div>
                <div className={styles.newsContent}>
                  <span className={styles.newsKicker}>
                    {idx === 0 ? 'FEATURED • ' : ''}
                    {article.category || 'INDUSTRY'}
                  </span>
                  <h3 className={styles.newsTitle}>{article.title}</h3>
                  <span className={styles.newsMeta}>
                    {article.source} • {article.readTime || '4 min read'}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 10. COMMUNITY */}
        <section className={styles.section} aria-label="Community Discussions">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Social</p>
              <h2 className={styles.sectionTitle}>Community</h2>
            </div>
            <Link href="/community" className={styles.sectionSub}>
              Explore discussions →
            </Link>
          </div>

          <div className={styles.communityGrid}>
            {discussionsList.slice(0, 2).map((disc) => (
              <Link key={disc.id} href={`/discussions/${disc.id}`} className={styles.communityCard}>
                <span className={styles.communityUser}>
                  @{disc.username || 'animeobserver'} · {disc.contentType || 'Discussion'}
                </span>
                <h3 className={styles.communityTitle}>{disc.title}</h3>
                <p className={styles.communityExcerpt}>
                  Join the conversation with community members discussing theories, analysis, and reviews.
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* 11. DISCOVER MORE */}
        <DiscoverMoreSection />
      </main>

      {/* Trailer Modal */}
      <TrailerModal
        isOpen={trailerModal.isOpen}
        onClose={() => setTrailerModal({ isOpen: false, url: '', title: '' })}
        trailerUrl={trailerModal.url}
        title={trailerModal.title}
      />
    </div>
  );
}
