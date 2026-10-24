'use client';

import React, { useEffect, useState } from 'react';
import { Search, X, Check } from 'lucide-react';
import styles from './CommunityTopicPicker.module.css';

export interface TopicAnime {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  year?: number | null;
}

export interface TopicGenre {
  id: string;
  name: string;
  slug: string;
  animeCount?: number;
}

/** Mirrors COMMUNITY_GENRES_MAX in src/lib/engine/community/communityEngine.ts (the server enforces it). */
export const TOPIC_GENRES_MAX = 5;

let genreCache: Promise<TopicGenre[]> | null = null;
function loadGenres(): Promise<TopicGenre[]> {
  genreCache ??= fetch('/api/genres')
    .then((r) => (r.ok ? r.json() : { genres: [] }))
    .then((d) => (d.genres || []) as TopicGenre[])
    .catch(() => {
      genreCache = null;
      return [];
    });
  return genreCache;
}

/**
 * "What is this community about?" — an optional anime plus up to five genres.
 * These links are what put a community on the matching anime pages (and on
 * every anime page in those genres), so it's asked for when the community is
 * created and can be changed in its settings.
 */
export function CommunityTopicPicker({
  anime,
  onAnimeChange,
  genreIds,
  onGenresChange,
  showAnime = true,
}: {
  anime: TopicAnime | null;
  onAnimeChange: (a: TopicAnime | null) => void;
  genreIds: string[];
  onGenresChange: (ids: string[]) => void;
  showAnime?: boolean;
}) {
  const [genres, setGenres] = useState<TopicGenre[]>([]);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TopicAnime[]>([]);

  useEffect(() => {
    loadGenres().then(setGenres);
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setResults((d?.anime || []).slice(0, 6)))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const pickAnime = async (a: TopicAnime) => {
    onAnimeChange(a);
    setQuery('');
    setResults([]);
    // Start from the anime's own genres when none are chosen yet — shown as
    // selected chips, so the owner sees and can change them before saving.
    if (genreIds.length > 0) return;
    try {
      const [res, all] = await Promise.all([fetch(`/api/anime/${encodeURIComponent(a.slug)}`), loadGenres()]);
      const data = res.ok ? await res.json() : null;
      const names: string[] = Array.isArray(data?.anime?.genres) ? data.anime.genres : [];
      const ids = all.filter((g) => names.includes(g.name)).map((g) => g.id).slice(0, TOPIC_GENRES_MAX);
      if (ids.length) onGenresChange(ids);
    } catch {
      /* genres stay as they are */
    }
  };

  const toggleGenre = (id: string) => {
    if (genreIds.includes(id)) onGenresChange(genreIds.filter((g) => g !== id));
    else if (genreIds.length < TOPIC_GENRES_MAX) onGenresChange([...genreIds, id]);
  };

  return (
    <div className={styles.picker}>
      {showAnime && (
        <div className={styles.block}>
          <span className={styles.label}>Anime (optional)</span>
          <span className={styles.help}>Link the show this community is about. It will appear on that anime&apos;s page.</span>
          {anime ? (
            <div className={styles.picked}>
              {anime.posterUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={anime.posterUrl} alt="" />
              )}
              <span>{anime.title}</span>
              <button type="button" className={styles.iconBtn} onClick={() => onAnimeChange(null)} aria-label="Unlink anime">
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className={styles.search}>
              <Search size={15} aria-hidden="true" className={styles.searchIcon} />
              <input
                className={styles.input}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search for an anime, e.g. Vinland Saga"
                aria-label="Search for an anime"
              />
              {results.length > 0 && (
                <ul className={styles.results} role="listbox">
                  {results.map((a) => (
                    <li key={a.id}>
                      <button type="button" onClick={() => pickAnime(a)}>
                        {a.posterUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.posterUrl} alt="" />
                        )}
                        <span>{a.title}</span>
                        {a.year && <small>{a.year}</small>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      <div className={styles.block}>
        <span className={styles.label}>
          Genres <span className={styles.count}>{genreIds.length}/{TOPIC_GENRES_MAX}</span>
        </span>
        <span className={styles.help}>Fans watching anything in these genres will see this community suggested.</span>
        <div className={styles.chips} role="group" aria-label="Genres">
          {genres.map((g) => {
            const on = genreIds.includes(g.id);
            const full = !on && genreIds.length >= TOPIC_GENRES_MAX;
            return (
              <button
                key={g.id}
                type="button"
                className={`${styles.chip} ${on ? styles.chipOn : ''}`}
                aria-pressed={on}
                disabled={full}
                onClick={() => toggleGenre(g.id)}
              >
                {on && <Check size={13} aria-hidden="true" />}
                {g.name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
