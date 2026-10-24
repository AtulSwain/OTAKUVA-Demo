'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ThumbsUp,
  Flag,
  Edit3,
  ShieldCheck,
  Clapperboard,
  ShieldAlert,
  AlertTriangle,
  Eye,
  EyeOff,
  ArrowUpDown,
  PenTool,
  CheckCircle2,
  MessageCircle,
  Trash2,
  Pin,
  PinOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ReportReviewModal } from '../review/ReportReviewModal';
import { UserAvatar } from '../ui/UserAvatar';
import BadgeChip from '../badges/BadgeChip';
import { isTierKey } from '../../lib/badges/tiers';
import { reviewTagLabel } from '../../lib/reviews/reviewTags';
import type { CommunityTag, ReplyItem } from '../../lib/reviews/reviewSocial';
import { getScoreColor, getScoreSoftColor } from '../../lib/rating/ratingTiers';
import styles from './AnimeReviewsCard.module.css';
import { Composer } from '../ui/Composer';

/** The reviewer's own rating from the rating section, read-only. Nothing when they haven't rated. */
function ReviewerScore({ score }: { score?: number | null }) {
  if (typeof score !== 'number') return null;
  return (
    <span
      className={styles.reviewerScore}
      style={{ color: getScoreColor(score), background: getScoreSoftColor(score, 0.14) }}
      title="This reviewer's rating of the anime"
    >
      ★ {score.toFixed(1)}
    </span>
  );
}

