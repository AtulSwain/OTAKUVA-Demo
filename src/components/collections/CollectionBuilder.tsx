'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe2, Lock, Plus, Search, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { AnimeImage } from '../anime/AnimeImage';
import { BannerPicker, type BannerChoice } from './BannerPicker';
import styles from './Collections.module.css';

interface PickedAnime {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  bannerUrl: string | null;
  year?: number | null;
  type?: string | null;
}

const isWide = (u?: string | null) => typeof u === 'string' && /\/banner\//.test(u);

/**
 * "Make a collection" (2026-10-22): banner, name, description, Public /
 * Private, and the anime in it (starts with ?anime=<slug> from the anime
 * page). Saves through POST /api/lists — a collection is a custom list with
 * a banner — then opens it.
 */
export function CollectionBuilder({ startAnime }: { startAnime: string | null }) {
  const router = useRouter();
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'PUBLIC' | 'PRIVATE'>('PUBLIC');
  const [anime, setAnime] = useState<PickedAnime[]>([]);
  const [banner, setBanner] = useState<BannerChoice>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickedAnime[]>([]);
  const [saving, setSaving] = useState(false);

  // The anime you came from.
  useEffect(() => {
    if (!startAnime) return;
    fetch(`/api/collections/anime?ids=${encodeURIComponent(startAnime)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const a = d?.anime?.[0];
        if (a) setAnime((prev) => (prev.some((p) => p.id === a.id) ? prev : [a, ...prev]));
      })
      .catch(() => {});
  }, [startAnime]);

  // Search to add more.
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
        .then((d) =>
          setResults(
            (d?.anime || []).slice(0, 8).map((a: PickedAnime) => ({ ...a, bannerUrl: isWide(a.bannerUrl) ? a.bannerUrl : null }))
          )
        )
        .catch(() => {});
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const add = (a: PickedAnime) => {
    setAnime((prev) => (prev.some((p) => p.id === a.id) ? prev : [...prev, a]));
    setQuery('');
    setResults([]);
  };
  const remove = (id: string) => {
    setAnime((prev) => prev.filter((p) => p.id !== id));
    if (banner?.kind === 'anime' && banner.animeId === id) setBanner(null);
  };

  const pickedIds = useMemo(() => new Set(anime.map((a) => a.id)), [anime]);
  const canSave = name.trim().length > 0 && anime.length > 0 && !saving;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return openAuthModal('login');
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          visibility,
          animeIds: anime.map((a) => a.id),
          ...(banner?.kind === 'upload' ? { bannerAssetId: banner.assetId } : {}),
          ...(banner?.kind === 'anime' ? { bannerAnimeId: banner.animeId } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Could not create the collection.');
      showToast(visibility === 'PUBLIC' ? 'Collection published' : 'Collection saved', 'success');
      router.push(`/library/lists/${body.list.id}`);
    } catch (err) {
      showToast((err as Error).message, 'error');
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <div className={styles.builderGate}>
        <p>Sign in to make a collection.</p>
        <button type="button" className={styles.primaryBtn} onClick={() => openAuthModal('login')}>
          Sign in
        </button>
      </div>
    );
  }

  return (
    <form className={styles.builder} onSubmit={save}>
      <BannerPicker value={banner} onChange={setBanner} sources={anime} title={name.trim() || 'Your collection'} />

      <div className={styles.fields}>
        <label className={styles.field}>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Rainy-day comfort anime" required />
        </label>
        <label className={styles.field}>
          <span>
            Description <em>optional</em>
          </span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} placeholder="What ties these together?" />
        </label>

        <div className={styles.field}>
          <span>Who can see it</span>
          <div className={styles.segment} role="radiogroup" aria-label="Visibility">
            <button type="button" role="radio" aria-checked={visibility === 'PUBLIC'} className={visibility === 'PUBLIC' ? styles.segOn : ''} onClick={() => setVisibility('PUBLIC')}>
              <Globe2 size={15} aria-hidden="true" /> Public
            </button>
            <button type="button" role="radio" aria-checked={visibility === 'PRIVATE'} className={visibility === 'PRIVATE' ? styles.segOn : ''} onClick={() => setVisibility('PRIVATE')}>
              <Lock size={15} aria-hidden="true" /> Private
            </button>
          </div>
          <small className={styles.hint}>
            {visibility === 'PUBLIC' ? 'Everyone can see it — on the homepage, in Collections and on your profile.' : 'Only you can see it.'}
          </small>
        </div>

        <div className={styles.field}>
          <span>
            Anime <em>{anime.length}</em>
          </span>
          <div className={styles.searchBox}>
            <Search size={16} aria-hidden="true" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search anime to add" aria-label="Search anime to add" />
            {results.length > 0 && (
              <ul className={styles.results} role="listbox">
                {results.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => add(r)} disabled={pickedIds.has(r.id)}>
                      <span className={styles.resultPoster}>
                        <AnimeImage src={r.posterUrl} alt="" fill sizes="40px" />
                      </span>
                      <span className={styles.resultText}>
                        <strong>{r.title}</strong>
                        <small>{[r.type, r.year].filter(Boolean).join(' · ')}</small>
                      </span>
                      {pickedIds.has(r.id) ? <small>Added</small> : <Plus size={16} aria-hidden="true" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {anime.length > 0 ? (
            <div className={styles.picked}>
              {anime.map((a) => (
                <div key={a.id} className={styles.pickedItem}>
                  <span className={styles.pickedPoster}>
                    <AnimeImage src={a.posterUrl} alt={a.title} fill sizes="110px" />
                  </span>
                  <span className={styles.pickedTitle}>{a.title}</span>
                  <button type="button" className={styles.pickedRemove} onClick={() => remove(a.id)} aria-label={`Remove ${a.title}`}>
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <small className={styles.hint}>Add at least one anime.</small>
          )}
        </div>
      </div>

      <div className={styles.saveBar}>
        <button type="button" className={styles.ghostBtn} onClick={() => router.back()}>
          Cancel
        </button>
        <button type="submit" className={styles.primaryBtn} disabled={!canSave}>
          {saving ? 'Saving…' : visibility === 'PUBLIC' ? 'Publish collection' : 'Save collection'}
        </button>
      </div>
    </form>
  );
}
