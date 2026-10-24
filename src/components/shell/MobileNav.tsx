'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LucideIcon, Home, Compass, Search, Users, Bookmark, User, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import styles from './MobileNav.module.css';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  isSearch?: boolean;
}

const MOBILE_NAV: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Explore', href: '/anime', icon: Compass },
  { label: 'Search', href: '#search', icon: Search, isSearch: true },
  { label: 'Schedule', href: '/schedule', icon: Calendar },
  { label: 'Library', href: '/library', icon: Bookmark },
  { label: 'Profile', href: '/profile/you', icon: User },
];

interface MobileNavProps {
  onOpenSearch?: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ onOpenSearch }) => {
  const pathname = usePathname();
  const { user, openAuthModal } = useAuth();

  const isRouteActive = (href: string) => {
    if (!pathname) return false;
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <nav className={styles.mobileNav} aria-label="Mobile Navigation">
      <div className={styles.navContainer}>
        {MOBILE_NAV.map((item) => {
          const isProfile = item.href === '/profile/you';
          const active = isRouteActive(item.href);
          const Icon = item.icon;

          if (item.isSearch) {
            return (
              <button
                key="mobile_search"
                type="button"
                className={styles.navItem}
                onClick={onOpenSearch}
                aria-label="Open Search"
              >
                <Icon size={18} strokeWidth={1.75} className={styles.icon} />
                <span className={styles.label}>{item.label}</span>
              </button>
            );
          }

          if (isProfile && !user) {
            return (
              <button
                key="mobile_sign_in"
                type="button"
                className={styles.navItem}
                onClick={() => openAuthModal()}
                aria-label="Sign in"
              >
                <Icon size={18} strokeWidth={1.75} className={styles.icon} />
                <span className={styles.label}>Sign In</span>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={18} strokeWidth={active ? 2.2 : 1.75} className={styles.icon} />
              <span className={styles.label}>{item.label}</span>
              {active && <span className={styles.activeDot} />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
