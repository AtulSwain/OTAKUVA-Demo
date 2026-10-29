'use client';

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search } from 'lucide-react';
import { ROLES } from '@/lib/roles';
import styles from '../control.module.css';

type U = {
  id: string;
  username: string;
  displayName: string | null;
  role: string;
  createdAt: string;
  lastSeenAt: string | null;
  lastLoginAt: string | null;
  phoneVerified: boolean;
  hasPassword: boolean;
  avatarUrl: string | null;
  creatorChannelName: string | null;
  reviews: number;
  ratedAnime: number;
};

const fmt = new Intl.NumberFormat('en-US');
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function ago(iso: string | null) {
  if (!iso) return 'never';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return day.format(new Date(iso));
}

function UsersControl() {
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [role, setRole] = useState(params?.get('role') || '');
  const [sort, setSort] = useState(params?.get('sort') || 'recent');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<U[]>([]);
  const [total, setTotal] = useState(0);
  const [canChange, setCanChange] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const sp = new URLSearchParams({ page: String(page), sort });
    if (q.trim()) sp.set('q', q.trim());
    if (role) sp.set('role', role);
    try {
      const res = await fetch(`/api/control/users?${sp}`);
      const d = await res.json();
      setRows(d.users || []);
      setTotal(d.total || 0);
      setCanChange(Boolean(d.canChangeRoles));
    } finally {
      setLoading(false);
    }
  }, [q, role, sort, page]);

  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  const changeRole = async (u: U, next: string) => {
    if (next === u.role) return;
    if (!window.confirm(`Change @${u.username} from ${u.role} to ${next}?`)) return;
    setMsg(null);
    const res = await fetch(`/api/admin/users/${u.id}/role`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: next }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(out.error || 'Could not change the role.');
    else {
      setMsg(`@${u.username} is now ${next}.`);
      void load();
    }
  };

  const pages = Math.max(1, Math.ceil(total / 30));

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.kicker}>People</p>
        <h1 className={styles.title}>Users</h1>
      </header>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search username or name" aria-label="Search users" />
        </label>
        <select className={styles.select} value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} aria-label="Role">
          <option value="">All roles</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r.replace('_', ' ')}
            </option>
          ))}
        </select>
        <div className={styles.chips}>
          {[
            ['recent', 'Newest'],
            ['active', 'Recently active'],
            ['name', 'A–Z'],
          ].map(([v, l]) => (
            <button key={v} type="button" className={sort === v ? styles.chipOn : styles.chip} onClick={() => { setSort(v); setPage(1); }}>
              {l}
            </button>
          ))}
        </div>
      </div>
      <p className={styles.caption}>{loading ? 'Loading…' : `${fmt.format(total)} members`}</p>
      {msg && <p className={styles.okMsg}>{msg}</p>}

      <ul className={styles.list}>
        {rows.map((u) => (
          <li key={u.id} className={styles.userRow}>
            <span className={styles.avatar}>
              {u.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={u.avatarUrl} alt="" />
              ) : (
                u.username[0]?.toUpperCase()
              )}
            </span>
            <span className={styles.rowText}>
              <Link href={`/profile/${u.username}`} target="_blank" className={styles.cardName}>
                {u.displayName || u.username} <small>@{u.username}</small>
              </Link>
              <span>
                Joined {day.format(new Date(u.createdAt))} · Last seen {ago(u.lastSeenAt)}
                {u.creatorChannelName ? ` · ${u.creatorChannelName}` : ''}
              </span>
              <span className={styles.tags}>
                <em className={u.phoneVerified ? styles.badge : styles.miss}>{u.phoneVerified ? 'Phone verified' : 'No phone'}</em>
                <em className={u.hasPassword ? styles.badge : styles.miss}>{u.hasPassword ? 'Password set' : 'No password'}</em>
                <em className={styles.badge}>
                  {u.reviews} reviews · {u.ratedAnime} rated
                </em>
              </span>
            </span>
            {canChange ? (
              <select className={styles.select} value={u.role} onChange={(e) => void changeRole(u, e.target.value)} aria-label={`Role for ${u.username}`}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replace('_', ' ')}
                  </option>
                ))}
              </select>
            ) : (
              <span className={styles.roleTag}>{u.role.replace('_', ' ')}</span>
            )}
          </li>
        ))}
      </ul>

      {pages > 1 && (
        <nav className={styles.pager} aria-label="Pages">
          <button type="button" className={styles.secondary} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {page} of {fmt.format(pages)}
          </span>
          <button type="button" className={styles.secondary} disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </nav>
      )}
    </div>
  );
}

export default function ControlUsersPage() {
  return (
    <Suspense fallback={null}>
      <UsersControl />
    </Suspense>
  );
}
