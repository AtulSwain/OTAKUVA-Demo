'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FolderPlus, Globe, Link2, Lock, Plus } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { LibrarySwitch } from '../../../components/lists/LibrarySwitch';
import { ListCover } from '../../../components/lists/ListCover';
import { EmptyState } from '../../../components/ui/EmptyState';
import styles from '../../../components/lists/lists.module.css';

interface MyList {
  id: string;
  name: string;
  description: string | null;
  visibility: 'PRIVATE' | 'LINK' | 'PUBLIC';
  count: number;
  covers: string[];
  updatedAt: string;
}

const VIS = {
  PRIVATE: { icon: Lock, label: 'Private' },
  LINK: { icon: Link2, label: 'Shared by link' },
  PUBLIC: { icon: Globe, label: 'Public' },
} as const;

export default function MyListsPage() {
  const { user, isLoading: authLoading, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const [lists, setLists] = useState<MyList[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    fetch('/api/lists?mine=1')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => !cancelled && setLists(d.lists || []))
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setLists([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, authLoading]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error);
      setLists((prev) => [data.list, ...(prev ?? [])]);
      setName('');
      setCreating(false);
    } catch (err: any) {
      showToast(err?.message || "Couldn't create the list", 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>My Library</h1>
      </header>
      <LibrarySwitch />

      {!authLoading && !user ? (
        <EmptyState
          icon={FolderPlus}
          title="Sign in to make lists"
          description="Group anime into your own folders — “Horror to watch”, “Comfort shows”, “For my sister” — and share them by link."
          actionLabel="Sign in"
          onAction={() => openAuthModal('login')}
        />
      ) : (
        <>
          <div className={styles.toolbar}>
            <span className={styles.toolbarCount}>
              {lists ? `${lists.length} ${lists.length === 1 ? 'list' : 'lists'}` : ''}
            </span>
            {creating ? (
              <form className={styles.inlineCreate} onSubmit={create}>
                <input
                  ref={inputRef}
                  className={styles.input}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="List name"
                  maxLength={60}
                  aria-label="New list name"
                />
                <button type="submit" className={styles.primaryBtn} disabled={!name.trim() || saving}>
                  {saving ? 'Creating…' : 'Create'}
                </button>
                <button type="button" className={styles.ghostBtn} onClick={() => setCreating(false)}>
                  Cancel
                </button>
              </form>
            ) : (
              <button type="button" className={styles.primaryBtn} onClick={() => setCreating(true)}>
                <Plus size={16} aria-hidden="true" /> New list
              </button>
            )}
          </div>

          {lists === null ? (
            <div className={styles.folderGrid} aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className={styles.folderSkeleton} />
              ))}
            </div>
          ) : lists.length === 0 ? (
            <EmptyState
              icon={FolderPlus}
              title={failed ? "Couldn't load your lists" : 'No lists yet'}
              description={
                failed
                  ? 'Please try again in a moment.'
                  : 'Create one here, or use “Add to a list…” from any anime page’s Add to Library menu.'
              }
              actionLabel={failed ? undefined : 'Create your first list'}
              onAction={failed ? undefined : () => setCreating(true)}
            />
          ) : (
            <div className={styles.folderGrid}>
              {lists.map((l) => {
                const v = VIS[l.visibility] || VIS.PRIVATE;
                const Icon = v.icon;
                return (
                  <Link key={l.id} href={`/library/lists/${l.id}`} className={styles.folder}>
                    <ListCover covers={l.covers} />
                    <div className={styles.folderInfo}>
                      <strong className={styles.folderName}>{l.name}</strong>
                      <span className={styles.folderMeta}>
                        {l.count} anime · <Icon size={12} aria-hidden="true" /> {v.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
