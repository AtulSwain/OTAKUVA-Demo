'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Newspaper,
  ExternalLink,
  MessageSquare,
  Search,
  Sparkles,
  TrendingUp,
  Clock,
  Flame,
  User,
  Compass,
  RefreshCw,
  Building2,
  Film,
} from 'lucide-react';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './news.module.css';

const CATEGORIES = [
  { id: 'ALL', label: 'All News' },
  { id: 'ANIME', label: 'Anime & Series' },
  { id: 'PRODUCTION', label: 'Production' },
  { id: 'ANNOUNCEMENT', label: 'Announcements' },
  { id: 'TRAILER', label: 'Trailers & PV' },
  { id: 'CAST', label: 'Voice Cast' },
  { id: 'STAFF', label: 'Staff & Creators' },
  { id: 'STUDIO', label: 'Studios' },
  { id: 'INDUSTRY', label: 'Industry & Box Office' },
  { id: 'MANGA', label: 'Manga & Print' },
];

export default function NewsPage() {
  const [activeTab, setActiveTab] = useState<'FOR_YOU' | 'TRENDING' | 'LATEST'>('FOR_YOU');
  const [trendingWindow, setTrendingWindow] = useState<'1h' | '6h' | '24h' | '7d'>('24h');
  const [articles, setArticles] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedMeta, setFeedMeta] = useState<any>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Load News based on Active Tab & Filters
  const loadNews = async () => {
    setIsLoading(true);
    try {
      if (searchQuery.trim()) {
        const params = new URLSearchParams();
        params.set('q', searchQuery.trim());
        if (selectedCategory !== 'ALL') params.set('category', selectedCategory);
        const res = await fetch(`/api/news/search?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setArticles(data.results || []);
          setFeedMeta({ total: data.total, isSearch: true });
        }
      } else if (activeTab === 'FOR_YOU') {
        const params = new URLSearchParams();
        if (selectedCategory !== 'ALL') params.set('category', selectedCategory);
        const res = await fetch(`/api/news/feed?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setArticles(data.feed || []);
          setFeedMeta({ isPersonalized: data.isPersonalized, tier: data.confidenceTier });
        }
      } else if (activeTab === 'TRENDING') {
        const params = new URLSearchParams();
        params.set('window', trendingWindow);
        if (selectedCategory !== 'ALL') params.set('category', selectedCategory);
        const res = await fetch(`/api/news/trending?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setArticles(data.articles || []);
          setFeedMeta({ window: data.window });
        }
      } else {
        // LATEST
        const params = new URLSearchParams();
        if (selectedCategory !== 'ALL') params.set('category', selectedCategory);
        const res = await fetch(`/api/news?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setArticles(data.articles || []);
          setFeedMeta({ total: data.total });
        }
      }
    } catch (err) {
      console.error('Error loading news:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadNews();
  }, [activeTab, selectedCategory, trendingWindow]);

  // Autocomplete fetch on query change
  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/news/autocomplete?q=${encodeURIComponent(searchQuery.trim())}`);
          if (res.ok) {
            const data = await res.json();
            setSuggestions(data.suggestions || []);
            setShowSuggestions(true);
          }
        } catch {
          setSuggestions([]);
        }
      }, 200);
      return () => clearTimeout(timer);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery]);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    loadNews();
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await fetch('/api/news', { method: 'POST' });
      await loadNews();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className={styles.newsContainer}>
      {/* Editorial Header */}
      <div className={styles.header}>
        <div className={styles.headerTitleWrap}>
          <div className={styles.pillarBadge}>
            <Newspaper size={13} />
            <span>ANIME INDUSTRY DISPATCH</span>
          </div>
          <h1 className={styles.pageTitle}>Anime News &amp; Production Intelligence</h1>
          <p className={styles.pageSubtitle}>
            Verified announcements, studio productions, casting revelations, and industry retrospectives.
          </p>
        </div>

        <button
          type="button"
          className={styles.syncBtn}
          onClick={handleManualSync}
          disabled={isSyncing}
          title="Refresh verified feed from providers"
        >
          <RefreshCw size={12} className={isSyncing ? styles.spin : ''} />
          <span>{isSyncing ? 'Syncing...' : 'Sync Provider Feed'}</span>
        </button>
      </div>

      {/* Discovery & Feed Tabs */}
      <div className={styles.tabNavRow}>
        <div className={styles.tabsGroup}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'FOR_YOU' && !searchQuery ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setSearchQuery('');
              setActiveTab('FOR_YOU');
            }}
          >
            <Sparkles size={14} />
            <span>For You</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'TRENDING' && !searchQuery ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setSearchQuery('');
              setActiveTab('TRENDING');
            }}
          >
            <TrendingUp size={14} />
            <span>Trending</span>
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === 'LATEST' && !searchQuery ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setSearchQuery('');
              setActiveTab('LATEST');
            }}
          >
            <Clock size={14} />
            <span>Latest Dispatch</span>
          </button>
        </div>

        {/* Live Search Form with Autocomplete Dropdown */}
        <div className={styles.searchContainer} ref={searchContainerRef}>
          <form className={styles.searchForm} onSubmit={handleSearchSubmit}>
            <Search size={14} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search news, anime, studios, cast..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              className={styles.searchInput}
            />
          </form>

          {showSuggestions && suggestions.length > 0 && (
            <div className={styles.suggestionsDropdown}>
              {suggestions.map((s) => (
                <Link
                  key={`${s.type}_${s.id}`}
                  href={
                    s.type === 'ANIME'
                      ? `/anime/${s.slug || s.id}`
                      : s.type === 'STUDIO'
                      ? `/studio/${s.slug}`
                      : `/news/${s.slug || s.id}`
                  }
                  className={styles.suggestionItem}
                  onClick={() => setShowSuggestions(false)}
                >
                  <div className={styles.suggestionIcon}>
                    {s.type === 'ANIME' ? <Film size={14} /> : s.type === 'STUDIO' ? <Building2 size={14} /> : <Newspaper size={14} />}
                  </div>
                  <div className={styles.suggestionContent}>
                    <span className={styles.suggestionTitle}>{s.title}</span>
                    <span className={styles.suggestionSubtitle}>{s.subtitle}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Trending Window Filter (when in Trending Tab) */}
      {activeTab === 'TRENDING' && !searchQuery && (
        <div className={styles.windowRow}>
          <span className={styles.windowLabel}>Trending Window:</span>
          {(['1h', '6h', '24h', '7d'] as const).map((w) => (
            <button
              key={w}
              type="button"
              className={`${styles.windowBtn} ${trendingWindow === w ? styles.windowBtnActive : ''}`}
              onClick={() => setTrendingWindow(w)}
            >
              {w === '1h' ? 'Past Hour' : w === '6h' ? '6 Hours' : w === '24h' ? 'Today' : 'This Week'}
            </button>
          ))}
        </div>
      )}

      {/* Categories Filter Bar */}
      <div className={styles.categoryBar}>
        <div className={styles.categoryPills}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`${styles.categoryPill} ${selectedCategory === cat.id ? styles.categoryPillActive : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed Status Banner */}
      {activeTab === 'FOR_YOU' && !searchQuery && feedMeta && (
        <div className={styles.feedMetaBanner}>
          <Sparkles size={13} className={styles.sparkleIcon} />
          <span>
            {feedMeta.isPersonalized
              ? 'Personalized for you based on your anime watch tracking and studio preferences.'
              : 'Showing global anime industry headlines. Watch and rate anime to personalize your dispatch.'}
          </span>
        </div>
      )}

      {/* Articles Grid */}
      {isLoading ? (
        <div className={styles.newsGrid}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={styles.skeletonImage} />
              <div className={styles.skeletonTextRow} />
              <div className={styles.skeletonTextRowShort} />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <div className={styles.emptyState}>
          <Newspaper size={36} className={styles.emptyIcon} />
          <h3>No Industry Articles Found</h3>
          <p>No published articles matched your selected category or query filter.</p>
          <button
            type="button"
            className={styles.resetFilterBtn}
            onClick={() => {
              setSelectedCategory('ALL');
              setSearchQuery('');
            }}
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className={styles.newsGrid}>
          {articles.map((article, idx) => {
            const displayTitle = sanitizePublicEntityName(article.displayTitle || article.title);
            const displaySummary = article.displaySummary || article.summary;
            const displayCategory = article.displayCategory || article.category;
            const timeAgo = formatTimeAgo(article.publishedAt);
            const isHero = idx === 0 && !searchQuery && selectedCategory === 'ALL';

            return (
              <article
                key={article.id}
                className={`${styles.newsCard} ${isHero ? styles.heroCard : ''}`}
              >
                <Link href={`/news/${article.slug || article.id}`} className={styles.cardCoverLink}>
                  <div className={styles.cardMediaWrap}>
                    {article.imageUrl ? (
                      <Image
                        src={article.imageUrl}
                        alt={displayTitle}
                        fill
                        className={styles.cardImage}
                        unoptimized
                      />
                    ) : (
                      <div className={styles.placeholderMedia}>
                        <Newspaper size={28} />
                      </div>
                    )}
                    <div className={styles.cardBadges}>
                      <span className={styles.categoryBadge}>{displayCategory}</span>
                      {article.trendingExplanation && (
                        <span className={styles.trendingBadge}>
                          <Flame size={10} />
                          {article.trendingExplanation}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className={styles.cardBody}>
                    <div className={styles.cardByline}>
                      <span className={styles.sourceTag}>
                        <Building2 size={11} />
                        {article.sourceName}
                      </span>
                      <span className={styles.metaDot}>•</span>
                      <span className={styles.timeTag}>{timeAgo}</span>
                    </div>

                    <h2 className={styles.cardHeadline}>{displayTitle}</h2>

                    {displaySummary && (
                      <p className={styles.cardSummary}>{displaySummary}</p>
                    )}

                    {article.personalizationReason && activeTab === 'FOR_YOU' && (
                      <div className={styles.personalizationTag}>
                        <Sparkles size={11} />
                        <span>{article.personalizationReason}</span>
                      </div>
                    )}

                    {/* Related Entities Footnote */}
                    {article.relatedAnime && article.relatedAnime.length > 0 && (
                      <div className={styles.relatedAnimeRow}>
                        <span className={styles.relatedLabel}>Related:</span>
                        <span className={styles.relatedTitle}>
                          {article.relatedAnime[0].canonicalTitle}
                        </span>
                      </div>
                    )}
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(dateInput: string | Date): string {
  const date = new Date(dateInput);
  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
