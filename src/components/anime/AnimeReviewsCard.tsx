'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Star,
  ThumbsUp,
  Flag,
  Edit3,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Eye,
  EyeOff,
  Filter,
  ArrowUpDown,
  PenTool,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ReportReviewModal } from '../review/ReportReviewModal';
import styles from './AnimeReviewsCard.module.css';

export interface ReviewItem {
  id: string;
  title: string;
  body: string;
  rating?: number | null;
  spoilerLevel?: 'SPOILER_FREE' | 'MILD_SPOILERS' | 'SPOILERS' | 'FULL_SPOILERS';
  containsSpoiler?: boolean;
  watchStatusAtReview?: string | null;
  episodeProgressAtReview?: number | null;
  edited?: boolean;
  likesCount?: number;
  overallSentiment?: string;
  createdAt?: string;
  updatedAt?: string;
  userLiked?: boolean;
  isOwnReview?: boolean;
  user?: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  };
  anime?: {
    id: string;
    slug?: string;
    title?: string;
    canonicalTitle?: string;
    posterImage?: string | null;
  };
  aspects?: Array<{
    aspect: string;
    sentiment: string;
    sentimentScore: number;
    confidence: number;
  }>;
}

interface AnimeReviewsCardProps {
  animeId?: string;
  animeTitle?: string;
  reviews?: ReviewItem[];
  userReview?: ReviewItem | null;
  onWriteReview?: () => void;
  onEditReview?: (review: ReviewItem) => void;
  onReviewsChanged?: () => void;
}