export interface ReviewItem {
  id: string;
  title?: string;
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
  /** Published by a creator account (stamped by the server). */
  isCreatorReview?: boolean;
  /** Set when a moderator pinned it to the top of the anime's reviews. */
  pinnedAt?: string | null;
  tags?: string[];
  replyCount?: number;
  replies?: ReplyItem[];
  user?: {
    id: string;
    username: string;
    avatarUrl?: string | null;
    /** Reviewer's current badge tier (not the tier when the review was written). */
    badge?: { tier: string; count: number };
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
  /** Reviews pinned to the top by a moderator. */
  pinned?: ReviewItem[];
  /** The viewer may pin/unpin (moderators and admins). */
  canPin?: boolean;
  communityTags?: CommunityTag[];
  onWriteReview?: () => void;
  onEditReview?: (review: ReviewItem) => void;
  onReviewsChanged?: () => void;
}

// Reviews show what people wrote, their tags and the conversation under it,
// plus the reviewer's own rating (read-only — it's entered in the rating
// section, never in the review).
export const AnimeReviewsCard: React.FC<AnimeReviewsCardProps> = ({
  animeTitle = 'this anime',
  reviews = [],
  userReview = null,
  pinned = [],
  canPin = false,
  communityTags = [],
  onWriteReview,
  onEditReview,
  onReviewsChanged,
}) => {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();

  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [likeStates, setLikeStates] = useState<Record<string, { count: number; liked: boolean }>>({});
  const [reportingReview, setReportingReview] = useState<{ id: string; title: string } | null>(null);
  const [spoilerFilter, setSpoilerFilter] = useState<'ALL' | 'SPOILER_FREE' | 'CREATORS'>('ALL');
  const [sortBy, setSortBy] = useState<'RECOMMENDED' | 'HELPFUL' | 'NEWEST'>('RECOMMENDED');

  // Replies loaded per review (starts with the API's inline first page).
  const [replyState, setReplyState] = useState<Record<string, { replies: ReplyItem[]; count: number }>>({});
  const [openComposer, setOpenComposer] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [postingReply, setPostingReply] = useState(false);
  const [loadingAll, setLoadingAll] = useState<string | null>(null);

  const repliesFor = (r: ReviewItem) => replyState[r.id] ?? { replies: r.replies ?? [], count: r.replyCount ?? 0 };

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

  const loadAllReplies = async (reviewId: string) => {
    setLoadingAll(reviewId);
    try {
      const res = await fetch(`/api/reviews/${reviewId}/replies`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReplyState((prev) => ({ ...prev, [reviewId]: { replies: data.replies, count: data.replies.length } }));
    } catch {
      showToast('Could not load replies', 'error');
    } finally {
      setLoadingAll(null);
    }
  };

  const startReply = (reviewId: string) => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    setOpenComposer((cur) => (cur === reviewId ? null : reviewId));
    setReplyDraft('');
  };

  const postReply = async (rev: ReviewItem) => {
    const body = replyDraft.trim();
    if (!body || postingReply) return;
    setPostingReply(true);
    try {
      const res = await fetch(`/api/reviews/${rev.id}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Could not post reply');
      const cur = repliesFor(rev);
      setReplyState((prev) => ({ ...prev, [rev.id]: { replies: [...cur.replies, data.reply], count: cur.count + 1 } }));
      setReplyDraft('');
      setOpenComposer(null);
    } catch (err: any) {
      showToast(err.message || 'Could not post reply', 'error');
    } finally {
      setPostingReply(false);
    }
  };

  const removeReply = async (rev: ReviewItem, replyId: string) => {
    if (!confirm('Delete this reply?')) return;
    try {
      const res = await fetch(`/api/reviews/${rev.id}/replies/${replyId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      const cur = repliesFor(rev);
      setReplyState((prev) => ({
        ...prev,
        [rev.id]: { replies: cur.replies.filter((r) => r.id !== replyId), count: Math.max(0, cur.count - 1) },
      }));
    } catch {
      showToast('Could not delete reply', 'error');
    }
  };

  const formatDate = (rawDate?: string) => {
    if (!rawDate) return 'Recently';
    try {
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return rawDate;
      // Fixed locale, not `undefined` (the runtime's default): the server
      // and the browser can have different default locales, which used to
      // render two different date strings for the same value and fail
      // hydration once this page started server-rendering.
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return rawDate;
    }
  };

  const getSpoilerBadge = (level?: string) => {
    switch (level) {
      case 'FULL_SPOILERS':
        return (
          <span className={`${styles.spoilerBadge} ${styles.badgeFullSpoiler}`}>
            <AlertTriangle size={14} />
            Major spoilers
          </span>
        );
      case 'SPOILERS':
        return (
          <span className={`${styles.spoilerBadge} ${styles.badgeSpoiler}`}>
            <AlertTriangle size={14} />
            Spoilers
          </span>
        );
      case 'MILD_SPOILERS':
        return (
          <span className={`${styles.spoilerBadge} ${styles.badgeMild}`}>
            <ShieldAlert size={14} />
            Mild spoilers
          </span>
        );
      default:
        return (
          <span className={`${styles.spoilerBadge} ${styles.badgeSafe}`}>
            <ShieldCheck size={14} />
            Spoiler-free review
          </span>
        );
    }
  };

  const renderTags = (tags?: string[]) =>
    tags && tags.length > 0 ? (
      <div className={styles.tagsRow} aria-label="Tags">
        {tags.map((t) => (
          <span key={t} className={styles.tagChip}>
            {reviewTagLabel(t)}
          </span>
        ))}
      </div>
    ) : null;

  const renderThread = (rev: ReviewItem) => {
    const { replies, count } = repliesFor(rev);
    const username = rev.user?.username || 'OtakuMember';
    if (replies.length === 0 && count === 0 && openComposer !== rev.id) return null;
    return (
      <div className={styles.thread}>
        {replies.map((rp) => (
          <div key={rp.id} className={styles.reply}>
            <UserAvatar username={rp.user.username} avatarUrl={rp.user.avatarUrl} size={24} />
            <div className={styles.replyMain}>
              <p className={styles.replyHead}>
                <Link href={`/profile/${encodeURIComponent(rp.user.username)}`} className={styles.replyName}>
                  {rp.user.username}
                </Link>
                <span className={styles.replyDate}>{formatDate(rp.createdAt)}</span>
                {rp.canDelete && (
                  <button type="button" className={styles.replyDelete} onClick={() => removeReply(rev, rp.id)} aria-label="Delete reply">
                    <Trash2 size={12} />
                  </button>
                )}
              </p>
              <p className={styles.replyBody}>{rp.body}</p>
            </div>
          </div>
        ))}

        {count > replies.length && (
          <button type="button" className={styles.moreReplies} onClick={() => loadAllReplies(rev.id)} disabled={loadingAll === rev.id}>
            {loadingAll === rev.id ? 'Loading…' : `View all ${count} replies`}
          </button>
        )}

        {openComposer === rev.id && (
          <div className={styles.replyForm}>
            <Composer
              value={replyDraft}
              onChange={(v) => setReplyDraft(v.slice(0, 1000))}
              onSubmit={() => postReply(rev)}
              onCancel={() => {
                setReplyDraft('');
                setOpenComposer(null);
              }}
              submitting={postingReply}
              submitLabel="Reply"
              maxLength={1000}
              placeholder={`Reply to ${username}…`}
              replyingTo={username}
              autoFocus
              compact
            />
          </div>
        )}
      </div>
    );
  };

  const replyButton = (rev: ReviewItem) => {
    const count = repliesFor(rev).count;
    return (
      <button
        type="button"
        className={`${styles.actionBtn} ${openComposer === rev.id ? styles.actionBtnActive : ''}`}
        onClick={() => startReply(rev.id)}
        aria-expanded={openComposer === rev.id}
      >
        <MessageCircle size={12} />
        <span>Reply{count > 0 ? ` (${count})` : ''}</span>
      </button>
    );
  };

  const [pinBusy, setPinBusy] = useState<string | null>(null);
  const togglePin = async (rev: ReviewItem) => {
    if (pinBusy) return;
    setPinBusy(rev.id);
    try {
      const res = await fetch(`/api/reviews/${rev.id}/pin`, { method: rev.pinnedAt ? 'DELETE' : 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not update the pin.');
      showToast(rev.pinnedAt ? 'Review unpinned' : 'Review pinned to the top', 'success');
      onReviewsChanged?.();
    } catch (err) {
      showToast((err as Error).message, 'error');
    } finally {
      setPinBusy(null);
    }
  };

  // Pinned reviews sit on top; the viewer's own review comes next (only a
  // small mark sets it apart); everyone else follows.
  const pinnedIds = new Set(pinned.map((r) => r.id));
  const ownPinned = Boolean(userReview && pinnedIds.has(userReview.id));
  const communityReviews = reviews.filter((r) => !pinnedIds.has(r.id) && (!userReview || r.id !== userReview.id));

  // Apply client filters and sort
  const filteredReviews = communityReviews.filter((r) => {
    if (spoilerFilter === 'SPOILER_FREE') {
      return !r.spoilerLevel || r.spoilerLevel === 'SPOILER_FREE';
    }
    if (spoilerFilter === 'CREATORS') return Boolean(r.isCreatorReview);
    return true;
  });

  const sortedReviews = [...filteredReviews].sort((a, b) => {
    const aLikes = likeStates[a.id]?.count ?? a.likesCount ?? 0;
    const bLikes = likeStates[b.id]?.count ?? b.likesCount ?? 0;
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;

    if (sortBy === 'HELPFUL') return bLikes - aLikes;
    if (sortBy === 'NEWEST') return bTime - aTime;
    // RECOMMENDED default: creator reviews first (owner, 2026-10-24), then
    // likes weighted with recency.
    if (Boolean(a.isCreatorReview) !== Boolean(b.isCreatorReview)) return a.isCreatorReview ? -1 : 1;
    return bLikes !== aLikes ? bLikes - aLikes : bTime - aTime;
  });

  /** One review, the same layout for pinned, yours and everyone else's. */
  const renderReview = (rev: ReviewItem, own: boolean) => {
    const username = rev.user?.username || user?.username || 'OtakuMember';
    const avatarUrl = rev.user?.avatarUrl ?? (own ? user?.avatarUrl : null);
    const isSpoiler = !own && rev.spoilerLevel && rev.spoilerLevel !== 'SPOILER_FREE';
    const isRevealed = revealedIds.has(rev.id);
    const currentLike = likeStates[rev.id] ?? { count: rev.likesCount || 0, liked: Boolean(rev.userLiked) };

    return (
      <div
        key={rev.id}
        id={`review-${rev.id}`}
        className={`${styles.reviewItem} ${rev.pinnedAt ? styles.reviewPinned : ''} ${rev.isCreatorReview ? styles.reviewCreator : ''}`}
      >
        {/* Spoiler status first, above the name and score, so you know before you read. */}
        <div className={styles.spoilerTop}>
          {rev.isCreatorReview && (
            <span className={styles.creatorLabel}>
              <Clapperboard size={13} aria-hidden="true" /> Creator Review
            </span>
          )}
          {getSpoilerBadge(rev.spoilerLevel)}
        </div>
        <div className={styles.userRow}>
          <div className={styles.userInfo}>
            <UserAvatar username={username} avatarUrl={avatarUrl} size={36} />
            <div className={styles.userDetails}>
              <span className={styles.nameRow}>
                <Link href={`/profile/${username}`} className={styles.userName}>
                  {username}
                </Link>
                {own && (
                  <span className={styles.ownMark} title="This is your review">
                    <CheckCircle2 size={12} aria-hidden="true" /> Your review
                  </span>
                )}
                {rev.user?.badge && isTierKey(rev.user.badge.tier) && <BadgeChip tier={rev.user.badge.tier} count={rev.user.badge.count} />}
                <ReviewerScore score={rev.rating} />
              </span>
              <div className={styles.subMeta}>
                <span className={styles.date}>{formatDate(rev.createdAt)}</span>
                {rev.edited && <span className={styles.editedText}>(edited)</span>}
                {rev.watchStatusAtReview && (
                  <span className={styles.watchStatusTag}>
                    {rev.watchStatusAtReview.replace('_', ' ')}
                    {typeof rev.episodeProgressAtReview === 'number' ? ` (Ep ${rev.episodeProgressAtReview})` : ''}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className={styles.userRightMeta}>
            {rev.pinnedAt && (
              <span className={styles.pinnedMark}>
                <Pin size={11} aria-hidden="true" /> Pinned
              </span>
            )}
          </div>
        </div>

        {rev.isCreatorReview && rev.title && <h3 className={styles.creatorHeadline}>{rev.title}</h3>}

        {isSpoiler && !isRevealed ? (
          <div className={styles.spoilerShieldBox}>
            <div className={styles.spoilerShieldContent}>
              <AlertTriangle size={16} className={styles.shieldIcon} />
              <div className={styles.shieldText}>
                <strong>Spoiler Warning</strong>
                <p>This review contains plot revelations ({rev.spoilerLevel?.replace('_', ' ').toLowerCase()}).</p>
              </div>
            </div>
            <button type="button" className={styles.revealBtn} onClick={() => toggleReveal(rev.id)}>
              <Eye size={13} />
              <span>Reveal Review</span>
            </button>
          </div>
        ) : (
          <>
            <p className={styles.reviewBodyText}>{rev.body}</p>
            {isSpoiler && isRevealed && (
              <button type="button" className={styles.hideSpoilerBtn} onClick={() => toggleReveal(rev.id)}>
                <EyeOff size={12} />
                <span>Hide Spoilers</span>
              </button>
            )}
          </>
        )}

        {renderTags(rev.tags)}

        <div className={styles.actionRow}>
          <div className={styles.actionGroup}>
            {own ? (
              <span className={styles.helpfulCountText}>
                <ThumbsUp size={12} aria-hidden="true" /> {rev.likesCount || 0} found this helpful
              </span>
            ) : (
              <button
                type="button"
                className={`${styles.actionBtn} ${currentLike.liked ? styles.actionBtnActive : ''}`}
                onClick={() => handleHelpfulToggle(rev)}
                aria-label={`Mark review as helpful (${currentLike.count} helpful votes)`}
              >
                <ThumbsUp size={12} fill={currentLike.liked ? 'currentColor' : 'none'} />
                <span>Helpful ({currentLike.count})</span>
              </button>
            )}
            {replyButton(rev)}
            {own && onEditReview && (
              <button type="button" className={styles.actionBtn} onClick={() => onEditReview(rev)}>
                <Edit3 size={12} />
                <span>Edit</span>
              </button>
            )}
            {canPin && (
              <button type="button" className={styles.actionBtn} onClick={() => togglePin(rev)} disabled={pinBusy === rev.id}>
                {rev.pinnedAt ? <PinOff size={12} /> : <Pin size={12} />}
                <span>{rev.pinnedAt ? 'Unpin' : 'Pin'}</span>
              </button>
            )}
          </div>

          {!own && (
            <button
              type="button"
              className={`${styles.actionBtn} ${styles.reportBtn}`}
              onClick={() => setReportingReview({ id: rev.id, title: rev.title || `${username}'s review` })}
              aria-label="Report review"
            >
              <Flag size={12} />
              <span>Report</span>
            </button>
          )}
        </div>

        {renderThread(rev)}
      </div>
    );
  };

  const totalReviewsCount = pinned.length + (userReview && !ownPinned ? 1 : 0) + communityReviews.length;

  return (
    <div className={styles.card} role="region" aria-label="Community Reviews">
      {/* Header */}
      <div className={styles.headerRow}>
        <div className={styles.headerTitleGroup}>
          <h3 className={styles.headerTitle}>Community Reviews</h3>
          <span className={styles.reviewCountBadge}>{totalReviewsCount}</span>
        </div>
        {/* No header "Write a Review" button: the composer prompt below (or the
            empty state when there are no reviews yet) is the way in. */}
      </div>

      {/* What members tagged this anime with, most-picked first */}
      {communityTags.length > 0 && (
        <div className={styles.communityTags}>
          <span className={styles.communityTagsLabel}>Members say</span>
          <div className={styles.tagsRow}>
            {communityTags.slice(0, 10).map((t) => (
              <span key={t.tag} className={styles.tagChip}>
                {t.label}
                <span className={styles.tagCount}>{t.count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Inline composer prompt: the quickest way in, styled like the feed it adds to */}
      {!userReview && onWriteReview && totalReviewsCount > 0 && (
        <button type="button" className={styles.composerPrompt} onClick={onWriteReview}>
          {user ? (
            <UserAvatar username={user.username} avatarUrl={user.avatarUrl} size={36} />
          ) : (
            <span className={styles.composerIcon} aria-hidden="true">
              <PenTool size={15} />
            </span>
          )}
          <span className={styles.composerText}>What did you think of {animeTitle}?</span>
          <span className={styles.composerCta}>
            <PenTool size={13} aria-hidden="true" /> Review
          </span>
        </button>
      )}

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
            {communityReviews.some((r) => r.isCreatorReview) && (
              <button
                type="button"
                className={`${styles.filterChip} ${spoilerFilter === 'CREATORS' ? styles.filterChipActive : ''}`}
                onClick={() => setSpoilerFilter('CREATORS')}
              >
                <Clapperboard size={12} />
                Creators
              </button>
            )}
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
            </select>
          </div>
        </div>
      )}

      {/* 1. PINNED — good reviews a moderator put on top */}
      {pinned.length > 0 && (
        <div className={styles.pinnedGroup} aria-label="Pinned reviews">
          <p className={styles.groupLabel}>
            <Pin size={12} aria-hidden="true" /> Pinned
          </p>
          <div className={styles.reviewsList}>{pinned.map((rev) => renderReview(rev, Boolean(userReview && rev.id === userReview.id)))}</div>
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

      {/* 3. YOUR REVIEW (just a small mark), THEN EVERYONE ELSE */}
      {((userReview && !ownPinned) || sortedReviews.length > 0) && (
        <div className={styles.reviewsList}>
          {userReview && !ownPinned && renderReview(userReview, true)}
          {sortedReviews.map((rev) => renderReview(rev, false))}
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
