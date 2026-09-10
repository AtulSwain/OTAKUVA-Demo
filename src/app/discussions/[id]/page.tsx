'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import {
  MessageSquare,
  Star,
  Bookmark,
  Share2,
  Flag,
  ArrowLeft,
  Send,
  Reply,
  Loader2,
  Check,
  Film,
  Tv,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { SpoilerBlock } from '../../../components/community/SpoilerBlock';
import styles from './discussionDetail.module.css';

interface CommentItem {
  id: string;
  body: string;
  spoilerLevel: string;
  createdAt: string;
  author: { id: string; username: string; avatarUrl?: string };
  replies?: CommentItem[];
}

interface DiscussionDetail {
  id: string;
  title: string;
  body: string;
  type: string;
  spoilerLevel: string;
  status: string;
  replyCount: number;
  helpfulCount: number;
  followerCount: number;
  createdAt: string;
  isFollowed?: boolean;
  hasReacted?: boolean;
  author: { id: string; username: string; avatarUrl?: string };
  anime?: { id: string; canonicalTitle: string; slug: string; posterUrl: string; bannerUrl?: string };
  episode?: { id: string; episodeNumber: number; title?: string };
  community?: { name: string; slug: string; iconUrl?: string };
  channel?: { name: string; slug: string };
  comments: CommentItem[];
}

