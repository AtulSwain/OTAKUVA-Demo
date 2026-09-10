'use client';

import React, { useState } from 'react';
import { X, Loader2, Bookmark, Star, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import styles from './AuthModal.module.css';

export const AuthModal: React.FC = () => {
  const {
    showAuthModal,
    authModalMode,
    intentMessage,
    closeAuthModal,
    openAuthModal,
    login,
    register,
  } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!showAuthModal) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (authModalMode === 'login') {
        const res = await login(identifier, password);
        if (!res.success) {
          setError(res.error || 'Failed to sign in.');
        }
      } else {
        const res = await register(username, email, password);
        if (!res.success) {
          setError(res.error || 'Failed to create account.');
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={closeAuthModal} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleBox}>
            <span className={styles.brandTag}>OTAKUVA</span>
            <h2 className={styles.title}>
              {authModalMode === 'login' ? 'SIGN IN TO OTAKUVA' : 'JOIN OTAKUVA'}
            </h2>
            <p className={styles.subtitle}>Create your personal anime profile.</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={closeAuthModal} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Action Intent Banner */}
        {intentMessage && (
          <div className={styles.intentBanner}>
            <span className={styles.intentDot} />
            <span>{intentMessage}</span>
          </div>
        )}

        {/* 3 Core Value Propositions */}
        <div className={styles.valueProps}>
          <div className={styles.propItem}>
            <Bookmark size={13} className={styles.propIcon} />
            <span>Track what you watch.</span>
          </div>
          <div className={styles.propItem}>
            <Star size={13} className={styles.propIcon} />
            <span>Rate what you love.</span>
          </div>
          <div className={styles.propItem}>
            <Users size={13} className={styles.propIcon} />
            <span>Join the community.</span>
          </div>
        </div>

        {/* Auth Mode Toggle Tabs */}
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tabBtn} ${authModalMode === 'login' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setError(null);
              openAuthModal('login');
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${authModalMode === 'register' ? styles.tabBtnActive : ''}`}
            onClick={() => {
              setError(null);
              openAuthModal('register');
            }}
          >
            Create Account
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {error && <div className={styles.errorBox}>{error}</div>}

          {authModalMode === 'login' ? (
            <div className={styles.inputGroup}>
              <label className={styles.label}>Username or Email</label>
              <input
                type="text"
                className={styles.input}
                placeholder="you@domain.com or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                autoFocus
              />
            </div>
          ) : (
            <>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Username</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. otaku_collector"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Email Address</label>
                <input
                  type="email"
                  className={styles.input}
                  placeholder="you@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className={styles.inputGroup}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className={styles.submitBtn} disabled={submitting}>
            {submitting ? (
              <span className={styles.loadingSpan}>
                <Loader2 size={15} className={styles.spin} />
                <span>Processing...</span>
              </span>
            ) : authModalMode === 'login' ? (
              'Sign In'
            ) : (
              'Create Account'
            )}
          </button>

          {/* Continue Exploring Dismiss Button */}
          <button
            type="button"
            className={styles.exploreBtn}
            onClick={closeAuthModal}
          >
            <span>Continue Exploring</span>
            <ArrowRight size={13} />
          </button>
        </form>
      </div>
    </div>
  );
};
