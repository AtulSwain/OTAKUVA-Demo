'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Search,
  Plus,
  User,
  LogOut,
  Settings,
  Bookmark,
  Clock,
  ChevronDown,
  Menu,
  X,
  Flame,
  Calendar,
  Trophy,
  Layers,
  Building2,
  Clapperboard,
  Users2,
  FolderTree,
  Newspaper,
  Users,
  Heart,
  Star,
  MessageSquare,
  Bell,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import styles from './Header.module.css';

interface HeaderProps {
  onOpenSearch: () => void;
  onQuickAdd: () => void;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export const Header: React.FC<HeaderProps> = ({ onOpenSearch, onQuickAdd }) => {
  const pathname = usePathname();
  const { user, openAuthModal, logout } = useAuth();
  
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const headerRef = useRef<HTMLDivElement>(null);
  const megaMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Notifications are per-user and server-owned. Fetched only for a signed-in
  // user and cleared on sign-out, so one account's tray never leaks to the next.
  const loadNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Opening the tray marks everything read via the POST the API already exposes.
  const handleToggleNotifications = async () => {
    const opening = !isNotifOpen;
    setIsNotifOpen(opening);
    if (!opening || !user) return;

    await loadNotifications();
    if (unreadCount > 0) {
      try {
        await fetch('/api/notifications', { method: 'POST' });
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      } catch (err) {
        console.error('Failed to mark notifications read:', err);
      }
    }
  };

  // Scroll listener for sticky compacting
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Click outside to close menus
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (megaMenuRef.current && !megaMenuRef.current.contains(e.target as Node)) {
        setIsMegaMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setIsMegaMenuOpen(false);
    setIsUserMenuOpen(false);
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const isLinkActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  const isExploreGroupActive = ['/seasonal', '/airing', '/rankings', '/collections'].some((p) =>
    pathname?.startsWith(p) ?? false
  );

  return (
    <header
      className={`${styles.header} ${pathname === '/' ? styles.headerHome : ''} ${isScrolled ? styles.headerScrolled : ''}`}
      ref={headerRef}
    >
      <div className={styles.headerInner}>
        {/* Left: Brand & Mobile Menu Button */}
        <div className={styles.leftGroup}>
          <button
            type="button"
            className={styles.mobileMenuBtn}
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <Link href="/" className={styles.brandLink}>
            <span className={styles.brandWordmark}>OTAKUVA</span>
          </Link>
        </div>

        {/* Center: Desktop Top Navigation */}
        <nav className={styles.centerNav} aria-label="Main Navigation">
          <Link
            href="/"
            className={`${styles.navLink} ${pathname === '/' ? styles.navLinkActive : ''}`}
          >
            Home
          </Link>

          <Link
            href="/explore"
            className={`${styles.navLink} ${isLinkActive('/explore') ? styles.navLinkActive : ''}`}
          >
            Explore
          </Link>

          <Link
            href="/anime"
            className={`${styles.navLink} ${isLinkActive('/anime') ? styles.navLinkActive : ''}`}
          >
            Anime
          </Link>

          <Link
            href="/studios"
            className={`${styles.navLink} ${isLinkActive('/studios') || isLinkActive('/studio') ? styles.navLinkActive : ''}`}
          >
            Studios
          </Link>

          <Link
            href="/production"
            className={`${styles.navLink} ${isLinkActive('/production') ? styles.navLinkActive : ''}`}
          >
            Production
          </Link>

          <Link
            href="/schedule"
            className={`${styles.navLink} ${isLinkActive('/schedule') ? styles.navLinkActive : ''}`}
          >
            Schedule
          </Link>

          <Link
            href="/artists"
            className={`${styles.navLink} ${isLinkActive('/artists') || isLinkActive('/directory') || isLinkActive('/person') || isLinkActive('/people') || isLinkActive('/creator') ? styles.navLinkActive : ''}`}
          >
            Artists
          </Link>

          <Link
            href="/news"
            className={`${styles.navLink} ${isLinkActive('/news') ? styles.navLinkActive : ''}`}
          >
            News
          </Link>

          <Link
            href="/community"
            className={`${styles.navLink} ${isLinkActive('/community') || isLinkActive('/spaces') ? styles.navLinkActive : ''}`}
          >
            Community
          </Link>
        </nav>

        {/* Right: Search, Library, User Avatar */}
        <div className={styles.rightGroup}>
          <button
            type="button"
            className={styles.searchTrigger}
            onClick={onOpenSearch}
            aria-label="Open Command Search (Cmd+K)"
          >
            <Search size={14} />
            <span className={styles.searchLabel}>Search</span>
            <kbd className={styles.searchKbd}>⌘K</kbd>
          </button>

          <Link href="/library" className={styles.libraryNavLink}>
            <Bookmark size={14} />
            <span>Library</span>
          </Link>

          {/* Notification tray — where a community owner sees join requests */}
          {user && (
            <div className={styles.notifWrapper} ref={notifRef}>
              <button
                type="button"
                className={styles.notifTrigger}
                onClick={handleToggleNotifications}
                aria-expanded={isNotifOpen}
                aria-label={
                  unreadCount > 0
                    ? `Notifications, ${unreadCount} unread`
                    : 'Notifications'
                }
              >
                <Bell size={14} />
                {unreadCount > 0 && (
                  <span className={styles.notifBadge}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {isNotifOpen && (
                <div className={styles.notifDropdown}>
                  <div className={styles.notifHeader}>
                    <span>Notifications</span>
                    <span className={styles.notifHeaderMeta}>
                      {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
                    </span>
                  </div>

                  {notifications.length === 0 ? (
                    <div className={styles.notifEmpty}>Nothing here yet.</div>
                  ) : (
                    <div className={styles.notifList}>
                      {notifications.map((n) =>
                        n.linkUrl ? (
                          <Link
                            key={n.id}
                            href={n.linkUrl}
                            className={styles.notifItem}
                            onClick={() => setIsNotifOpen(false)}
                          >
                            <span className={styles.notifItemTitle}>{n.title}</span>
                            {n.body && <span className={styles.notifItemBody}>{n.body}</span>}
                            <span className={styles.notifItemTime}>{relativeTime(n.createdAt)}</span>
                          </Link>
                        ) : (
                          <div key={n.id} className={styles.notifItem}>
                            <span className={styles.notifItemTitle}>{n.title}</span>
                            {n.body && <span className={styles.notifItemBody}>{n.body}</span>}
                            <span className={styles.notifItemTime}>{relativeTime(n.createdAt)}</span>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {user ? (
            <div className={styles.userMenuWrapper} ref={userMenuRef}>
              <button
                type="button"
                className={styles.userTrigger}
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-expanded={isUserMenuOpen}
                aria-label="User Account Menu"
              >
                <div className={styles.userAvatar}>
                  <span>{user.username.slice(0, 2).toUpperCase()}</span>
                </div>
                <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} />
              </button>

              {isUserMenuOpen && (
                <div className={styles.userDropdown}>
                  <Link
                    href={`/profile/${user.username || 'you'}`}
                    className={styles.dropdownLink}
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <User size={14} />
                    <span>My Profile</span>
                  </Link>

                  <Link
                    href="/library"
                    className={styles.dropdownLink}
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Bookmark size={14} />
                    <span>My Library</span>
                  </Link>

                  <Link
                    href="/library?status=favorites"
                    className={styles.dropdownLink}
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Heart size={14} />
                    <span>Favorites</span>
                  </Link>

                  <Link
                    href="/history"
                    className={styles.dropdownLink}
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Clock size={14} />
                    <span>Watch History</span>
                  </Link>

                  <Link
                    href="/settings"
                    className={styles.dropdownLink}
                    onClick={() => setIsUserMenuOpen(false)}
                  >
                    <Settings size={14} />
                    <span>Settings</span>
                  </Link>

                  <div className={styles.dropdownDivider} />

                  <button
                    type="button"
                    className={styles.dropdownLink}
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      logout();
                    }}
                    style={{ width: '100%', textAlign: 'left', cursor: 'pointer' }}
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className={styles.authBtn}
              onClick={() => openAuthModal()}
            >
              Sign In
            </button>
          )}
        </div>
      </div>

      {/* Mobile Slide-Down Navigation Overlay */}
      {isMobileMenuOpen && (
        <div className={styles.mobileOverlay} role="dialog" aria-modal="true">
          <div className={styles.mobileNavGroup}>
            <span className={styles.mobileGroupLabel}>Discover</span>
            <Link href="/" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>
              <span>Home</span>
            </Link>
            <Link href="/explore" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>
              <span>Explore</span>
            </Link>
            <Link href="/anime" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>
              <span>Anime</span>
            </Link>
          </div>

          <div className={styles.mobileNavGroup}>
            <span className={styles.mobileGroupLabel}>Industry</span>
            <Link href="/studios" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>
              <span>Studios</span>
            </Link>
            <Link href="/production" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>
              <span>Production</span>
            </Link>
            <Link href="/artists" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>
              <span>Artists</span>
            </Link>
          </div>

          <div className={styles.mobileNavGroup}>
            <span className={styles.mobileGroupLabel}>Content &amp; Community</span>
            <Link href="/news" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>
              <span>News</span>
            </Link>
            <Link href="/community" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>
              <span>Community</span>
            </Link>
            <Link href="/library" className={styles.mobileNavLink} onClick={() => setIsMobileMenuOpen(false)}>
              <span>Library</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};
