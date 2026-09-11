'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  X,
  Star,
  Film,
  Building2,
  Users2,
  Newspaper,
  MessageSquareHeart,
  Calendar,
  Trophy,
  Bookmark,
  Clock,
  Settings,
  ArrowRight,
  CornerDownLeft,
  Loader2,
} from 'lucide-react';
import { AnimePoster } from './AnimePoster';
import { sanitizePublicEntityName } from '../../lib/normalizers';
import styles from './SearchModal.module.css';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CommandAction {
  id: string;
  label: string;
  category: 'COMMAND';
  href: string;
  icon: React.ElementType;
}

const COMMAND_ACTIONS: CommandAction[] = [
  { id: 'cmd_explore', label: 'Explore Anime Catalog', category: 'COMMAND', href: '/explore', icon: Search },
  { id: 'cmd_airing', label: 'View Airing Schedule', category: 'COMMAND', href: '/airing', icon: Calendar },
  { id: 'cmd_collections', label: 'Curated Editorial Collections', category: 'COMMAND', href: '/collections', icon: Bookmark },
  { id: 'cmd_rankings', label: 'View All-Time Rankings', category: 'COMMAND', href: '/rankings', icon: Trophy },
  { id: 'cmd_news', label: 'Latest Anime News & Industry Stories', category: 'COMMAND', href: '/news', icon: Newspaper },
  { id: 'cmd_spaces', label: 'Anime Spaces & Communities', category: 'COMMAND', href: '/spaces', icon: MessageSquareHeart },
  { id: 'cmd_studios', label: 'Browse Production Studios', category: 'COMMAND', href: '/studios', icon: Building2 },
  { id: 'cmd_people', label: 'Creators & Voice Cast Encyclopedia', category: 'COMMAND', href: '/people', icon: Users2 },
  { id: 'cmd_library', label: 'Open My Library', category: 'COMMAND', href: '/library', icon: Bookmark },
  { id: 'cmd_history', label: 'View Watch History', category: 'COMMAND', href: '/history', icon: Clock },
  { id: 'cmd_settings', label: 'System Settings', category: 'COMMAND', href: '/settings', icon: Settings },
];

