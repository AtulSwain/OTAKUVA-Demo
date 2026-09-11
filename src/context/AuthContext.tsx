'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useIsomorphicLayoutEffect } from '../lib/useIsomorphicLayoutEffect';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  role: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
}

export type AuthIntent =
  | { type: 'RATE_ANIME'; animeId: string; animeTitle?: string; score: number }
  | { type: 'OPEN_RATING_MODAL'; animeId: string; animeTitle?: string; defaultScore?: number }
  | { type: 'ADD_TO_LIBRARY'; animeId: string; animeTitle?: string; status: 'watching' | 'completed' | 'plan_to_watch' | 'on_hold' | 'dropped' }
  | { type: 'ADVANCE_EPISODE'; animeId: string; animeTitle?: string; episodeNumber: number }
  | { type: 'TOGGLE_FAVORITE'; animeId: string; animeTitle?: string }
  | { type: 'WRITE_REVIEW'; animeId: string; animeTitle?: string }
  | { type: 'START_DISCUSSION'; animeId?: string; animeTitle?: string }
  | { type: 'CUSTOM'; animeId?: string; animeTitle?: string; callback?: () => void; description?: string };

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  showAuthModal: boolean;
  authModalMode: 'login' | 'register';
  pendingIntent: AuthIntent | null;
  intentMessage: string | null;
  openAuthModal: (mode?: 'login' | 'register') => void;
  openAuthModalWithIntent: (intent: AuthIntent, customMessage?: string, mode?: 'login' | 'register') => void;
  consumePendingIntent: () => AuthIntent | null;
  closeAuthModal: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // The server always renders signed-out, so the first client render must
  // too. The cached identity is applied right after hydration (before paint)
  // and /api/auth/me then confirms or clears it. Reading localStorage in the
  // useState initializer made every signed-in page fail hydration.
  const [user, setUser] = useState<AuthUser | null>(null);
  useIsomorphicLayoutEffect(() => {
    try {
      const cached = localStorage.getItem('otakuva_user');
      if (cached) setUser((current) => current ?? JSON.parse(cached));
    } catch {
      // ignore parse/storage errors
    }
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [pendingIntent, setPendingIntent] = useState<AuthIntent | null>(null);
  const [intentMessage, setIntentMessage] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        const activeUser = data.user || null;
        setUser(activeUser);
        if (typeof window !== 'undefined') {
          if (activeUser) {
            localStorage.setItem('otakuva_user', JSON.stringify(activeUser));
          } else {
            localStorage.removeItem('otakuva_user');
          }
        }
      } else {
        setUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('otakuva_user');
        }
      }
    } catch (err) {
      // In case of transient network error, keep hydrated user if any
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();

    // Multi-tab synchronization: sync user session when another tab signs in or out
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'otakuva_user') {
        if (e.newValue) {
          try {
            setUser(JSON.parse(e.newValue));
          } catch {
            fetchSession();
          }
        } else {
          setUser(null);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchSession();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchSession]);

  const login = async (identifier: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to sign in.' };
      }
      setUser(data.user);
      if (typeof window !== 'undefined' && data.user) {
        localStorage.setItem('otakuva_user', JSON.stringify(data.user));
      }
      setShowAuthModal(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'An unexpected error occurred.' };
    }
  };

  const register = async (username: string, email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Failed to create account.' };
      }
      setUser(data.user);
      if (typeof window !== 'undefined' && data.user) {
        localStorage.setItem('otakuva_user', JSON.stringify(data.user));
      }
      setShowAuthModal(false);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'An unexpected error occurred.' };
    }
  };

  const logout = async () => {
    const currentUserId = user?.id;
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setPendingIntent(null);
      setIntentMessage(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('otakuva_user');
        if (currentUserId) {
          localStorage.removeItem(`otakuva_library_${currentUserId}`);
        }
      }
      window.location.reload();
    }
  };

  const openAuthModal = (mode: 'login' | 'register' = 'login') => {
    setAuthModalMode(mode);
    setIntentMessage(null);
    setShowAuthModal(true);
  };

  const openAuthModalWithIntent = (
    intent: AuthIntent,
    customMessage?: string,
    mode: 'login' | 'register' = 'login'
  ) => {
    setPendingIntent(intent);
    setIntentMessage(
      customMessage ||
        (intent.type === 'RATE_ANIME'
          ? `Sign in to submit your rating (${intent.score.toFixed(1)}/10)`
          : intent.type === 'ADD_TO_LIBRARY'
          ? 'Sign in to add this anime to your personal library'
          : intent.type === 'TOGGLE_FAVORITE'
          ? 'Sign in to favorite this anime'
          : intent.type === 'WRITE_REVIEW'
          ? 'Sign in to write a community review'
          : intent.type === 'START_DISCUSSION'
          ? 'Sign in to start a forum discussion'
          : 'Sign in to continue')
    );
    setAuthModalMode(mode);
    setShowAuthModal(true);
  };

  const consumePendingIntent = () => {
    const current = pendingIntent;
    setPendingIntent(null);
    setIntentMessage(null);
    return current;
  };

  const closeAuthModal = () => {
    setShowAuthModal(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        register,
        logout,
        showAuthModal,
        authModalMode,
        pendingIntent,
        intentMessage,
        openAuthModal,
        openAuthModalWithIntent,
        consumePendingIntent,
        closeAuthModal,
        refreshUser: fetchSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