export const AnimeReviewsCard: React.FC<AnimeReviewsCardProps> = ({
  animeId,
  animeTitle = 'this anime',
  reviews = [],
  userReview = null,
  onWriteReview,
  onEditReview,
  onReviewsChanged,
}) => {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [likeStates, setLikeStates] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [reportingReview, setReportingReview] = useState<{ id: string; title: string } | null>(null);
  const [spoilerFilter, setSpoilerFilter] = useState<'ALL' | 'SPOILER_FREE'>('ALL');
  const [sortBy, setSortBy] = useState<'RECOMMENDED' | 'HELPFUL' | 'NEWEST' | 'HIGHEST' | 'LOWEST'>('RECOMMENDED');

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleHelpfulToggle = async (rev: ReviewItem) => {
    if (!user) {
      showToast('Please sign in to vote on reviews', 'info');
      return;
    }

    const current = likeStates[rev.id] ?? {
      count: rev.likesCount || 0,
      liked: Boolean(rev.userLiked),
    };

    const nextLiked = !current.liked;
    const nextCount = Math.max(0, current.count + (nextLiked ? 1 : -1));

    // Optimistic update
    setLikeStates((prev) => ({
      ...prev,
      [rev.id]: { count: nextCount, liked: nextLiked },
    }));

    try {
      const res = await fetch(`/api/reviews/${rev.id}/helpful`, {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Failed to toggle vote');
      }
      const data = await res.json();
      if (typeof data.likesCount === 'number') {
        setLikeStates((prev) => ({
          ...prev,
          [rev.id]: { count: data.likesCount, liked: data.userLiked ?? nextLiked },
        }));
      }
    } catch {
      // Rollback on failure
      setLikeStates((prev) => ({
        ...prev,
        [rev.id]: current,
      }));
      showToast('Failed to update vote', 'error');
    }
  };

  const formatDate = (rawDate?: string) => {
    if (!rawDate) return 'Recently';
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return rawDate;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return rawDate;
    }
  };

  const getSpoilerBadge = (level?: string) => {
    switch (level) {
      case 'FULL_SPOILERS':
        return (
          <span className={`${styles.spoilerBadge} ${styles.badgeFullSpoiler}`}>
            <AlertTriangle size={11} />
            Major Spoilers
          </span>
        );
      case 'SPOILERS':
        return (
          <span className={`${styles.spoilerBadge} ${styles.badgeSpoiler}`}>
            <AlertTriangle size={11} />
            Spoilers
          </span>
        );
      case 'MILD_SPOILERS':
        return (
          <span className={`${styles.spoilerBadge} ${styles.badgeMild}`}>
            <ShieldAlert size={11} />
            Mild Spoilers
          </span>
        );
      default:
        return (
          <span className={`${styles.spoilerBadge} ${styles.badgeSafe}`}>
            <ShieldCheck size={11} />
            Spoiler Free
          </span>
        );
    }
  };

  // Exclude userReview from community list if userReview is pinned
  const communityReviews = reviews.filter((r) => !userReview || r.id !== userReview.id);

  // Apply client filters and sort
  const filteredReviews = communityReviews.filter((r) => {
    if (spoilerFilter === 'SPOILER_FREE') {
      return !r.spoilerLevel || r.spoilerLevel === 'SPOILER_FREE';
    }
    return true;
  });

  const sortedReviews = [...filteredReviews].sort((a, b) => {
    const aLikes = likeStates[a.id]?.count ?? a.likesCount ?? 0;
    const bLikes = likeStates[b.id]?.count ?? b.likesCount ?? 0;
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    const aRating = a.rating ?? -1;
    const bRating = b.rating ?? -1;

    if (sortBy === 'HELPFUL') return bLikes - aLikes;
    if (sortBy === 'NEWEST') return bTime - aTime;
    if (sortBy === 'HIGHEST') return bRating - aRating;
    if (sortBy === 'LOWEST') return aRating - bRating;
    // RECOMMENDED default: likes weighted with recency
    return bLikes !== aLikes ? bLikes - aLikes : bTime - aTime;
  });

  const totalReviewsCount = (userReview ? 1 : 0) + communityReviews.length;

  return (
    <div className={styles.card} role="region" aria-label="Community Reviews">
      {/* Header */}
      <div className={styles.headerRow}>
        <div className={styles.headerTitleGroup}>
          <h3 className={styles.headerTitle}>Community Reviews</h3>
          <span className={styles.reviewCountBadge}>{totalReviewsCount}</span>
        </div>
        <div className={styles.headerActions}>
          {!userReview && onWriteReview && (
            <button type="button" className={styles.writeReviewBtn} onClick={onWriteReview}>
              <PenTool size={13} />
              <span>Write a Review</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Sort bar if multiple reviews exist */}
      {communityReviews.length > 1 && (
        <div className={styles.controlBar}>
          <div className={styles.filterGroup}>
            <button
              type="button"
              className={`${styles.filterChip} ${spoilerFilter === 'ALL' ? styles.filterChipActive : ''}`}
              onClick={() => setSpoilerFilter('ALL')}
            >
              All
            </button>
            <button
              type="button"
              className={`${styles.filterChip} ${spoilerFilter === 'SPOILER_FREE' ? styles.filterChipActive : ''}`}
              onClick={() => setSpoilerFilter('SPOILER_FREE')}
            >
              <ShieldCheck size={12} />
              Spoiler Free
            </button>
          </div>

          <div className={styles.sortGroup}>
            <ArrowUpDown size={12} className={styles.sortIcon} />
            <select
              className={styles.sortSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="RECOMMENDED">Recommended</option>
              <option value="HELPFUL">Most Helpful</option>
              <option value="NEWEST">Newest</option>
              <option value="HIGHEST">Highest Rated</option>
              <option value="LOWEST">Lowest Rated</option>
            </select>
          </div>
        </div>
      )}

      {/* 1. PINNED USER REVIEW SECTION */}
      {userReview && (
        <div className={styles.userReviewPinnedBox}>
          <div className={styles.userReviewHeader}>
            <div className={styles.userReviewBadge}>
              <CheckCircle2 size={13} />
              <span>Your Review</span>
            </div>
            {onEditReview && (
              <button
                type="button"
                className={styles.editReviewBtn}
                onClick={() => onEditReview(userReview)}
              >
                <Edit3 size={13} />
                <span>Edit</span>
              </button>
            )}
          </div>

          <div className={styles.reviewMetaRow}>
            {userReview.rating !== null && userReview.rating !== undefined ? (
              <div className={styles.ratingBadge}>
                <Star size={12} fill="#F59E0B" stroke="#F59E0B" />
                <span>{userReview.rating.toFixed(1)}/10</span>
              </div>
            ) : (
              <span className={styles.unratedBadge}>No Score</span>
            )}
            {getSpoilerBadge(userReview.spoilerLevel)}
            {userReview.watchStatusAtReview && (
              <span className={styles.watchStatusBadge}>
                {userReview.watchStatusAtReview.replace('_', ' ')}
                {typeof userReview.episodeProgressAtReview === 'number'
                  ? ` (Ep ${userReview.episodeProgressAtReview})`
                  : ''}
              </span>
            )}
            <span className={styles.dateText}>
              {formatDate(userReview.createdAt)}
              {userReview.edited && ' (edited)'}
            </span>
          </div>

          <h4 className={styles.reviewHeadline}>{userReview.title}</h4>
          <p className={styles.reviewBodyText}>{userReview.body}</p>

          <div className={styles.pinnedFooter}>
            <span className={styles.helpfulCountText}>
              {userReview.likesCount || 0} people found this helpful
            </span>
          </div>
        </div>
      )}

      {/* 2. HONEST EMPTY STATE */}
      {totalReviewsCount === 0 && (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No reviews yet</p>
          <p className={styles.emptySubtitle}>
            Be the first to share your thoughts and critique on {animeTitle}!
          </p>
          {onWriteReview && (
            <button type="button" className={styles.emptyWriteBtn} onClick={onWriteReview}>
              <PenTool size={14} />
              <span>Write the First Review</span>
            </button>
          )}
        </div>
      )}

      {/* 3. COMMUNITY REVIEWS LIST */}
      {sortedReviews.length > 0 && (
        <div className={styles.reviewsList}>
          {sortedReviews.map((rev) => {
            const username = rev.user?.username || 'OtakuMember';
            const initial = username.slice(0, 2).toUpperCase();
            const isSpoiler = rev.spoilerLevel && rev.spoilerLevel !== 'SPOILER_FREE';
            const isRevealed = revealedIds.has(rev.id);
            const currentLike = likeStates[rev.id] ?? {
              count: rev.likesCount || 0,
              liked: Boolean(rev.userLiked),
            };

            return (
              <div key={rev.id} className={styles.reviewItem}>
                {/* User Row */}
                <div className={styles.userRow}>
                  <div className={styles.userInfo}>
                    <div className={styles.avatar}>
                      {rev.user?.avatarUrl ? (
                        <img
                          src={rev.user.avatarUrl}
                          alt={username}
                          className={styles.avatarImg}
                        />
                      ) : (
                        <span>{initial}</span>
                      )}
                    </div>
                    <div className={styles.userDetails}>
                      <Link href={`/profile/${username}`} className={styles.userName}>
                        {username}
                      </Link>
                      <div className={styles.subMeta}>
                        <span className={styles.date}>{formatDate(rev.createdAt)}</span>
                        {rev.edited && <span className={styles.editedText}>(edited)</span>}
                        {rev.watchStatusAtReview && (
                          <span className={styles.watchStatusTag}>
                            {rev.watchStatusAtReview.replace('_', ' ')}
                            {typeof rev.episodeProgressAtReview === 'number'
                              ? ` (Ep ${rev.episodeProgressAtReview})`
                              : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={styles.userRightMeta}>
                    {rev.rating !== null && rev.rating !== undefined ? (
                      <div className={styles.ratingBadge}>
                        <Star size={12} fill="#F59E0B" stroke="#F59E0B" />
                        <span>{rev.rating.toFixed(1)}/10</span>
                      </div>
                    ) : (
                      <span className={styles.unratedBadge}>No Score</span>
                    )}
                    {getSpoilerBadge(rev.spoilerLevel)}
                  </div>
                </div>

                {/* Review Content / Spoiler Shield */}
                {isSpoiler && !isRevealed ? (
                  <div className={styles.spoilerShieldBox}>
                    <div className={styles.spoilerShieldContent}>
                      <AlertTriangle size={16} className={styles.shieldIcon} />
                      <div className={styles.shieldText}>
                        <strong>Spoiler Warning</strong>
                        <p>This review contains plot revelations ({rev.spoilerLevel?.replace('_', ' ').toLowerCase()}).</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className={styles.revealBtn}
                      onClick={() => toggleReveal(rev.id)}
                    >
                      <Eye size={13} />
                      <span>Reveal Review</span>
                    </button>
                  </div>
                ) : (
                  <>
                    <h4 className={styles.reviewHeadline}>{rev.title}</h4>
                    <p className={styles.reviewBodyText}>{rev.body}</p>
                    {isSpoiler && isRevealed && (
                      <button
                        type="button"
                        className={styles.hideSpoilerBtn}
                        onClick={() => toggleReveal(rev.id)}
                      >
                        <EyeOff size={12} />
                        <span>Hide Spoilers</span>
                      </button>
                    )}
                  </>
                )}

                {/* Aspect sentiments (if extracted) */}
                {rev.aspects && rev.aspects.length > 0 && (
                  <div className={styles.aspectsRow}>
                    {rev.aspects.slice(0, 4).map((asp, aIdx) => (
                      <span
                        key={aIdx}
                        className={`${styles.aspectChip} ${
                          asp.sentiment === 'POSITIVE'
                            ? styles.aspectPositive
                            : asp.sentiment === 'NEGATIVE'
                            ? styles.aspectNegative
                            : styles.aspectNeutral
                        }`}
                      >
                        {asp.aspect}: {asp.sentiment.toLowerCase()}
                      </span>
                    ))}
                  </div>
                )}

                {/* Actions: Helpful & Report */}
                <div className={styles.actionRow}>
                  <button
                    type="button"
                    className={`${styles.actionBtn} ${currentLike.liked ? styles.actionBtnActive : ''}`}
                    onClick={() => handleHelpfulToggle(rev)}
                    aria-label={`Mark review as helpful (${currentLike.count} helpful votes)`}
                  >
                    <ThumbsUp size={12} fill={currentLike.liked ? 'currentColor' : 'none'} />
                    <span>Helpful ({currentLike.count})</span>
                  </button>

                  <button
                    type="button"
                    className={`${styles.actionBtn} ${styles.reportBtn}`}
                    onClick={() => setReportingReview({ id: rev.id, title: rev.title })}
                    aria-label="Report review"
                  >
                    <Flag size={12} />
                    <span>Report</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report Modal */}
      {reportingReview && (
        <ReportReviewModal
          isOpen={Boolean(reportingReview)}
          onClose={() => setReportingReview(null)}
          reviewId={reportingReview.id}
          reviewTitle={reportingReview.title}
        />
      )}
    </div>
  );
};
