'use client';

import React from 'react';
import { Search } from 'lucide-react';
import styles from './SearchBar.module.css';

interface SearchBarProps {
  onClick?: () => void;
  className?: string;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onClick,
  className = '',
  placeholder = 'Search anime, characters, studios...',
}) => {
  return (
    <button
      type="button"
      className={`${styles.searchTrigger} ${className}`}
      onClick={onClick}
      aria-label="Open search dialog"
    >
      <Search size={14} strokeWidth={1.5} className={styles.searchIcon} />
      <span className={styles.placeholderText}>{placeholder}</span>
      <kbd className={styles.kbdShortcut}>
        <span className={styles.cmdKey}>⌘</span>K
      </kbd>
    </button>
  );
};
