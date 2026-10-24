'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, Calendar, Compass, Home, LucideIcon, User } from 'lucide-react';
import styles from './BottomNav.module.css';

interface BottomNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const BOTTOM_NAV_ITEMS: BottomNavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'Explore', href: '/anime', icon: Compass },
  { label: 'Schedule', href: '/schedule', icon: Calendar },
  { label: 'Library', href: '/library', icon: Bookmark },
  { label: 'Profile', href: '/profile/you', icon: User },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (!pathname) return false;
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  };

  return (
    <nav className={styles.bottomNav} aria-label="Bottom Navigation">
      <div className={styles.navContainer}>
        {BOTTOM_NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              className={`${styles.navItem} ${active ? styles.navItemActive : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              <span className={styles.iconWrap}>
                <Icon size={19} strokeWidth={active ? 2.2 : 1.75} aria-hidden="true" />
              </span>
              <span className={styles.label}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
