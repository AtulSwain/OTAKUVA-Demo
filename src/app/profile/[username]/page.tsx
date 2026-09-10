'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  User,
  Star,
  Clock,
  CheckCircle,
  Flame,
  Bookmark,
  Heart,
  Edit3,
  Layers,
  Activity,
  MessageSquare,
} from 'lucide-react';
import { useLibrary } from '../../../context/LibraryContext';
import { useAuth } from '../../../context/AuthContext';
import { FIXTURE_ANIMES } from '../../../fixtures/anime.fixture';
import { Anime } from '../../../types/anime';
import { AnimeCard } from '../../../components/ui/AnimeCard';
import { AnimeGrid } from '../../../components/ui/AnimeGrid';
import { ActivityHeatmap } from '../../../components/profile/ActivityHeatmap';
import { ActivityTimeline } from '../../../components/profile/ActivityTimeline';
import { ProfileEditModal } from '../../../components/profile/ProfileEditModal';
import { ScrollReveal } from '../../../components/ui/ScrollReveal';
import { getAvatarUrl, getBannerUrl } from '../../../lib/mediaResolver';
import styles from './profile.module.css';

type ProfileTab = 'overview' | 'library' | 'favorites' | 'activity' | 'reviews' | 'collections';

export default function ProfilePage({ params }: { params: { username: string } }) {
  const { library, counts } = useLibrary();
  const { user } = useAuth();

  const isSelf = params.username === 'you' || (user && user.username === decodeURIComponent(params.username));
  const rawUsername = params.username === 'you' ? user?.username || 'atulva' : decodeURIComponent(params.username);

  // Local Profile State (supports live editing)
  const [profileData, setProfileData] = useState({
    displayName: isSelf ? (user as any)?.displayName || user?.username || 'Atul Swain' : rawUsername,
    username: rawUsername,
    bio: user?.bio || 'Anime enthusiast, archivist, and seasonal watcher.',
    avatarUrl: (user as any)?.avatarUrl || null,
    bannerUrl: (user as any)?.bannerUrl || null,
    isLibraryPublic: true,
    isActivityPublic: true,
  });

  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    if (isSelf && user) {
      setProfileData((prev) => ({
        ...prev,
        displayName: (user as any)?.displayName || user.username,
        username: user.username,
        bio: user.bio || prev.bio,
        avatarUrl: user.avatarUrl ?? null,
        bannerUrl: user.bannerUrl ?? null,
      }));
    } else if (!isSelf && rawUsername) {
      fetch(`/api/profile?username=${encodeURIComponent(rawUsername)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!isCancelled && data?.user) {
            setProfileData((prev) => ({
              ...prev,
              displayName: data.user.displayName || data.user.username,
              username: data.user.username,
              bio: data.user.bio || prev.bio,
              avatarUrl: data.user.avatarUrl ?? null,
              bannerUrl: data.user.bannerUrl ?? null,
            }));
          }
        })
        .catch(() => {});
    }
    return () => {
      isCancelled = true;
    };
  }, [isSelf, user, rawUsername]);

  useEffect(() => {
    let isCancelled = false;
    const loadReviews = async () => {
      setIsReviewsLoading(true);
      try {
        const queryParam = isSelf && user?.id ? `userId=${user.id}` : `username=${encodeURIComponent(rawUsername)}`;
        const res = await fetch(`/api/reviews?${queryParam}`);
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled && data.reviews) {
            setReviews(data.reviews);
          }
        }
      } catch (err) {
        console.error('Failed to load profile reviews:', err);
      } finally {
        if (!isCancelled) setIsReviewsLoading(false);
      }
    };

    loadReviews();
    return () => {
      isCancelled = true;
    };
  }, [rawUsername, isSelf, user?.id]);

  const stats = useMemo(() => {
    const items = Object.values(library);
    const completedCount = counts.completed;
    const watchingCount = counts.watching;
    const totalEpisodes = items.reduce((acc, curr) => acc + (curr.episodesWatched || 0), 0);

    const totalMinutes = totalEpisodes * 23.5;
    const hoursWatched = (totalMinutes / 60).toFixed(1);

    const ratedItems = items.filter((i) => i.personalRating && i.personalRating > 0);
    const meanScore =
      ratedItems.length > 0
        ? (ratedItems.reduce((acc, curr) => acc + (curr.personalRating || 0), 0) / ratedItems.length).toFixed(1)
        : '0.0';

    return {
      completedCount,
      watchingCount,
      totalEpisodes,
      hoursWatched: `${hoursWatched} hrs`,
      meanScore,
      totalInLibrary: counts.total,
    };
  }, [library, counts]);

  const favorites = useMemo(() => {
    return Object.values(library)
      .filter((i) => i.isFavorite)
      .map((i) => FIXTURE_ANIMES.find((a) => a.id === i.animeId))
      .filter(Boolean) as Anime[];
  }, [library]);

  const libraryItems = useMemo(() => {
    return Object.values(library)
      .map((i) => FIXTURE_ANIMES.find((a) => a.id === i.animeId))
      .filter(Boolean) as Anime[];
  }, [library]);

  const handleProfileSave = (updated: any) => {
    setProfileData((prev) => ({
      ...prev,
      ...updated,
    }));
  };

  return (
    <div className={styles.profilePage}>
      {/* 1. Cinematic Hero Banner & Header */}
      <div className={styles.heroCard}>
        <div className={styles.bannerWrap}>
          {profileData.bannerUrl && (
            <Image
              src={profileData.bannerUrl}
              alt="Profile Banner"
              fill
              className={styles.bannerImg}
              unoptimized
            />
          )}
          <div className={styles.bannerOverlay} />
        </div>

        <div className={styles.profileContent}>
          <div className={styles.headerRow}>
            <div className={styles.avatarLarge}>
              <Image
                src={getAvatarUrl({ avatarUrl: profileData.avatarUrl, username: profileData.username })}
                alt={profileData.displayName}
                fill
                className={styles.avatarImg}
                unoptimized
              />
            </div>

            {isSelf && (
              <button
                type="button"
                className={styles.editBtn}
                onClick={() => setIsEditModalOpen(true)}
              >
                <Edit3 size={14} />
                <span>Edit Profile</span>
              </button>
            )}
          </div>

          <div className={styles.userBioBlock}>
            <div className={styles.nameRow}>
              <h1 className={styles.displayName}>{profileData.displayName}</h1>
              <span className={styles.handleBadge}>@{profileData.username}</span>
            </div>
            <p className={styles.userBio}>{profileData.bio}</p>
          </div>
        </div>
      </div>

      {/* 2. Stats Breakdown Bar */}
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <span className={styles.statVal}>{stats.completedCount}</span>
          <span className={styles.statLabel}>Completed</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statVal}>{stats.watchingCount}</span>
          <span className={styles.statLabel}>Watching</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statVal}>{stats.totalEpisodes}</span>
          <span className={styles.statLabel}>Episodes</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statVal}>{stats.hoursWatched}</span>
          <span className={styles.statLabel}>Watch Time</span>
        </div>
        <div className={styles.statDivider} />
        <div className={styles.statItem}>
          <span className={styles.statVal}>{stats.meanScore}</span>
          <span className={styles.statLabel}>Mean Score</span>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className={styles.tabsNav} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'overview'}
          className={`${styles.tabBtn} ${activeTab === 'overview' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'library'}
          className={`${styles.tabBtn} ${activeTab === 'library' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('library')}
        >
          Library ({libraryItems.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'favorites'}
          className={`${styles.tabBtn} ${activeTab === 'favorites' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('favorites')}
        >
          Favorites ({favorites.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'activity'}
          className={`${styles.tabBtn} ${activeTab === 'activity' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          Activity
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'reviews'}
          className={`${styles.tabBtn} ${activeTab === 'reviews' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('reviews')}
        >
          Reviews ({reviews.length})
        </button>
      </div>

      {/* 4. Tab Contents */}
      <div className={styles.tabContent}>
        {activeTab === 'overview' && (
          <>
            <ScrollReveal>
              <ActivityHeatmap />
            </ScrollReveal>

            {favorites.length > 0 && (
              <ScrollReveal delayMs={50}>
                <section>
                  <h2 className={styles.sectionTitle} style={{ marginBottom: '12px' }}>
                    Favorite Anime
                  </h2>
                  <AnimeGrid columns={6}>
                    {favorites.map((anime) => (
                      <AnimeCard key={anime.id} anime={anime} />
                    ))}
                  </AnimeGrid>
                </section>
              </ScrollReveal>
            )}

            <ScrollReveal delayMs={100}>
              <ActivityTimeline />
            </ScrollReveal>
          </>
        )}

        {activeTab === 'library' && (
          <ScrollReveal>
            <AnimeGrid columns={6}>
              {libraryItems.map((anime) => (
                <AnimeCard key={anime.id} anime={anime} />
              ))}
            </AnimeGrid>
          </ScrollReveal>
        )}

        {activeTab === 'favorites' && (
          <ScrollReveal>
            <AnimeGrid columns={6}>
              {favorites.map((anime) => (
                <AnimeCard key={anime.id} anime={anime} />
              ))}
            </AnimeGrid>
          </ScrollReveal>
        )}

        {activeTab === 'activity' && (
          <ScrollReveal>
            <ActivityHeatmap />
            <ActivityTimeline />
          </ScrollReveal>
        )}

        {activeTab === 'reviews' && (
          <ScrollReveal>
            {isReviewsLoading ? (
              <div className={styles.loadingReviews}>Loading reviews...</div>
            ) : reviews.length === 0 ? (
              <div className={styles.emptyReviews}>
                <MessageSquare size={36} className={styles.emptyIcon} />
                <p className={styles.emptyTitle}>No reviews published yet</p>
                <p className={styles.emptySub}>
                  {isSelf
                    ? 'Explore anime, rate them, and share your detailed thoughts to build your reviews archive.'
                    : `${profileData.displayName} has not written any community reviews yet.`}
                </p>
                {isSelf && (
                  <Link href="/catalog" className={styles.exploreBtn}>
                    Explore Anime
                  </Link>
                )}
              </div>
            ) : (
              <div className={styles.reviewsGrid}>
                {reviews.map((rev) => (
                  <div key={rev.id} className={styles.profileReviewCard}>
                    <div className={styles.reviewPosterCol}>
                      <Link href={`/anime/${rev.anime?.slug || rev.anime?.id}`}>
                        <div className={styles.reviewPosterWrap}>
                          <img
                            src={rev.anime?.posterImage || '/images/placeholder-poster.jpg'}
                            alt={rev.anime?.title || 'Anime'}
                            className={styles.reviewPoster}
                          />
                        </div>
                      </Link>
                    </div>

                    <div className={styles.reviewMainCol}>
                      <div className={styles.reviewTopRow}>
                        <Link
                          href={`/anime/${rev.anime?.slug || rev.anime?.id}`}
                          className={styles.animeTitleLink}
                        >
                          {rev.anime?.title || 'Anime Review'}
                        </Link>
                        <div className={styles.reviewBadgesRow}>
                          {rev.rating !== null && rev.rating !== undefined ? (
                            <span className={styles.profileRatingBadge}>
                              <Star size={11} fill="#F59E0B" stroke="#F59E0B" />
                              {rev.rating.toFixed(1)}/10
                            </span>
                          ) : (
                            <span className={styles.profileUnratedBadge}>No score</span>
                          )}
                          {rev.spoilerLevel && rev.spoilerLevel !== 'SPOILER_FREE' && (
                            <span className={styles.profileSpoilerBadge}>
                              {rev.spoilerLevel.replace('_', ' ')}
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 className={styles.profileReviewHeadline}>{rev.title}</h4>
                      <p className={styles.profileReviewBody}>{rev.body}</p>

                      <div className={styles.profileReviewFooter}>
                        {rev.watchStatusAtReview && (
                          <span className={styles.profileStatusBadge}>
                            {rev.watchStatusAtReview.replace('_', ' ')}
                            {typeof rev.episodeProgressAtReview === 'number'
                              ? ` (Ep ${rev.episodeProgressAtReview})`
                              : ''}
                          </span>
                        )}
                        <span className={styles.profileReviewDate}>
                          {new Date(rev.createdAt).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                          {rev.edited && ' • edited'}
                        </span>
                        <span className={styles.profileLikesCount}>
                          {rev.likesCount || 0} helpful votes
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollReveal>
        )}
      </div>

      {/* 5. Profile Editor Modal */}
      <ProfileEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        initialProfile={profileData}
        onSave={handleProfileSave}
      />
    </div>
  );
}