export default function DiscussionDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user, openAuthModal } = useAuth();

  const [discussion, setDiscussion] = useState<DiscussionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Reply Composer
  const [replyBody, setReplyBody] = useState('');
  const [replySpoiler, setReplySpoiler] = useState('NO_SPOILER');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Report Modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('SPAM');
  const [reportDesc, setReportDesc] = useState('');
  const [reportSuccess, setReportSuccess] = useState(false);

  const fetchDiscussion = async () => {
    try {
      const res = await fetch(`/api/discussions/${id}`);
      if (res.ok) {
        const data = await res.json();
        setDiscussion(data.discussion);
      }
    } catch (err) {
      console.error('Failed to load discussion:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) fetchDiscussion();
  }, [id]);

  const handleToggleHelpful = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    try {
      const res = await fetch(`/api/discussions/${id}/reactions`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDiscussion((prev) =>
          prev
            ? {
                ...prev,
                hasReacted: data.hasReacted,
                helpfulCount: data.helpfulCount,
              }
            : null
        );
      }
    } catch (err) {
      console.error('Error toggling reaction:', err);
    }
  };

  const handleToggleFollow = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    try {
      const res = await fetch(`/api/discussions/${id}/follow`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setDiscussion((prev) =>
          prev
            ? {
                ...prev,
                isFollowed: data.isFollowed,
                followerCount: data.followerCount,
              }
            : null
        );
      }
    } catch (err) {
      console.error('Error toggling follow:', err);
    }
  };

  const handlePostReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal();
      return;
    }

    if (!replyBody.trim()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/discussions/${id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: replyBody.trim(),
          parentId: replyingToId || undefined,
          spoilerLevel: replySpoiler,
        }),
      });

      if (res.ok) {
        setReplyBody('');
        setReplyingToId(null);
        fetchDiscussion();
      }
    } catch (err) {
      console.error('Error posting comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'DISCUSSION',
          targetId: id,
          reason: reportReason,
          description: reportDesc.trim() || undefined,
        }),
      });

      if (res.ok) {
        setReportSuccess(true);
        setTimeout(() => {
          setShowReportModal(false);
          setReportSuccess(false);
        }, 1500);
      }
    } catch (err) {
      console.error('Report error:', err);
    }
  };

  if (loading) {
    return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading discussion...</div>;
  }

  if (!discussion) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <h2>Discussion Not Found</h2>
        <Link href="/discussions" style={{ color: 'var(--accent)', marginTop: '12px', display: 'inline-block' }}>
          ← Back to discussions
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Back Link */}
      <Link href={discussion.community ? `/community/${discussion.community.slug}` : '/discussions'} className={styles.backLink}>
        <ArrowLeft size={16} />
        <span>{discussion.community ? `Back to ${discussion.community.name}` : 'Back to Discussions'}</span>
      </Link>

      {/* Main Discussion Card */}
      <div className={styles.mainCard}>
        {/* Header Tags */}
        <div className={styles.tagRow}>
          <span className={styles.typeTag}>{discussion.type.replace('_', ' ')}</span>
          {discussion.community && (
            <Link href={`/community/${discussion.community.slug}`} className={styles.commTag}>
              {discussion.community.name}
            </Link>
          )}
          {discussion.anime && (
            <Link href={`/anime/${discussion.anime.slug || discussion.anime.id}`} className={styles.animeTag}>
              {discussion.anime.canonicalTitle}
            </Link>
          )}
          {discussion.episode && (
            <span className={styles.epTag}>Ep {discussion.episode.episodeNumber}</span>
          )}
          <span className={styles.timeTag}>{new Date(discussion.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>

        <h1 className={styles.title}>{discussion.title}</h1>

        {/* Author Profile */}
        <div className={styles.authorRow}>
          <div className={styles.avatarWrap}>
            <Image
              src={discussion.author?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60'}
              alt={discussion.author?.username || 'user'}
              fill
              style={{ objectFit: 'cover' }}
            />
          </div>
          <div>
            <span className={styles.authorName}>@{discussion.author?.username || 'user'}</span>
            <span className={styles.authorRole}>OTAKUVA Community Member</span>
          </div>
        </div>

        {/* Formatted Body with Spoiler Protection */}
        <SpoilerBlock spoilerLevel={discussion.spoilerLevel} animeSlug={discussion.anime?.slug}>
          <div className={styles.bodyText}>
            {discussion.body.split('\n').map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </SpoilerBlock>

        {/* Actions Bar */}
        <div className={styles.actionsBar}>
          <button
            type="button"
            className={`${styles.actionBtn} ${discussion.hasReacted ? styles.activeAction : ''}`}
            onClick={handleToggleHelpful}
          >
            <Star size={15} fill={discussion.hasReacted ? 'currentColor' : 'none'} />
            <span>Helpful ({discussion.helpfulCount})</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${discussion.isFollowed ? styles.activeAction : ''}`}
            onClick={handleToggleFollow}
          >
            <Bookmark size={15} fill={discussion.isFollowed ? 'currentColor' : 'none'} />
            <span>{discussion.isFollowed ? 'Following' : 'Follow Discussion'}</span>
          </button>

          <button
            type="button"
            className={styles.actionBtn}
            onClick={() => {
              if (navigator.clipboard) {
                navigator.clipboard.writeText(window.location.href);
                alert('Discussion link copied to clipboard!');
              }
            }}
          >
            <Share2 size={15} />
            <span>Share</span>
          </button>

          <button
            type="button"
            className={`${styles.actionBtn} ${styles.reportBtn}`}
            onClick={() => {
              if (!user) openAuthModal();
              else setShowReportModal(true);
            }}
          >
            <Flag size={14} />
            <span>Report</span>
          </button>
        </div>
      </div>

      {/* Comments Section */}
      <div className={styles.commentsSection}>
        <div className={styles.commentsHeader}>
          <MessageSquare size={18} color="var(--accent)" />
          <h2 className={styles.commentsTitle}>Replies ({discussion.comments?.length || 0})</h2>
        </div>

        {/* Reply Composer */}
        <form onSubmit={handlePostReply} className={styles.replyComposer}>
          {replyingToId && (
            <div className={styles.replyingAlert}>
              <span>Replying to comment #{replyingToId.slice(0, 6)}...</span>
              <button type="button" onClick={() => setReplyingToId(null)}>Cancel</button>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Leave a reply</span>
            <select
              className={styles.select}
              value={replySpoiler}
              onChange={(e) => setReplySpoiler(e.target.value)}
              style={{ width: 'auto', padding: '4px 10px', fontSize: '11px' }}
            >
              <option value="NO_SPOILER">No Spoilers</option>
              <option value="ANIME_SPOILER">Anime Spoiler</option>
              <option value="EPISODE_SPOILER">Episode Spoiler</option>
              <option value="MANGA_SPOILER">Manga Spoiler</option>
            </select>
          </div>

          <textarea
            className={styles.textarea}
            rows={3}
            placeholder="Share your thoughts, reply to this discussion, or join the debate..."
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            required
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="submit" className={styles.submitReplyBtn} disabled={isSubmitting}>
              <Send size={13} />
              <span>{isSubmitting ? 'Posting...' : 'Post Reply'}</span>
            </button>
          </div>
        </form>

        {/* Threaded Comments List */}
        <div className={styles.commentsList}>
          {discussion.comments?.length > 0 ? (
            discussion.comments.map((comment) => (
              <div key={comment.id} className={styles.commentItem}>
                <div className={styles.commentHeader}>
                  <div className={styles.commentAvatar}>
                    <Image
                      src={comment.author?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50'}
                      alt={comment.author?.username || 'user'}
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                  <div>
                    <span className={styles.commentAuthor}>@{comment.author?.username || 'user'}</span>
                    <span className={styles.commentTime}>{new Date(comment.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>

                <SpoilerBlock spoilerLevel={comment.spoilerLevel}>
                  <p className={styles.commentBody}>{comment.body}</p>
                </SpoilerBlock>

                <div className={styles.commentActions}>
                  <button
                    type="button"
                    className={styles.replyBtn}
                    onClick={() => setReplyingToId(comment.id)}
                  >
                    <Reply size={12} />
                    <span>Reply</span>
                  </button>
                </div>

                {/* Nested Replies */}
                {comment.replies && comment.replies.length > 0 && (
                  <div className={styles.nestedReplies}>
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className={styles.nestedItem}>
                        <div className={styles.commentHeader}>
                          <div className={styles.commentAvatar} style={{ width: '24px', height: '24px' }}>
                            <Image
                              src={reply.author?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=40'}
                              alt={reply.author?.username || 'user'}
                              fill
                              style={{ objectFit: 'cover' }}
                            />
                          </div>
                          <div>
                            <span className={styles.commentAuthor}>@{reply.author?.username}</span>
                            <span className={styles.commentTime}>{new Date(reply.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                          </div>
                        </div>
                        <SpoilerBlock spoilerLevel={reply.spoilerLevel}>
                          <p className={styles.commentBody}>{reply.body}</p>
                        </SpoilerBlock>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', background: 'var(--surface-main)', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
              No replies yet. Be the first to join the conversation!
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <div className={styles.modalBackdrop} onClick={() => setShowReportModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Report Content
            </h3>
            {reportSuccess ? (
              <div style={{ color: '#4ade80', fontSize: '14px', padding: '16px', textAlign: 'center' }}>
                ✓ Report submitted to OTAKUVA moderators. Thank you!
              </div>
            ) : (
              <form onSubmit={handleReportSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Reason
                  </label>
                  <select
                    className={styles.select}
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                  >
                    <option value="SPAM">Spam or Advertising</option>
                    <option value="HARASSMENT">Harassment or Abuse</option>
                    <option value="HATE">Hate Speech</option>
                    <option value="SPOILER_MISUSE">Untagged Spoilers</option>
                    <option value="PIRACY">Piracy Links</option>
                    <option value="OTHER">Other Violation</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>
                    Details (Optional)
                  </label>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    placeholder="Provide additional context for the moderation team..."
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={() => setShowReportModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className={styles.submitReportBtn}>
                    Submit Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
