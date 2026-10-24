'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, FolderHeart } from 'lucide-react';
import styles from './lists.module.css';

/** Library has two halves: what you're tracking, and the lists you've made. */
export function LibrarySwitch() {
  const pathname = usePathname() || '';
  const onLists = pathname.startsWith('/library/lists');
  return (
    <nav className={styles.switch} aria-label="Library sections">
      <Link href="/library" className={`${styles.switchLink} ${!onLists ? styles.switchActive : ''}`} aria-current={!onLists ? 'page' : undefined}>
        <Bookmark size={15} aria-hidden="true" /> Tracking
      </Link>
      <Link href="/library/lists" className={`${styles.switchLink} ${onLists ? styles.switchActive : ''}`} aria-current={onLists ? 'page' : undefined}>
        <FolderHeart size={15} aria-hidden="true" /> My lists
      </Link>
    </nav>
  );
}