export const SearchModal: React.FC<SearchModalProps> = ({ isOpen, onClose }) => {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<{
    anime: any[];
    studios: any[];
    people: any[];
    news: any[];
    communities: any[];
  }>({
    anime: [],
    studios: [],
    people: [],
    news: [],
    communities: [],
  });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Global Esc key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Live multi-entity search
  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    let isCancelled = false;

    const timer = setTimeout(async () => {
      try {
        const q = query.trim();
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled) {
            setData(json);
            setSelectedIndex(0);
          }
        }
      } catch (err) {
        console.error('Command search error:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    }, 180);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query, isOpen]);

  // Build flattened selectable list for keyboard navigation
  const flatItems: Array<{ id: string; href: string }> = [];

  if (query.trim() === '') {
    COMMAND_ACTIONS.forEach((cmd) => flatItems.push({ id: cmd.id, href: cmd.href }));
  }

  data.anime.forEach((a) => flatItems.push({ id: `anime_${a.id}`, href: `/anime/${a.slug || a.id}` }));
  data.studios.forEach((s) => flatItems.push({ id: `studio_${s.id}`, href: `/studios/${s.slug || s.id}` }));
  data.people.forEach((p) => flatItems.push({ id: `person_${p.id}`, href: `/people/${p.slug || p.id}` }));
  data.news.forEach((n) => flatItems.push({ id: `news_${n.id}`, href: `/news/${n.slug || n.id}` }));
  data.communities.forEach((c) => flatItems.push({ id: `comm_${c.id}`, href: `/spaces/${c.slug || c.id}` }));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < flatItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flatItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatItems[selectedIndex]) {
        router.push(flatItems[selectedIndex].href);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.backdrop} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Command Search Input */}
        <div className={styles.inputRow}>
          {isLoading ? (
            <Loader2 size={18} className={styles.spinIcon} />
          ) : (
            <Search size={18} className={styles.searchIcon} />
          )}
          <input
            ref={inputRef}
            type="text"
            className={styles.input}
            placeholder="Type a command or search anime, studios, people, news..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          {query ? (
            <button aria-label="Clear search" type="button" className={styles.clearBtn} onClick={() => setQuery('')}>
              <X size={16} />
            </button>
          ) : (
            <span className={styles.kbdTag}>ESC to close</span>
          )}
        </div>

        {/* Results / Commands Scrollable Area */}
        <div className={styles.resultsContainer}>
          {/* Quick Navigation Commands (shown when empty or matching) */}
          {query.trim() === '' && (
            <div className={styles.resultGroup}>
              <span className={styles.groupHeading}>Quick Commands</span>
              {COMMAND_ACTIONS.map((cmd, idx) => {
                const Icon = cmd.icon;
                const isSelected = selectedIndex === idx;
                return (
                  <Link
                    key={cmd.id}
                    href={cmd.href}
                    onClick={onClose}
                    className={`${styles.commandActionItem} ${isSelected ? styles.commandActionItemActive : ''}`}
                  >
                    <Icon size={16} className={styles.commandActionIcon} />
                    <span>{cmd.label}</span>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Group 1: Anime Results */}
          {data.anime && data.anime.length > 0 && (
            <div className={styles.resultGroup}>
              <span className={styles.groupHeading}>Anime</span>
              {data.anime.map((anime) => {
                const itemIndex = flatItems.findIndex((x) => x.id === `anime_${anime.id}`);
                const isSelected = selectedIndex === itemIndex;
                return (
                  <Link
                    key={anime.id}
                    href={`/anime/${anime.slug || anime.id}`}
                    onClick={onClose}
                    className={`${styles.resultItem} ${isSelected ? styles.resultItemActive : ''}`}
                  >
                    <AnimePoster
                      src={anime.posterUrl}
                      alt={anime.title}
                      width={32}
                      height={44}
                      className={styles.resultPoster}
                    />
                    <div className={styles.resultInfo}>
                      <span className={styles.resultTitle}>{sanitizePublicEntityName(anime.title)}</span>
                      <div className={styles.resultMeta}>
                        <span>{anime.year || 'Unknown'}</span>
                        <span>·</span>
                        <span>{anime.type || 'TV'}</span>
                        {anime.score && (
                          <>
                            <span>·</span>
                            <span className={styles.resultScore}><Star size={12} fill="currentColor" aria-hidden="true" /> {Number(anime.score).toFixed(1)}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Group 2: Studio Results */}
          {data.studios && data.studios.length > 0 && (
            <div className={styles.resultGroup}>
              <span className={styles.groupHeading}>Studios</span>
              {data.studios.map((studio) => {
                const itemIndex = flatItems.findIndex((x) => x.id === `studio_${studio.id}`);
                const isSelected = selectedIndex === itemIndex;
                return (
                  <Link
                    key={studio.id}
                    href={`/studios/${studio.slug || studio.id}`}
                    onClick={onClose}
                    className={`${styles.resultItem} ${isSelected ? styles.resultItemActive : ''}`}
                  >
                    <div className={styles.resultAvatar}>
                      <Building2 size={16} />
                    </div>
                    <div className={styles.resultInfo}>
                      <span className={styles.resultTitle}>{sanitizePublicEntityName(studio.name)}</span>
                      <span className={styles.resultMeta}>Production Studio</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Group 3: People / Creators Results */}
          {data.people && data.people.length > 0 && (
            <div className={styles.resultGroup}>
              <span className={styles.groupHeading}>People & Creators</span>
              {data.people.map((person) => {
                const itemIndex = flatItems.findIndex((x) => x.id === `person_${person.id}`);
                const isSelected = selectedIndex === itemIndex;
                return (
                  <Link
                    key={person.id}
                    href={`/people/${person.slug || person.id}`}
                    onClick={onClose}
                    className={`${styles.resultItem} ${isSelected ? styles.resultItemActive : ''}`}
                  >
                    <div className={styles.resultAvatar}>
                      <Users2 size={16} />
                    </div>
                    <div className={styles.resultInfo}>
                      <span className={styles.resultTitle}>{sanitizePublicEntityName(person.name)}</span>
                      <span className={styles.resultMeta}>{person.primaryRole || 'Staff & Cast'}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Group 4: Editorial & News */}
          {data.news && data.news.length > 0 && (
            <div className={styles.resultGroup}>
              <span className={styles.groupHeading}>News & Editorial</span>
              {data.news.map((news) => {
                const itemIndex = flatItems.findIndex((x) => x.id === `news_${news.id}`);
                const isSelected = selectedIndex === itemIndex;
                return (
                  <Link
                    key={news.id}
                    href={`/news/${news.slug || news.id}`}
                    onClick={onClose}
                    className={`${styles.resultItem} ${isSelected ? styles.resultItemActive : ''}`}
                  >
                    <div className={styles.resultAvatar}>
                      <Newspaper size={16} />
                    </div>
                    <div className={styles.resultInfo}>
                      <span className={styles.resultTitle}>{sanitizePublicEntityName(news.title)}</span>
                      <span className={styles.resultMeta}>{news.category || 'Industry Story'}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Group 5: Spaces & Communities */}
          {data.communities && data.communities.length > 0 && (
            <div className={styles.resultGroup}>
              <span className={styles.groupHeading}>Spaces &amp; Communities</span>
              {data.communities.map((comm) => {
                const itemIndex = flatItems.findIndex((x) => x.id === `comm_${comm.id}`);
                const isSelected = selectedIndex === itemIndex;
                return (
                  <Link
                    key={comm.id}
                    href={`/spaces/${comm.slug || comm.id}`}
                    onClick={onClose}
                    className={`${styles.resultItem} ${isSelected ? styles.resultItemActive : ''}`}
                  >
                    <div className={styles.resultAvatar}>
                      <MessageSquareHeart size={16} />
                    </div>
                    <div className={styles.resultInfo}>
                      <span className={styles.resultTitle}>{sanitizePublicEntityName(comm.name)}</span>
                      <span className={styles.resultMeta}>{comm.memberCount || 1} Members</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Command Center Keyboard Footer */}
        <div className={styles.footerRow}>
          <div className={styles.shortcutsList}>
            <span className={styles.shortcutItem}>
              <kbd className={styles.kbdTag}>↑↓</kbd> Navigate
            </span>
            <span className={styles.shortcutItem}>
              <kbd className={styles.kbdTag}>↵</kbd> Select
            </span>
            <span className={styles.shortcutItem}>
              <kbd className={styles.kbdTag}>ESC</kbd> Close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
