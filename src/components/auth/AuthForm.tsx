'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff, ShieldCheck, ArrowLeft } from 'lucide-react';
import { useAuth, type AuthResult } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { PhoneOtpFlow } from './PhoneOtpFlow';
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH, validateUsername } from '../../lib/identity/username';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordStrength, validatePassword } from '../../lib/identity/password';
import { CHANNEL_NAME_MAX, CHANNEL_URL_MAX, channelProblem } from '../../lib/creator/channelRules';
import styles from '../ui/AuthModal.module.css';
import seg from './AuthForm.module.css';

export type AuthMode = 'login' | 'register' | 'creator';
const MODE_LABEL: Record<AuthMode, string> = { login: 'Sign In', register: 'Create Account', creator: 'Creator' };

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
        const res = await fetch(`/api/auth/username-available?username=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
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

/** Password field with a show/hide toggle. */
function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete: 'current-password' | 'new-password';
  autoFocus?: boolean;
  invalid?: boolean;
}) {
  const [shown, setShown] = useState(false);
  return (
    <div className={seg.pwWrap}>
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        className={`${styles.input} ${seg.pwInput} ${invalid ? styles.inputBad : ''}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        maxLength={PASSWORD_MAX_LENGTH}
        autoFocus={autoFocus}
        spellCheck={false}
        autoCapitalize="none"
      />
      <button type="button" className={seg.eye} onClick={() => setShown((s) => !s)} aria-label={shown ? 'Hide password' : 'Show password'}>
        {shown ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

const STRENGTH_LABEL = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];

/**
 * Opens once the phone is verified: choose a password and confirm it.
 * `onSubmit` gets the password; it returns the server's answer.
 */
function PasswordPanel({
  phoneLabel,
  username,
  submitLabel,
  onSubmit,
  onRestart,
}: {
  phoneLabel: string;
  username?: string;
  submitLabel: string;
  onSubmit: (password: string) => Promise<AuthResult>;
  onRestart: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = password ? validatePassword(password, username) : null;
  const mismatch = confirm.length > 0 && confirm !== password;
  const ready = password.length > 0 && !problem && confirm === password;
  const strength = password ? passwordStrength(password) : 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await onSubmit(password);
      if (!res.success) {
        setError(res.error || 'Something went wrong.');
        if (res.code === 'PASS_INVALID' || res.code === 'PASS_USED') onRestart();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={seg.panel} onSubmit={submit} noValidate>
      <div className={seg.verified}>
        <ShieldCheck size={16} aria-hidden="true" />
        <span>
          <strong>{phoneLabel}</strong> verified
        </span>
        <button type="button" className={seg.verifiedChange} onClick={onRestart}>
          Change
        </button>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="new-password">
          Password
        </label>
        <PasswordInput id="new-password" value={password} onChange={setPassword} placeholder={`At least ${PASSWORD_MIN_LENGTH} characters`} autoComplete="new-password" autoFocus invalid={Boolean(problem)} />
        <div className={seg.meter} data-level={strength} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </div>
        <p className={`${styles.fieldNote} ${problem ? styles.bad : ''}`} aria-live="polite">
          {problem ?? (password ? STRENGTH_LABEL[strength] : `${PASSWORD_MIN_LENGTH}+ characters, with a letter and a number.`)}
        </p>
      </div>

      <div className={styles.inputGroup}>
        <label className={styles.label} htmlFor="confirm-password">
          Confirm password
        </label>
        <PasswordInput id="confirm-password" value={confirm} onChange={setConfirm} placeholder="Type it again" autoComplete="new-password" invalid={mismatch} />
        <p className={`${styles.fieldNote} ${mismatch ? styles.bad : confirm && !mismatch ? styles.ok : ''}`} aria-live="polite">
          {mismatch ? "Passwords don't match." : confirm && confirm === password ? 'Passwords match.' : ' '}
        </p>
      </div>

      {error && <div className={styles.errorBox}>{error}</div>}

      <button type="submit" className={styles.submitBtn} disabled={!ready || busy}>
        {busy ? (
          <span className={styles.loadingSpan}>
            <Loader2 size={15} className={styles.spin} />
            <span>Saving…</span>
          </span>
        ) : (
          submitLabel
        )}
      </button>
    </form>
  );
}

/**
 * The sign-in / sign-up form, shared by the AuthModal pop-up and the
 * /welcome landing page (2026-10-28 flow):
 *   Sign In        — username + password, "Forgot password?"
 *   Create Account — username → phone → SMS code → password + confirm
 *   Creator        — same, plus channel name + link, then the existing
 *                    creator upgrade (POST /api/creator/upgrade)
 *   Forgot         — phone → SMS code → new password + confirm
 * The SMS code only proves the phone; it never signs anyone in by itself.
 */
export function AuthForm({
  mode,
  onModeChange,
  onSignedIn,
  autoFocus = true,
  footer,
  modes = ['login', 'register'],
  segmented = false,
}: {
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
  /** Runs after a successful sign-in or sign-up. */
  onSignedIn?: (res: AuthResult) => void;
  autoFocus?: boolean;
  /** Rendered at the end of the form (e.g. the modal's "Continue Exploring"). */
  footer?: React.ReactNode;
  /** Which tabs to offer. "creator" = normal sign-up + the existing creator upgrade. */
  modes?: AuthMode[];
  /** Pill tabs with a sliding highlight (landing page). */
  segmented?: boolean;
}) {
  const { loginWithPassword, verifyPhoneCode, register, resetPasswordWithPhone, refreshUser } = useAuth();
  const { showToast } = useToast();

  // Sign in
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [forgot, setForgot] = useState(false);

  // Sign up / creator / forgot
  const [username, setUsername] = useState('');
  const [channelName, setChannelName] = useState('');
  const [channelUrl, setChannelUrl] = useState('');
  const [verified, setVerified] = useState<{ pass: string; label: string } | null>(null);
  // Remounts the phone flow (back to the number step).
  const [flowKey, setFlowKey] = useState(0);

  const signingUp = mode === 'register' || mode === 'creator';
  const usernameStatus = useUsernameAvailability(username, signingUp);
  const usernameOk = usernameStatus.kind === 'available';
  const channelError = mode === 'creator' ? channelProblem(channelName, channelUrl) : null;
  const showChannelError = Boolean(channelError && (channelName.trim() || channelUrl.trim()));

  const restartPhone = () => {
    setVerified(null);
    setFlowKey((k) => k + 1);
  };

  const switchMode = (next: AuthMode) => {
    setForgot(false);
    setLoginError(null);
    restartPhone();
    onModeChange(next);
  };

  const onPhoneErrorCode = (code: string) => {
    if (code === 'PHONE_IN_USE' && signingUp) {
      showToast(
        mode === 'creator'
          ? 'That number already has an account. Sign in, then choose "Become a creator" from your menu.'
          : 'That number already has an account. Sign in instead.',
        'info',
        7000,
      );
      switchMode('login');
    } else if (code === 'PHONE_NOT_REGISTERED' && forgot) {
      showToast('No account uses that number. Create an account instead.', 'info', 6000);
      switchMode('register');
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setLoginError(null);
    setSubmitting(true);
    try {
      const res = await loginWithPassword(identifier.trim(), password);
      if (!res.success) {
        setLoginError(res.error || 'Could not sign in.');
        if (res.code === 'NO_PASSWORD') setForgot(true);
      } else {
        showToast('Signed in.', 'success');
        onSignedIn?.(res);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Verifies the SMS code → shows the password panel.
  const verifyCode = (purpose: 'register' | 'reset') => async (phone: string, country: string, code: string): Promise<AuthResult> => {
    const res = await verifyPhoneCode(purpose, phone, country, code);
    if (res.success && res.pass) setVerified({ pass: res.pass, label: phone.trim() });
    return res;
  };

  const createAccount = async (pw: string): Promise<AuthResult> => {
    if (!verified) return { success: false, error: 'Verify your phone first.' };
    const res = await register(username.trim(), pw, verified.pass);
    if (!res.success) return res;
    if (mode !== 'creator') {
      showToast(`Welcome to OTAKUVA, ${username.trim()}!`, 'success');
      onSignedIn?.(res);
      return res;
    }
    // Creator: the account exists now. Turn on creator mode with the same
    // server step /creator uses (POST /api/creator/upgrade).
    let role = res.role;
    try {
      const up = await fetch('/api/creator/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelName: channelName.trim(), channelUrl: channelUrl.trim() || undefined }),
      });
      if (up.ok) {
        role = 'CREATOR';
        await refreshUser();
        showToast(`Welcome to OTAKUVA, ${channelName.trim()}! Creator mode is on.`, 'success');
      } else {
        const data = await up.json().catch(() => ({}));
        showToast(`Your account is ready, but creator mode didn't turn on: ${data.error || 'try "Become a creator" from your menu.'}`, 'error', 8000);
      }
    } catch {
      showToast('Your account is ready, but creator mode didn\'t turn on. Use "Become a creator" from your menu.', 'error', 8000);
    }
    onSignedIn?.({ ...res, role });
    return res;
  };

  const saveNewPassword = async (pw: string): Promise<AuthResult> => {
    if (!verified) return { success: false, error: 'Verify your phone first.' };
    const res = await resetPasswordWithPhone(verified.pass, pw);
    if (res.success) {
      showToast('New password saved. You are signed in.', 'success');
      onSignedIn?.(res);
    }
    return res;
  };

  return (
    <>
      {segmented ? (
        <div className={seg.segment} role="tablist" style={{ ['--count' as string]: modes.length, ['--index' as string]: Math.max(0, modes.indexOf(mode)) }}>
          <span className={seg.thumb} aria-hidden="true" />
          {modes.map((m) => (
            <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? seg.tabOn : seg.tab} onClick={() => (mode !== m || forgot) && switchMode(m)}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.tabs}>
          {modes.map((m) => (
            <button key={m} type="button" className={`${styles.tabBtn} ${mode === m ? styles.tabBtnActive : ''}`} onClick={() => switchMode(m)}>
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      )}

      <div className={styles.form}>
        {mode === 'login' && !forgot && (
          <form className={seg.stack} onSubmit={handleLogin} noValidate>
            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="login-identifier">
                Username
              </label>
              <input
                id="login-identifier"
                type="text"
                className={styles.input}
                placeholder="your_username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus={autoFocus}
              />
            </div>
            <div className={styles.inputGroup}>
              <div className={seg.labelRow}>
                <label className={styles.label} htmlFor="login-password">
                  Password
                </label>
                <button
                  type="button"
                  className={seg.forgotLink}
                  onClick={() => {
                    setForgot(true);
                    setLoginError(null);
                    restartPhone();
                  }}
                >
                  Forgot password?
                </button>
              </div>
              <PasswordInput id="login-password" value={password} onChange={setPassword} placeholder="Your password" autoComplete="current-password" />
            </div>
            {loginError && <div className={styles.errorBox}>{loginError}</div>}
            <button type="submit" className={styles.submitBtn} disabled={submitting || !identifier.trim() || !password}>
              {submitting ? (
                <span className={styles.loadingSpan}>
                  <Loader2 size={15} className={styles.spin} />
                  <span>Signing in…</span>
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        )}

        {mode === 'login' && forgot && (
          <div className={seg.stack}>
            <button
              type="button"
              className={seg.back}
              onClick={() => {
                setForgot(false);
                restartPhone();
              }}
            >
              <ArrowLeft size={14} aria-hidden="true" /> Back to sign in
            </button>
            <div>
              <p className={seg.stepTitle}>Reset your password</p>
              <p className={styles.fieldNote}>We&apos;ll text a code to the number on your account, then you choose a new password.</p>
            </div>
            {!verified ? (
              <PhoneOtpFlow key={`reset-${flowKey}`} purpose="reset" submitLabel="Verify code" autoFocus onSubmitCode={verifyCode('reset')} onErrorCode={onPhoneErrorCode} />
            ) : (
              <PasswordPanel phoneLabel={verified.label} submitLabel="Save password & sign in" onSubmit={saveNewPassword} onRestart={restartPhone} />
            )}
          </div>
        )}

        {signingUp && (
          <>
            <div className={styles.inputGroup}>
              <label className={styles.label} htmlFor="signup-username">
                Username
              </label>
              <div className={styles.inputWithStatus}>
                <input
                  id="signup-username"
                  type="text"
                  className={`${styles.input} ${usernameStatus.kind === 'available' ? styles.inputOk : usernameStatus.kind === 'unavailable' ? styles.inputBad : ''}`}
                  placeholder="e.g. otaku_collector"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  maxLength={USERNAME_MAX_LENGTH}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  aria-describedby="signup-username-status"
                  aria-invalid={usernameStatus.kind === 'unavailable'}
                  autoFocus={autoFocus}
                  disabled={Boolean(verified)}
                />
                <span className={styles.statusIcon} aria-hidden="true">
                  {usernameStatus.kind === 'checking' && <Loader2 size={15} className={styles.spin} />}
                  {usernameStatus.kind === 'available' && <CheckCircle2 size={16} className={styles.ok} />}
                  {usernameStatus.kind === 'unavailable' && <XCircle size={16} className={styles.bad} />}
                </span>
              </div>
              <p
                id="signup-username-status"
                className={`${styles.fieldNote} ${usernameStatus.kind === 'available' ? styles.ok : usernameStatus.kind === 'unavailable' ? styles.bad : ''}`}
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

            {mode === 'creator' && (
              <>
                <div className={styles.inputGroup}>
                  <label className={styles.label} htmlFor="creator-channel-name">
                    Channel name
                  </label>
                  <input
                    id="creator-channel-name"
                    type="text"
                    className={styles.input}
                    placeholder="e.g. Anime Unboxed"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    maxLength={CHANNEL_NAME_MAX}
                    disabled={Boolean(verified)}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <label className={styles.label} htmlFor="creator-channel-url">
                    Channel link
                  </label>
                  <input
                    id="creator-channel-url"
                    type="url"
                    inputMode="url"
                    className={styles.input}
                    placeholder="https://youtube.com/@yourchannel"
                    value={channelUrl}
                    onChange={(e) => setChannelUrl(e.target.value)}
                    maxLength={CHANNEL_URL_MAX}
                    autoCapitalize="none"
                    spellCheck={false}
                    disabled={Boolean(verified)}
                  />
                  <p className={`${styles.fieldNote} ${showChannelError ? styles.bad : ''}`} aria-live="polite">
                    {showChannelError ? channelError : 'YouTube, Instagram, TikTok, X… a full https:// link.'}
                  </p>
                </div>
              </>
            )}

            {!verified ? (
              <PhoneOtpFlow
                key={`${mode}-${flowKey}`}
                purpose="register"
                username={username.trim()}
                canSend={usernameOk && !channelError}
                submitLabel="Verify code"
                onSubmitCode={verifyCode('register')}
                onErrorCode={onPhoneErrorCode}
              />
            ) : (
              <PasswordPanel
                phoneLabel={verified.label}
                username={username.trim()}
                submitLabel={mode === 'creator' ? 'Join as creator' : 'Create Account'}
                onSubmit={createAccount}
                onRestart={restartPhone}
              />
            )}
          </>
        )}
        {footer}
      </div>
    </>
  );
}
