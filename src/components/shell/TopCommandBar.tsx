'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  Plus,
  Bell,
  User,
  Settings,
  Bookmark,
  LogOut,
  Sparkles,
  Command,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import styles from './TopCommandBar.module.css';

interface TopCommandBarProps {
  onOpenSearch: () => void;
  onQuickAdd?: () => void;
}

export const TopCommandBar: React.FC<TopCommandBarProps> = ({ onOpenSearch, onQuickAdd }) => {
  const router = useRouter();
  const { user, openAuthModal, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className={styles.topCommandBar} role="banner">
      {/* Search / Command Trigger Input */}
      <div className={styles.searchSection}>
        <button
          type="button"
          className={styles.commandTriggerBtn}
          onClick={onOpenSearch}
          aria-label="Open command palette (Ctrl+K)"
        >
          <Search size={15} className={styles.commandIcon} />
          <span className={styles.commandLabel}>
            Search anime, studios, people, news or run command...
          </span>
          <kbd className={styles.commandKbd}>
            <Command size={10} /> K
          </kbd>
        </button>
      </div>

      {/* Actions: Quick Log, Notifications, User Menu */}
      <div className={styles.actionsSection}>
        {onQuickAdd && (
          <button
            type="button"
            className={styles.quickLogBtn}
            onClick={onQuickAdd}
            title="Log anime progress (Ctrl+L)"
          >
            <Plus size={14} className={styles.quickLogIcon} />
            <span>Log</span>
          </button>
        )}

        {/* Notifications Tray */}
        <div ref={notifRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className={styles.iconActionBtn}
            onClick={() => setShowNotifications((prev) => !prev)}
            title="Notifications"
            aria-label="View notifications"
          >
            <Bell size={16} />
            <span className={styles.notifBadge} />
          </button>

          {showNotifications && (
            <div className={styles.dropdownMenu} style={{ width: '280px' }}>
              <div className={styles.dropdownHeader}>
                <span className={styles.dropdownUsername}>Intelligence Feed</span>
                <span className={styles.dropdownRole}>System Updates</span>
              </div>
              <div style={{ padding: '8px 10px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                <span>✨ OTAKUVA Intelligence System v2.4 Active. All systems nominal.</span>
              </div>
            </div>
          )}
        </div>

        {/* User Account / Sign In */}
        {user ? (
          <div ref={menuRef} className={styles.userMenuContainer}>
            <button
              type="button"
              className={styles.avatarBtn}
              onClick={() => setShowUserMenu((prev) => !prev)}
              aria-label="User menu"
              aria-expanded={showUserMenu}
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.username}
                  className={styles.avatarImg}
                />
              ) : (
                <div className={styles.avatarFallback}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
              )}
              <span className={styles.usernameLabel}>{user.username}</span>
            </button>

            {showUserMenu && (
              <div className={styles.dropdownMenu} role="menu">
                <div className={styles.dropdownHeader}>
                  <div className={styles.dropdownUsername}>{user.username}</div>
                  <div className={styles.dropdownRole}>{user.role || 'MEMBER'}</div>
                </div>

                <Link
                  href="/profile/you"
                  className={styles.dropdownItem}
                  onClick={() => setShowUserMenu(false)}
                  role="menuitem"
                >
                  <User size={14} />
                  <span>Your Profile</span>
                </Link>

                <Link
                  href="/library"
                  className={styles.dropdownItem}
                  onClick={() => setShowUserMenu(false)}
                  role="menuitem"
                >
                  <Bookmark size={14} />
                  <span>My Library</span>
                </Link>

                <Link
                  href="/settings"
                  className={styles.dropdownItem}
                  onClick={() => setShowUserMenu(false)}
                  role="menuitem"
                >
                  <Settings size={14} />
                  <span>Settings</span>
                </Link>

                <button
                  type="button"
                  className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  role="menuitem"
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
            className={styles.authTriggerBtn}
            onClick={() => openAuthModal()}
          >
            <User size={14} />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
