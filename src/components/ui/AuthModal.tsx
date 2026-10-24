'use client';

import React, { useEffect, useState } from 'react';
import { X, Loader2, Bookmark, Star, Users, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, type AuthResult } from '../../context/AuthContext';
import { isCreator } from '../../lib/roles';
import { useToast } from '../../context/ToastContext';
import { PhoneOtpFlow } from '../auth/PhoneOtpFlow';
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, validateUsername } from '../../lib/identity/username';
import styles from './AuthModal.module.css';

type UsernameStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'error'; message: string };

const USERNAME_CHECK_DEBOUNCE_MS = 400;

/** Live "is this username free?" check, debounced, with stale responses ignored. */
function useUsernameAvailability(username: string, enabled: boolean): UsernameStatus {
  const [status, setStatus] = useState<UsernameStatus>({ kind: 'idle' });

  useEffect(() => {
    const trimmed = username.trim();
    if (!enabled || !trimmed) {
      setStatus({ kind: 'idle' });
      return;
    }
    const invalid = validateUsername(trimmed);
    if (invalid) {
      setStatus({ kind: 'unavailable', message: invalid });
      return;
    }
    setStatus({ kind: 'checking' });
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/auth/username-available?username=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) setStatus({ kind: 'error', message: data.error || 'Could not check this username.' });
        else if (data.available) setStatus({ kind: 'available' });
        else setStatus({ kind: 'unavailable', message: data.error || 'This username has been taken.' });
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setStatus({ kind: 'error', message: 'Could not check this username.' });
      }
    }, USERNAME_CHECK_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [username, enabled]);

  return status;
}

