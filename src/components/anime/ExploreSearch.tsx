'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { CommunityScoreBadge } from '../rating/CommunityScoreBadge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Clock, Search, X } from 'lucide-react';
import { AnimeImage } from './AnimeImage';
import styles from './ExploreSearch.module.css';

interface Suggestion {
  id: string;
  slug: string;
  title: string;
  posterImage?: string | null;
  type?: string | null;
  year?: number | null;
  score?: number | null;
}

const RECENT_KEY = 'otakuva_recent_searches';
const MAX_RECENT = 6;

function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((s) => typeof s === 'string').slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* private mode / blocked storage: recent searches just aren't kept */
  }
}

/**
 * Explore's search field: live title suggestions while typing (jump straight
 * to an anime), recent searches + popular genres when empty, keyboard
 * friendly (/ to focus, ↑↓ to move, Enter, Esc). The catalog grid below
 * follows `value` (debounced by the parent).
 */
export function ExploreSearch({
  value,
  onChange,
  onCommit,
  genres,
  onPickGenre,
  total,
}: {
  value: string;
  onChange: (v: string) => void;
  /** Enter / "See all results": the query is final (saved to recent searches). */
  onCommit: (v: string) => void;
  genres: string[];
  onPickGenre: (g: string) => void;
  /** Total results for the current query, when known. */
  total: number | null;
}) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => setRecent(readRecent()), []);

  // "/" focuses the search from anywhere on the page (not while typing elsewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Close when clicking outside.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Live suggestions (debounced).
  const q = value.trim();
  useEffect(() => {
    setActive(-1);
    if (q.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/anime?q=${encodeURIComponent(q)}&limit=6&sortBy=popularity`, { signal: ctrl.signal });
        if (res.ok) {
          const data = await res.json();
          setSuggestions((data.animes || []) as Suggestion[]);
        }
      } catch {
        /* aborted or offline: keep the last list */
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const commit = (text: string) => {
    const v = text.trim();
    if (v) {
      const next = [v, ...recent.filter((r) => r.toLowerCase() !== v.toLowerCase())].slice(0, MAX_RECENT);
      setRecent(next);
      writeRecent(next);
    }
    onCommit(v);
    setOpen(false);
    inputRef.current?.blur();
  };

  const removeRecent = (r: string) => {
    const next = recent.filter((x) => x !== r);
    setRecent(next);
    writeRecent(next);
  };

  const showSuggestions = q.length >= 2;
  const items = showSuggestions ? suggestions : [];

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % items.length);
    } else if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault();
      setActive((i) => (i <= 0 ? items.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active >= 0 && items[active]) {
        commit(value);
        router.push(`/anime/${items[active].slug || items[active].id}`);
      } else commit(value);
    } else if (e.key === 'Escape') {
      if (open) setOpen(false);
      else if (value) onChange('');
    }
  };

  return (
    <div className={styles.wrap} ref={boxRef}>
      <div className={`${styles.field} ${open ? styles.fieldOpen : ''}`}>
        <Search size={18} className={styles.icon} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          className={styles.input}
          placeholder="Search anime titles…"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label="Search the anime catalog"
          autoComplete="off"
          spellCheck={false}
        />
        {value ? (
          <button
            type="button"
            className={styles.clear}
            onClick={() => {
              onChange('');
              onCommit('');
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
          >
            <X size={15} />
          </button>
        ) : (
          <kbd className={styles.kbd} aria-hidden="true">
            /
          </kbd>
        )}
      </div>

      {open && (
        <div className={styles.panel} id={listId} role="listbox" aria-label="Search suggestions">
          {showSuggestions ? (
            <>
              {loading && items.length === 0 && <p className={styles.hint}>Searching…</p>}
              {!loading && items.length === 0 && <p className={styles.hint}>No titles match “{q}”. Try another spelling or a Japanese name.</p>}
              {items.map((s, i) => (
                <Link
                  key={s.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  href={`/anime/${s.slug || s.id}`}
                  className={`${styles.option} ${i === active ? styles.optionActive : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(value)}
                >
                  <span className={styles.thumb}>
                    <AnimeImage src={s.posterImage} alt="" fill sizes="40px" />
                  </span>
                  <span className={styles.optionText}>
                    <strong>{s.title}</strong>
                    <span>{[s.type, s.year].filter(Boolean).join(' · ')}</span>
                  </span>
                  <CommunityScoreBadge animeId={s.id} />
                </Link>
              ))}
              <button type="button" className={styles.seeAll} onClick={() => commit(value)}>
                <span>
                  See all results for “{q}”{total !== null ? ` · ${total.toLocaleString('en-US')}` : ''}
                </span>
                <ArrowRight size={14} aria-hidden="true" />
              </button>
            </>
          ) : (
            <>
              {recent.length > 0 && (
                <div className={styles.group}>
                  <div className={styles.groupHead}>
                    <span>Recent searches</span>
                    <button
                      type="button"
                      onClick={() => {
                        setRecent([]);
                        writeRecent([]);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                  <ul className={styles.recentList}>
                    {recent.map((r) => (
                      <li key={r}>
                        <button
                          type="button"
                          className={styles.recent}
                          onClick={() => {
                            onChange(r);
                            commit(r);
                          }}
                        >
                          <Clock size={13} aria-hidden="true" /> {r}
                        </button>
                        <button type="button" className={styles.recentRemove} onClick={() => removeRecent(r)} aria-label={`Remove ${r} from recent searches`}>
                          <X size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className={styles.group}>
                <div className={styles.groupHead}>
                  <span>Popular genres</span>
                </div>
                <div className={styles.genreChips}>
                  {genres.map((g) => (
                    <button
                      key={g}
                      type="button"
                      className={styles.genreChip}
                      onClick={() => {
                        onPickGenre(g);
                        setOpen(false);
                      }}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <p className={styles.tip}>
                Tip: press <kbd>/</kbd> to search, <kbd>↑</kbd> <kbd>↓</kbd> to pick a title, <kbd>Esc</kbd> to close.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
