'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Search,
  Plus,
  Flame,
  Clock,
  TrendingUp,
  HelpCircle,
  Star,
  Film,
  Tv,
  Check,
  X,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { SpoilerBlock } from '../../components/community/SpoilerBlock';
import { EmptyState } from '../../components/ui/EmptyState';
import styles from './discussions.module.css';
import { CommunityHubNav } from '../../components/community/CommunityHubNav';

interface DiscussionItem {
  id: string;
  title: string;
  body: string;
  type: string;
  spoilerLevel: string;
  replyCount: number;
  helpfulCount: number;
  createdAt: string;
  author: { id: string; username: string; avatarUrl?: string };
  anime?: { id: string; canonicalTitle: string; slug: string; posterUrl: string };
  episode?: { id: string; episodeNumber: number; title?: string };
  community?: { name: string; slug: string };
  hasReacted?: boolean;
  isFollowed?: boolean;
}

export default function PublicDiscussionsPage() {
  const { user, openAuthModal } = useAuth();
  const [activeSort, setActiveSort] = useState<'trending' | 'latest' | 'popular' | 'unanswered'>('trending');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [discussions, setDiscussions] = useState<DiscussionItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer Modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [type, setType] = useState('GENERAL');
  const [spoilerLevel, setSpoilerLevel] = useState('NO_SPOILER');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // "/discussions?new=1&title=…" (e.g. "Discuss this story" on a news page)
  // opens the composer with the title filled in.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') !== '1') return;
    const preset = (params.get('title') || '').slice(0, 200);
    if (preset) setTitle(preset);
    setShowModal(true);
  }, []);

  const fetchDiscussions = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('sort', activeSort);
      params.set('communityId', 'public'); // Public discussions
      if (selectedType !== 'ALL') params.set('type', selectedType);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/discussions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setDiscussions(data.discussions || []);
      }
    } catch (err) {
      console.error('Failed to load discussions:', err);
    } finally {
      setLoading(false);
    }
  }, [activeSort, selectedType, searchQuery]);

  useEffect(() => {
    fetchDiscussions();
  }, [fetchDiscussions]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDiscussions();
  };

  const handleCreateDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModal('login');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          type,
          spoilerLevel,
        }),
      });

      if (res.ok) {
        setTitle('');
        setBody('');
        setShowModal(false);
        fetchDiscussions();
      }
    } catch (err) {
      console.error('Error creating discussion:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const TYPES = ['ALL', 'GENERAL', 'QUESTION', 'THEORY', 'REACTION', 'RECOMMENDATION', 'ANALYSIS', 'EPISODE_DISCUSSION'];

  return (
    <div className={styles.discussionsPage}>
      {/* Header */}
      <CommunityHubNav />
      <div className={styles.header}>
        <div>
          <div className={styles.titleRow}>
            <MessageSquare size={20} className={styles.icon} />
            <h1 className={styles.title}>Discussions</h1>
          </div>
          <p className={styles.subtitle}>
            Share theories, questions, opinions, and episode reactions with the entire OTAKUVA community.
          </p>
        </div>

        <button
          type="button"
          className={styles.startBtn}
          onClick={() => {
            if (!user) openAuthModal('login');
            else setShowModal(true);
          }}
        >
          <Plus size={14} />
          <span>Start Discussion</span>
        </button>
      </div>

      {/* Main Sort Bar & Search */}
      <div className={styles.navBar}>
        <div className={styles.sortTabs}>
          <button
            type="button"
            className={`${styles.sortBtn} ${activeSort === 'trending' ? styles.sortBtnActive : ''}`}
            onClick={() => setActiveSort('trending')}
          >
            <Flame size={13} />
            <span>Trending</span>
          </button>
          <button
            type="button"
            className={`${styles.sortBtn} ${activeSort === 'latest' ? styles.sortBtnActive : ''}`}
            onClick={() => setActiveSort('latest')}
          >
            <Clock size={13} />
            <span>Latest</span>
          </button>
          <button
            type="button"
            className={`${styles.sortBtn} ${activeSort === 'popular' ? styles.sortBtnActive : ''}`}
            onClick={() => setActiveSort('popular')}
          >
            <TrendingUp size={13} />
            <span>Popular</span>
          </button>
          <button
            type="button"
            className={`${styles.sortBtn} ${activeSort === 'unanswered' ? styles.sortBtnActive : ''}`}
            onClick={() => setActiveSort('unanswered')}
          >
            <HelpCircle size={13} />
            <span>Unanswered</span>
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className={styles.searchBox}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search discussions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      {/* Type Chips */}
      <div className={styles.typeChips}>
        {TYPES.map((t) => (
          <button
            key={t}
            type="button"
            className={`${styles.chip} ${selectedType === t ? styles.chipActive : ''}`}
            onClick={() => setSelectedType(t)}
          >
            {t.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Discussions Feed */}
      {loading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
          Loading discussions...
        </div>
      ) : discussions.length > 0 ? (
        <div className={styles.discussionList}>
          {discussions.map((d) => (
            <Link key={d.id} href={`/discussions/${d.id}`} className={styles.card}>
              <div className={styles.mainCol}>
                <div className={styles.metaHeader}>
                  <span className={styles.tagBadge}>{d.type.replace('_', ' ')}</span>
                  {d.anime && (
                    <span className={styles.animeContext}>{d.anime.canonicalTitle}</span>
                  )}
                  {d.episode && (
                    <span className={styles.tagBadge}>Ep {d.episode.episodeNumber}</span>
                  )}
                  <span className={styles.time}>
                    {new Date(d.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </span>
                </div>

                <h3 className={styles.discTitle}>{d.title}</h3>

                <SpoilerBlock spoilerLevel={d.spoilerLevel} animeSlug={d.anime?.slug}>
                  <p className={styles.discBody}>{d.body}</p>
                </SpoilerBlock>

                <div className={styles.footer}>
                  <span>by @{d.author?.username || 'user'}</span>
                  <div className={styles.statItem}>
                    <Star size={12} color="var(--text-muted)" />
                    <span>{d.helpfulCount}</span>
                  </div>
                  <div className={styles.statItem}>
                    <MessageSquare size={12} />
                    <span>{d.replyCount} replies</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={MessageSquare}
          title={searchQuery.trim() || selectedType !== 'ALL' ? 'No discussions match' : 'No discussions yet'}
          description={
            searchQuery.trim() || selectedType !== 'ALL'
              ? 'Try a different search or category — or start this conversation yourself.'
              : 'Be the first to share a theory, a question or an episode reaction.'
          }
          actionLabel="Start a discussion"
          onAction={() => {
            if (!user) openAuthModal('login');
            else setShowModal(true);
          }}
        />
      )}

      {/* Composer Modal */}
      {showModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Start a New Discussion</h2>
              <button aria-label="Close"
                type="button"
                className={styles.closeBtn}
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none' }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateDiscussion} className={styles.form}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className={styles.formInput}
                  style={{ flex: 1 }}
                >
                  <option value="GENERAL">General Discussion</option>
                  <option value="QUESTION">Question</option>
                  <option value="THEORY">Theory &amp; Speculation</option>
                  <option value="REACTION">Reaction</option>
                  <option value="RECOMMENDATION">Recommendation</option>
                  <option value="ANALYSIS">In-Depth Analysis</option>
                </select>

                <select
                  value={spoilerLevel}
                  onChange={(e) => setSpoilerLevel(e.target.value)}
                  className={styles.formInput}
                  style={{ flex: 1 }}
                >
                  <option value="NO_SPOILER">No Spoilers</option>
                  <option value="ANIME_SPOILER">Anime Spoiler</option>
                  <option value="EPISODE_SPOILER">Episode Spoiler</option>
                  <option value="MANGA_SPOILER">Manga Spoiler</option>
                </select>
              </div>

              <input
                type="text"
                className={styles.formInput}
                placeholder="Discussion Title..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />

              <textarea
                className={styles.formTextarea}
                placeholder="What would you like to discuss? Share your perspective, questions, or thoughts..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.closeBtn}
                  onClick={() => setShowModal(false)}
                  style={{ padding: '6px 12px', borderRadius: '4px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.submitBtn}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Posting...' : 'Publish Discussion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
