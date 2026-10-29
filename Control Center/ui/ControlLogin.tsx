'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import styles from './control.module.css';

const CONTROL_ROLES = ['ADMIN', 'SUPER_ADMIN'];

/** Control-center sign-in: the special admin username + password. */
export function ControlLogin({ signedInAs }: { signedInAs: string | null }) {
  const router = useRouter();
  const { loginWithPassword, logout } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const res = await loginWithPassword(username.trim(), password);
      if (!res.success) {
        setError(res.error || 'Could not sign in.');
        return;
      }
      if (!res.role || !CONTROL_ROLES.includes(res.role)) {
        setError("This account doesn't have control-center access.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className={styles.loginPage}>
      <form className={styles.loginCard} onSubmit={submit} noValidate>
        <div className={styles.loginBrand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/otakuva-mark.png" alt="" width={40} height={31} />
          <span>OTAKUVA</span>
          <span className={styles.loginTag}>
            <Lock size={12} aria-hidden="true" /> Control center
          </span>
        </div>
        <h1 className={styles.loginTitle}>Sign in to the control center</h1>
        {signedInAs && (
          <p className={styles.loginNote}>
            You&apos;re signed in as <strong>@{signedInAs}</strong>, which has no access here.{' '}
            <button type="button" className={styles.linkBtn} onClick={() => void logout()}>
              Sign out
            </button>
          </p>
        )}
        <label className={styles.fieldLabel} htmlFor="control-username">
          Username
        </label>
        <input
          id="control-username"
          className={styles.input}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
        />
        <label className={styles.fieldLabel} htmlFor="control-password">
          Password
        </label>
        <div className={styles.pwWrap}>
          <input
            id="control-password"
            className={styles.input}
            type={shown ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          <button type="button" className={styles.eye} onClick={() => setShown((s) => !s)} aria-label={shown ? 'Hide password' : 'Show password'}>
            {shown ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        <button type="submit" className={styles.primary} disabled={busy || !username.trim() || !password}>
          {busy ? <Loader2 size={16} className={styles.spin} /> : 'Enter control center'}
        </button>
      </form>
    </main>
  );
}
