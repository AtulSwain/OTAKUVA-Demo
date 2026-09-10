'use client';

import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { MobileNav } from './MobileNav';
import { Footer } from './Footer';
import { SearchModal } from '../ui/SearchModal';
import { QuickLogModal } from '../ui/QuickLogModal';
import { ToastProvider } from '../../context/ToastContext';
import { ToastContainer } from '../ui/ToastContainer';
import { LibraryProvider } from '../../context/LibraryContext';
import { AuthProvider } from '../../context/AuthContext';
import { AuthModal } from '../ui/AuthModal';
import styles from './AppShell.module.css';

interface AppShellProps {
  children: React.ReactNode;
}

const ShellContent: React.FC<AppShellProps> = ({ children }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickLogOpen, setIsQuickLogOpen] = useState(false);

  // Global Keyboard shortcut listener: Cmd+K / Ctrl+K & Cmd+L / Ctrl+L
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        setIsQuickLogOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className={styles.layoutRoot}>
      {/* 1. Global Dark + Grey Top Navigation Bar */}
      <Header
        onOpenSearch={() => setIsSearchOpen(true)}
        onQuickAdd={() => setIsQuickLogOpen(true)}
      />

      {/* 2. Main Content Viewport */}
      <main className={styles.contentArea}>
        <div className={styles.contentInner}>{children}</div>
      </main>

      {/* 3. Dark Footer */}
      <Footer />

      {/* 4. Responsive Mobile Bottom Navigation */}
      <MobileNav onOpenSearch={() => setIsSearchOpen(true)} />

      {/* 5. Command Palette Dialog */}
      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      {/* 6. Quick Watch Log Dialog */}
      <QuickLogModal
        isOpen={isQuickLogOpen}
        onClose={() => setIsQuickLogOpen(false)}
      />

      {/* 7. Authentication Modal */}
      <AuthModal />

      {/* 8. Floating Micro-interaction Toast Container */}
      <ToastContainer />
    </div>
  );
};

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  return (
    <ToastProvider>
      <AuthProvider>
        <LibraryProvider>
          <ShellContent>{children}</ShellContent>
        </LibraryProvider>
      </AuthProvider>
    </ToastProvider>
  );
};
