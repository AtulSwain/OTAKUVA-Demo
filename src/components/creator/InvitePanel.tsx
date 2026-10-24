'use client';

/**
 * Members-only invitations for one community (Creator Mode, 2026-10-24).
 * The access key is only ever visible right after it's issued or rotated
 * (the server stores a hash); after that the owner sees its last 4 chars.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Check, RefreshCw, Ban, Plus, Link2, KeyRound } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import styles from '../../app/creator/creator.module.css';

export interface InvitationView {
  id: string;
  path: string;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'USED_UP';
  keyHint: string | null;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

export const fullInviteUrl = (path: string) => (typeof window === 'undefined' ? path : `${window.location.origin}${path}`);

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  const { showToast } = useToast();
  return (
    <button
      type="button"
      className={`${styles.btn} ${styles.btnSm}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          showToast('Copy failed — select the text and copy it instead.', 'error');
        }
      }}
    >
      {done ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />} {done ? 'Copied' : label}
    </button>
  );
}

/** The link + key, side by side, each with its own copy button. */
export function InviteCredentials({ path, accessKey, communityName }: { path: string; accessKey: string; communityName?: string }) {
  const url = fullInviteUrl(path);
  return (
    <div className={styles.secretBox}>
      {communityName && <strong>{communityName}</strong>}
      <div className={styles.secretRow}>
        <span className={styles.secretLabel}>
          <Link2 size={12} aria-hidden="true" /> Link
        </span>
        <code className={styles.secretValue}>{url}</code>
        <CopyButton value={url} label="Copy link" />
      </div>
      <div className={styles.secretRow}>
        <span className={styles.secretLabel}>
          <KeyRound size={12} aria-hidden="true" /> Key
        </span>
        <code className={styles.secretValue}>{accessKey}</code>
        <CopyButton value={accessKey} label="Copy key" />
      </div>
      <p className={styles.warn}>
        Save the key now — for security it isn&apos;t shown again (you can always rotate it). Share the link and the key
        together, through your members-only channel.
      </p>
    </div>
  );
}

const STATUS_LABEL: Record<InvitationView['status'], string> = { ACTIVE: 'Active', REVOKED: 'Revoked', EXPIRED: 'Expired', USED_UP: 'Used up' };

export function InvitePanel({ slug, communityName }: { slug: string; communityName: string }) {
  const { showToast } = useToast();
  const [items, setItems] = useState<InvitationView[] | null>(null);
  const [fresh, setFresh] = useState<{ path: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState('');
  const [maxUses, setMaxUses] = useState('');

  const load = useCallback(async () => {
    const r = await fetch(`/api/communities/${encodeURIComponent(slug)}/invitations`, { cache: 'no-store' });
    const d = await r.json().catch(() => ({}));
    if (r.ok) setItems(d.invitations);
    else showToast(d.error || 'Could not load invitations.', 'error');
  }, [slug, showToast]);
  useEffect(() => {
    load();
  }, [load]);

  const call = async (url: string, method: string, body?: object) => {
    setBusy(true);
    try {
      const r = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Something went wrong.');
      return d;
    } catch (err) {
      showToast((err as Error).message, 'error');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const base = `/api/communities/${encodeURIComponent(slug)}/invitations`;
  const create = async () => {
    const expiresAt = days ? new Date(Date.now() + Number(days) * 86400000).toISOString() : undefined;
    const d = await call(base, 'POST', { expiresAt, maxUses: maxUses || undefined });
    if (d) {
      setFresh({ path: d.invitation.path, key: d.key });
      setDays('');
      setMaxUses('');
      load();
    }
  };
  const rotate = async (inv: InvitationView) => {
    if (!window.confirm('Make a new key for this link? The current key stops working immediately.')) return;
    const d = await call(`${base}/${inv.id}/rotate`, 'POST');
    if (d) {
      setFresh({ path: d.invitation.path, key: d.key });
      load();
    }
  };
  const revoke = async (inv: InvitationView) => {
    if (!window.confirm('Revoke this invitation? Nobody new can join with it. Current members stay.')) return;
    if (await call(`${base}/${inv.id}`, 'DELETE')) {
      showToast('Invitation revoked', 'success');
      if (fresh?.path === inv.path) setFresh(null);
      load();
    }
  };

  return (
    <section className={styles.card} aria-label="Invitations">
      <div className={styles.sectionHead}>
        <h2 className={styles.cardTitle}>Invitations</h2>
        <span className={styles.small}>People need the link and the key</span>
      </div>

      {fresh && <InviteCredentials path={fresh.path} accessKey={fresh.key} communityName={communityName} />}

      {items === null ? (
        <p className={styles.muted}>Loading…</p>
      ) : items.length === 0 ? (
        <p className={styles.muted}>No invitations yet.</p>
      ) : (
        <ul className={styles.list}>
          {items.map((inv) => (
            <li key={inv.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>
                  <span className={`${styles.pill} ${inv.status === 'ACTIVE' ? styles.pillGood : styles.pillBad}`}>{STATUS_LABEL[inv.status]}</span>{' '}
                  Key ending {inv.keyHint ?? '····'}
                </span>
                <span className={styles.small}>
                  {inv.uses}
                  {inv.maxUses != null ? ` of ${inv.maxUses}` : ''} joined
                  {inv.expiresAt && ` · expires ${new Date(inv.expiresAt).toLocaleDateString()}`}
                  {` · created ${new Date(inv.createdAt).toLocaleDateString()}`}
                </span>
              </div>
              <div className={styles.rowActions}>
                <CopyButton value={fullInviteUrl(inv.path)} label="Copy link" />
                {inv.status !== 'REVOKED' && (
                  <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => rotate(inv)} disabled={busy}>
                    <RefreshCw size={14} aria-hidden="true" /> New key
                  </button>
                )}
                {inv.status !== 'REVOKED' && (
                  <button type="button" className={`${styles.btnDanger} ${styles.btnSm}`} onClick={() => revoke(inv)} disabled={busy}>
                    <Ban size={14} aria-hidden="true" /> Revoke
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className={styles.form} style={{ marginTop: 16 }}>
        <div className={styles.formRow}>
          <label className={styles.field}>
            <span className={styles.label}>Expires after (days, optional)</span>
            <input className={styles.input} type="number" min={1} max={365} value={days} onChange={(e) => setDays(e.target.value)} placeholder="Never" />
          </label>
          <label className={styles.field}>
            <span className={styles.label}>Max people (optional)</span>
            <input className={styles.input} type="number" min={1} value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder="No limit" />
          </label>
        </div>
        <div className={styles.actionsRow}>
          <button type="button" className={styles.btnPrimary} onClick={create} disabled={busy}>
            <Plus size={15} aria-hidden="true" /> New invitation
          </button>
        </div>
      </div>
    </section>
  );
}
