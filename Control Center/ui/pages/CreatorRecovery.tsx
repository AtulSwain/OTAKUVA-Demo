'use client';

import { useState } from 'react';
import { ChevronDown, KeyRound, ShieldCheck } from 'lucide-react';
import styles from '../control.module.css';

export function CreatorRecovery({ id }: { id: string }) {
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [data, setData] = useState<any>(null); const [msg, setMsg] = useState('');
  const toggle = async () => { setOpen((v) => !v); if (!data) { const r = await fetch(`/api/control/creators/${id}`); const out = await r.json(); setData(out.creator); } };
  const reset = async () => { setBusy(true); setMsg(''); const r = await fetch(`/api/control/creators/${id}`, { method: 'POST' }); const out = await r.json(); setMsg(out.message || out.error || 'Done.'); setBusy(false); };
  return <div className={styles.recovery}><button type="button" className={styles.secondary} onClick={() => void toggle()} aria-expanded={open}><ChevronDown size={15} /> {open ? 'Hide account' : 'Account & recovery'}</button>{open && <div className={styles.recoveryPanel}><div className={styles.recoveryGrid}>{[['Username', data?.username], ['Email', data?.email || 'Not on file'], ['Phone', data?.phone ? 'Verified phone on file' : 'No phone'], ['Password', data?.hasPassword ? 'Set (never viewable)' : 'Not set'], ['Last login', data?.lastLoginAt ? new Date(data.lastLoginAt).toLocaleString() : 'Never'], ['Last seen', data?.lastSeenAt ? new Date(data.lastSeenAt).toLocaleString() : 'Never']].map(([label, value]) => <div className={styles.recoveryItem} key={String(label)}><span>{label}</span><strong>{String(value ?? 'Loading…')}</strong></div>)}</div><p className={styles.caption}><ShieldCheck size={13} /> Passwords are one-way hashes and are never exposed. Recovery issues a single-use, 1-hour reset link.</p><button type="button" className={styles.primary} disabled={busy || !data?.email} onClick={() => void reset()}><KeyRound size={15} /> {busy ? 'Sending…' : 'Send secure reset link'}</button>{msg && <p className={styles.okMsg}>{msg}</p>}</div>}</div>;
}
