'use client';

/**
 * /community/invite/:id — joining a members-only community (Creator Mode,
 * 2026-10-24). Shows only whether the invitation is active and the
 * community's name; never its posts, members or settings. Signed-out
 * visitors sign in right here (the page stays put, then they continue).
 * The key is checked on the server (POST /api/invite/:id/join).
 */
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { promptPhoneVerification } from '../../../../components/auth/VerifyPhonePrompt';
import styles from '../../../creator/creator.module.css';

type Preview = { status: 'ACTIVE'; community: { name: string; iconUrl: string | null } } | { status: 'INACTIVE' };

export default function InvitePage({ params }: { params: { id: string } }) {
  const { user, openAuthModalWithIntent } = useAuth();
  const router = useRouter();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invite/${encodeURIComponent(params.id)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(setPreview)
      .catch(() => setPreview({ status: 'INACTIVE' }));
  }, [params.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      openAuthModalWithIntent({ type: 'CUSTOM', description: 'join a members-only community' }, 'Sign in to join this members-only community.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/invite/${encodeURIComponent(params.id)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (d.code === 'PHONE_NOT_VERIFIED') return promptPhoneVerification('rate');
        if (r.status === 410) setPreview({ status: 'INACTIVE' });
        throw new Error(d.error || 'Could not join.');
      }
      router.push(`/community/${d.slug}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!preview) return <div className={`${styles.page} ${styles.narrow}`}><p className={styles.muted}>Checking the invitation…</p></div>;

  if (preview.status !== 'ACTIVE') {
    return (
      <div className={`${styles.page} ${styles.narrow}`}>
        <section className={styles.card}>
          <div className={styles.empty}>
            <Lock size={28} aria-hidden="true" />
            <h1 className={styles.cardTitle}>This invitation isn&apos;t active</h1>
            <p className={styles.muted}>It may have been revoked, expired or used up. Ask the creator for a new link and key.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${styles.narrow}`}>
      <section className={styles.card}>
        <div className={styles.form}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className={styles.mark} aria-hidden="true">
              {preview.community.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.community.iconUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
              ) : (
                preview.community.name.charAt(0).toUpperCase()
              )}
            </span>
            <div>
              <p className={styles.small} style={{ margin: 0 }}>
                <Lock size={11} aria-hidden="true" /> Members-only community
              </p>
              <h1 className={styles.cardTitle} style={{ margin: 0 }}>
                {preview.community.name}
              </h1>
            </div>
          </div>
          <p className={styles.muted}>You&apos;ve been invited. Enter the access key the creator shared with you to join.</p>

          <form className={styles.form} onSubmit={submit}>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <label className={styles.field}>
              <span className={styles.label}>
                <KeyRound size={12} aria-hidden="true" /> Access key
              </span>
              <input
                className={styles.input}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                required
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', letterSpacing: '0.04em' }}
              />
            </label>
            <div className={styles.actionsRow}>
              <button type="submit" className={styles.btnPrimary} disabled={busy || !key.trim()}>
                {busy ? <Loader2 size={15} aria-hidden="true" /> : null}
                {user ? 'Join community' : 'Sign in to join'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
