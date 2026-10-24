'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './CommunityHubNav.module.css';

const SECTIONS = [
  { href: '/community', label: 'Communities' },
  { href: '/discussions', label: 'Discussions' },
  { href: '/articles', label: 'Articles' },
];

/**
 * One Community hub: communities, public discussions and member articles used
 * to be three unconnected pages (plus /spaces, a second copy of communities).
 * This bar ties them together on each of the three pages.
 */
export function CommunityHubNav() {
  const pathname = usePathname() || '';
  return (
    <nav className={styles.hubNav} aria-label="Community sections">
      {SECTIONS.map((s) => {
        const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link key={s.href} href={s.href} className={`${styles.hubLink} ${active ? styles.hubLinkActive : ''}`} aria-current={active ? 'page' : undefined}>
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}
