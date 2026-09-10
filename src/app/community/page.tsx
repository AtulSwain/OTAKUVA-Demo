'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Search,
  Plus,
  Compass,
  MessageSquare,
  Check,
  Flame,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CommunityImage } from '../../components/ui/CommunityImage';
import styles from './community.module.css';

interface CommunityItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  iconUrl?: string | null;
  iconSource?: string | null;
  bannerUrl?: string | null;
  bannerSource?: string | null;
  category: string;
  visibility: string;
  memberCount: number;
  discussionCount: number;
  membershipStatus?: string | null;
  owner?: { username: string; avatarUrl?: string };
}

export default function CommunityPage() {
  const { user, openAuthModal } = useAuth();
  const [activeTab, setActiveTab] = useState<'discover' | 'joined' | 'popular' | 'new'>('discover');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [communities, setCommunities] = useState<CommunityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCommunities = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeTab === 'joined') params.set('filter', 'joined');
      if (activeTab === 'popular') params.set('filter', 'popular');
      if (activeTab === 'new') params.set('filter', 'new');
      if (selectedCategory !== 'ALL') params.set('category', selectedCategory);
      if (searchQuery.trim()) params.set('q', searchQuery.trim());

      const res = await fetch(`/api/communities?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setCommunities(data.communities || []);
      }
    } catch (err) {
      console.error('Failed to load communities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, [activeTab, selectedCategory, user]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCommunities();
  };

  const handleJoinToggle = async (c: CommunityItem) => {
    if (!user) {
      openAuthModal('login');
      return;
    }

    const isMember = c.membershipStatus === 'ACTIVE';
    const endpoint = `/api/communities/${c.slug}/${isMember ? 'leave' : 'join'}`;

    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setCommunities((prev) =>
          prev.map((item) =>
            item.id === c.id
              ? {
                  ...item,
                  membershipStatus: data.status,
                  memberCount: data.memberCount ?? item.memberCount,
                }
              : item
          )
        );
      }
    } catch (err) {
      console.error('Error toggling membership:', err);
    }
  };

  const CATEGORIES = ['ALL', 'ANIME', 'GENRE', 'MANGA', 'REGIONAL', 'INTEREST'];

  return (
    <div className={styles.communityPage}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <Users size={20} className={styles.icon} />
            <h1 className={styles.title}>COMMUNITY</h1>
          </div>
          <p className={styles.subtitle}>
            Join organized spaces built around the anime you watch, genres you love, and topics you care about.
          </p>
        </div>

        <Link href="/community/create" className={styles.createBtn}>
          <Plus size={14} />
          <span>Create Community</span>
        </Link>
      </div>

      {/* Main Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.mainTabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'discover' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('discover')}
          >
            <Compass size={13} />
            <span>Discover</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'joined' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              if (!user) openAuthModal('login');
              else setActiveTab('joined');
            }}
          >
            <Check size={13} />
            <span>My Communities</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'popular' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('popular')}
          >
            <Flame size={13} />
            <span>Popular</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'new' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('new')}
          >
            <Clock size={13} />
            <span>New</span>
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className={styles.searchBox}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search communities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </div>

      {/* Category Chips */}
      <div className={styles.categoryRow}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`${styles.catBtn} ${selectedCategory === cat ? styles.catBtnActive : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Public Discussion Banner */}
      <div className={styles.publicBanner}>
        <div>
          <span className={styles.publicBannerTitle}>
            Looking for Open Public Discussions?
          </span>
          <span className={styles.publicBannerDesc}>
            You do not need to join any community to talk about your favorite anime or episodes.
          </span>
        </div>
        <Link href="/discussions" className={styles.publicBannerBtn}>
          <span>Explore Public Discussions</span>
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* Community Grid */}
      {loading ? (
        <div className={styles.loadingState}>
          Loading communities...
        </div>
      ) : communities.length > 0 ? (
        <div className={styles.communityGrid}>
          {communities.map((c) => {
            const isMember = c.membershipStatus === 'ACTIVE';
            const isPending = c.membershipStatus === 'PENDING';

            return (
              <div key={c.id} className={styles.communityCard}>
                {/* Banner with Fallback */}
                <div className={styles.bannerWrap}>
                  <CommunityImage
                    src={c.bannerUrl}
                    type="banner"
                    communityName={c.name}
                  />
                </div>

                <div className={styles.cardBody}>
                  {/* Icon with Fallback */}
                  <div className={styles.iconWrapper}>
                    <CommunityImage
                      src={c.iconUrl}
                      type="icon"
                      communityName={c.name}
                    />
                  </div>

                  <div className={styles.cardHeaderInfo}>
                    <div className={styles.headerMetaRow}>
                      <span className={styles.categoryBadge}>{c.category}</span>
                    </div>
                    <Link href={`/community/${c.slug}`} className={styles.nameLink}>
                      <h3 className={styles.communityName}>{c.name}</h3>
                    </Link>
                    <p className={styles.communityDesc}>{c.description}</p>
                  </div>

                  <div className={styles.cardMeta}>
                    <div className={styles.metaStats}>
                      <span className={styles.statItem}>
                        <Users size={12} />
                        {c.memberCount.toLocaleString()}
                      </span>
                      <span>•</span>
                      <span className={styles.statItem}>
                        <MessageSquare size={12} />
                        {c.discussionCount} topics
                      </span>
                    </div>

                    <div className={styles.actionButtonGroup}>
                      <button
                        type="button"
                        className={`${styles.joinBtn} ${isMember ? styles.joinedBtn : ''}`}
                        onClick={() => handleJoinToggle(c)}
                      >
                        {isMember ? (
                          <>
                            <Check size={12} />
                            <span>Joined</span>
                          </>
                        ) : isPending ? (
                          <span>Pending</span>
                        ) : (
                          <>
                            <Plus size={12} />
                            <span>Join</span>
                          </>
                        )}
                      </button>

                      <Link href={`/community/${c.slug}`} className={styles.enterBtn}>
                        <span>Enter</span>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className={styles.emptyCard}>
          {activeTab === 'joined' ? (
            <div>
              <p className={styles.emptyTitle}>
                You haven&apos;t joined any communities yet.
              </p>
              <p className={styles.emptySubtitle}>
                Discover spaces based on your favorite anime, genres, and discussion topics.
              </p>
              <button
                type="button"
                className={styles.tabBtnActive}
                style={{ padding: '6px 14px', borderRadius: '4px', cursor: 'pointer' }}
                onClick={() => setActiveTab('discover')}
              >
                Discover Communities
              </button>
            </div>
          ) : (
            <p>No communities found matching your filter.</p>
          )}
        </div>
      )}
    </div>
  );
}