export const AuthModal: React.FC = () => {
  const {
    showAuthModal,
    authModalMode,
    intentMessage,
    closeAuthModal,
    openAuthModal,
    loginWithPhone,
    loginWithPassword,
    register,
  } = useAuth();
  const { showToast } = useToast();

  const [username, setUsername] = useState('');
  const [legacy, setLegacy] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [legacyError, setLegacyError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Remounts the phone flow (back to the number step) when switching tabs.
  const [flowKey, setFlowKey] = useState(0);

  const usernameStatus = useUsernameAvailability(username, showAuthModal && authModalMode === 'register');
  const router = useRouter();

  if (!showAuthModal) return null;

  // One sign-in for everyone (owner, 2026-10-24: no user/creator choice
  // here). A creator account opens its dashboard afterwards — unless the
  // window was opened for an action (rate, follow…), which then continues.
  // Becoming a creator is the explicit step on /creator.
  const afterSignIn = (res: AuthResult) => {
    if (!intentMessage && isCreator(res.role)) router.push('/creator');
  };

  const switchMode = (mode: 'login' | 'register') => {
    setLegacy(false);
    setLegacyError(null);
    setFlowKey((k) => k + 1);
    openAuthModal(mode);
  };

  // Signing in to a number with no account, or signing up with one that
  // already has an account: send them to the other tab.
  const onPhoneErrorCode = (code: string) => {
    if (code === 'PHONE_NOT_REGISTERED' && authModalMode === 'login') {
      showToast('No account uses that number yet. Pick a username to create one.', 'info', 6000);
      switchMode('register');
    } else if (code === 'PHONE_IN_USE' && authModalMode === 'register') {
      showToast('That number already has an account. Sign in with it instead.', 'info', 6000);
      switchMode('login');
    }
  };

  const handleLegacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLegacyError(null);
    setSubmitting(true);
    try {
      const res = await loginWithPassword(identifier, password);
      if (!res.success) {
        setLegacyError(res.error || 'Failed to sign in.');
        if (res.code === 'USE_PHONE_SIGN_IN') setLegacy(false);
      } else {
        showToast('Signed in.', 'success');
        afterSignIn(res);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const usernameOk = usernameStatus.kind === 'available';

  return (
    <div className={styles.overlay} onClick={closeAuthModal} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleBox}>
            <span className={styles.brandTag}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/otakuva-mark.png" alt="" width={36} height={28} className={styles.brandMark} />
              OTAKUVA
            </span>
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
            onClick={() => switchMode('login')}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${authModalMode === 'register' ? styles.tabBtnActive : ''}`}
            onClick={() => switchMode('register')}
          >
            Create Account
          </button>
        </div>

        <div className={styles.form}>
          {authModalMode === 'register' ? (
            <>
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="signup-username">
                  Username
                </label>
                <div className={styles.inputWithStatus}>
                  <input
                    id="signup-username"
                    type="text"
                    className={`${styles.input} ${
                      usernameStatus.kind === 'available' ? styles.inputOk : usernameStatus.kind === 'unavailable' ? styles.inputBad : ''
                    }`}
                    placeholder="e.g. otaku_collector"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    maxLength={USERNAME_MAX_LENGTH}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-describedby="signup-username-status"
                    aria-invalid={usernameStatus.kind === 'unavailable'}
                    autoFocus
                  />
                  <span className={styles.statusIcon} aria-hidden="true">
                    {usernameStatus.kind === 'checking' && <Loader2 size={15} className={styles.spin} />}
                    {usernameStatus.kind === 'available' && <CheckCircle2 size={16} className={styles.ok} />}
                    {usernameStatus.kind === 'unavailable' && <XCircle size={16} className={styles.bad} />}
                  </span>
                </div>
                <p
                  id="signup-username-status"
                  className={`${styles.fieldNote} ${
                    usernameStatus.kind === 'available' ? styles.ok : usernameStatus.kind === 'unavailable' ? styles.bad : ''
                  }`}
                  aria-live="polite"
                >
                  {usernameStatus.kind === 'available'
                    ? 'Username is available.'
                    : usernameStatus.kind === 'unavailable' || usernameStatus.kind === 'error'
                    ? usernameStatus.message
                    : usernameStatus.kind === 'checking'
                    ? 'Checking…'
                    : `At least ${USERNAME_MIN_LENGTH} characters: letters, numbers, _ and .`}
                </p>
              </div>

              <PhoneOtpFlow
                key={`register-${flowKey}`}
                purpose="register"
                username={username.trim()}
                canSend={usernameOk}
                submitLabel="Create Account"
                onSubmitCode={async (phone, country, code) => {
                  const res = await register(username.trim(), phone, country, code);
                  if (res.success) {
                    showToast(`Welcome to OTAKUVA, ${username.trim()}!`, 'success');
                    afterSignIn(res);
                  }
                  return res;
                }}
                onErrorCode={onPhoneErrorCode}
              />
            </>
          ) : legacy ? (
            <form className={styles.legacyForm} onSubmit={handleLegacySubmit}>
              <p className={styles.legacyNote}>
                For accounts created with email and password before phone sign-in. After signing in you&apos;ll be asked to
                verify a phone number.
              </p>
              {legacyError && <div className={styles.errorBox}>{legacyError}</div>}
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="legacy-identifier">
                  Username or Email
                </label>
                <input
                  id="legacy-identifier"
                  type="text"
                  className={styles.input}
                  placeholder="you@domain.com or username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className={styles.inputGroup}>
                <label className={styles.label} htmlFor="legacy-password">
                  Password
                </label>
                <input
                  id="legacy-password"
                  type="password"
                  className={styles.input}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <button type="submit" className={styles.submitBtn} disabled={submitting}>
                {submitting ? (
                  <span className={styles.loadingSpan}>
                    <Loader2 size={15} className={styles.spin} />
                    <span>Processing...</span>
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
              <button type="button" className={styles.textBtn} onClick={() => { setLegacy(false); setLegacyError(null); }}>
                Sign in with phone instead
              </button>
            </form>
          ) : (
            <>
              <PhoneOtpFlow
                key={`login-${flowKey}`}
                purpose="login"
                submitLabel="Sign In"
                autoFocus
                onSubmitCode={async (phone, country, code) => {
                  const res = await loginWithPhone(phone, country, code);
                  if (res.success) afterSignIn(res);
                  return res;
                }}
                onErrorCode={onPhoneErrorCode}
              />
              <button type="button" className={styles.textBtn} onClick={() => setLegacy(true)}>
                Have an older account with email &amp; password?
              </button>
            </>
          )}

          {/* Continue Exploring Dismiss Button */}
          <button type="button" className={styles.exploreBtn} onClick={closeAuthModal}>
            <span>Continue Exploring</span>
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
