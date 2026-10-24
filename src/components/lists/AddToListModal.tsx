'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, FolderPlus, Globe, Link2, Lock, Plus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAnimeLists } from './useAnimeLists';
import styles from './AddToListModal.module.css';

interface AddToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Anime id or slug. */
  animeId: string;
  animeTitle: string;
}

const VIS_ICON = { PRIVATE: Lock, LINK: Link2, PUBLIC: Globe } as const;
const VIS_LABEL = { PRIVATE: 'Private', LINK: 'Anyone with the link', PUBLIC: 'Public' } as const;

/**
 * "Add to list" picker: tick the lists this anime belongs in, or create a new
 * one with it already inside. Each tick saves immediately (and rolls back if
 * the server refuses). List logic lives in useAnimeLists, shared with the
 * anime page's Add to Library menu.
 */
export function AddToListModal({ isOpen, onClose, animeId, animeTitle }: AddToListModalProps) {
  const { user, openAuthModal } = useAuth();
  const { lists, error, busyId, creating: savingNew, load, toggle, create } = useAnimeLists(animeId, animeTitle);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCreating(false);
    setNewName('');
    if (user) load();
  }, [isOpen, user, load]);

  // Escape closes; the page behind doesn't scroll while the sheet is open.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  if (!isOpen) return null;

  const createWithAnime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await create(newName)) {
      setCreating(false);
      setNewName('');
    }
  };

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="add-to-list-title">
        <div className={styles.grabber} aria-hidden="true" />
        <header className={styles.header}>
          <div>
            <h2 id="add-to-list-title" className={styles.title}>Add to list</h2>
            <p className={styles.subtitle}>{animeTitle}</p>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        {!user ? (
          <div className={styles.signIn}>
            <p>Sign in to make your own lists — like playlists, but for anime.</p>
            <button
              type="button"
              className={styles.primaryBtn}
              onClick={() => {
                onClose();
                openAuthModal('login');
              }}
            >
              Sign in
            </button>
          </div>
        ) : (
          <>
            <div className={styles.body}>
              {creating ? (
                <form className={styles.createRow} onSubmit={createWithAnime}>
                  <input
                    ref={inputRef}
                    className={styles.input}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="List name, e.g. Horror to watch"
                    maxLength={60}
                    aria-label="New list name"
                  />
                  <button type="submit" className={styles.primaryBtn} disabled={!newName.trim() || savingNew}>
                    {savingNew ? 'Creating…' : 'Create'}
                  </button>
                </form>
              ) : (
                <button type="button" className={styles.newRow} onClick={() => setCreating(true)}>
                  <span className={styles.newIcon}>
                    <Plus size={20} />
                  </span>
                  <span className={styles.rowText}>
                    <strong>New list</strong>
                    <span>Starts with {animeTitle}</span>
                  </span>
                </button>
              )}

              {lists === null ? (
                <div className={styles.loading}>Loading your lists…</div>
              ) : error ? (
                <div className={styles.loading}>{error}</div>
              ) : lists.length === 0 && !creating ? (
                <div className={styles.emptyHint}>
                  <FolderPlus size={22} aria-hidden="true" />
                  <span>You don&apos;t have any lists yet. Make one for a mood, a genre, or a weekend.</span>
                </div>
              ) : (
                <ul className={styles.listRows}>
                  {lists.map((l) => {
                    const Icon = VIS_ICON[l.visibility] || Lock;
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          className={styles.listRow}
                          onClick={() => toggle(l)}
                          aria-pressed={Boolean(l.containsAnime)}
                          disabled={busyId === l.id}
                        >
                          <span className={styles.cover}>
                            {l.covers[0] ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={l.covers[0]} alt="" loading="lazy" />
                            ) : (
                              <FolderPlus size={18} aria-hidden="true" />
                            )}
                          </span>
                          <span className={styles.rowText}>
                            <strong>{l.name}</strong>
                            <span>
                              <Icon size={12} aria-hidden="true" /> {VIS_LABEL[l.visibility]} · {l.count} anime
                            </span>
                          </span>
                          <span className={`${styles.tick} ${l.containsAnime ? styles.tickOn : ''}`} aria-hidden="true">
                            {l.containsAnime && <Check size={14} strokeWidth={3} />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
            <footer className={styles.footer}>
              <Link href="/library/lists" className={styles.manageLink} onClick={onClose}>
                Manage lists
              </Link>
              <button type="button" className={styles.doneBtn} onClick={onClose}>
                Done
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
