'use client';

/**
 * Creator review editor (Creator Mode, 2026-10-24): pick an anime from the
 * catalog (real records — /api/search), title, review, optional score on the
 * site's 0.5–10 scale in 0.1 steps (it becomes your real rating when you
 * publish), spoiler level, then Save draft or Publish. The server decides
 * who may publish and stamps the Creator Review label.
 */
import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, X } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { getRatingTier, getScoreColor } from '../../lib/rating/ratingTiers';
import { PageHead } from '../ui/PageHead';
import styles from '../../app/creator/creator.module.css';

interface AnimePick {
  id: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  year?: number | null;
  type?: string | null;
}

const SPOILERS = [
  ['SPOILER_FREE', 'Spoiler-free'],
  ['MILD_SPOILERS', 'Mild spoilers'],
  ['SPOILERS', 'Spoilers'],
  ['FULL_SPOILERS', 'Major spoilers'],
] as const;

function AnimePicker({ value, onChange, locked }: { value: AnimePick | null; onChange: (a: AnimePick | null) => void; locked: boolean }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<AnimePick[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const r = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&limit=8`).catch(() => null);
      const d = r && r.ok ? await r.json() : null;
      setResults((d?.anime || []).map((a: any) => ({ id: a.id, slug: a.slug, title: a.title, posterUrl: a.posterUrl ?? null, year: a.year, type: a.type })));
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q]);

  if (value) {
    return (
      <div className={styles.chosen}>
        <span className={styles.poster}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value.posterUrl && <img src={value.posterUrl} alt="" />}
        </span>
        <div className={styles.rowMain}>
          <span className={styles.rowTitle}>{value.title}</span>
          <span className={styles.small}>{[value.type, value.year].filter(Boolean).join(' · ')}</span>
        </div>
        {!locked && (
          <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => onChange(null)} aria-label="Choose another anime">
            <X size={14} aria-hidden="true" /> Change
          </button>
        )}
      </div>
    );
  }
  return (
    <div className={styles.picker}>
      <div style={{ position: 'relative' }}>
        <Search size={15} aria-hidden="true" style={{ position: 'absolute', left: 13, top: 13, color: 'var(--text-muted)' }} />
        <input className={styles.input} style={{ paddingLeft: 36 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the catalog…" aria-label="Search for the anime" />
      </div>
      {results.length > 0 && (
        <ul className={styles.pickerList}>
          {results.map((a) => (
            <li key={a.id}>
              <button type="button" className={styles.pickerItem} onClick={() => onChange(a)}>
                <span className={styles.poster} style={{ width: 34 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {a.posterUrl && <img src={a.posterUrl} alt="" loading="lazy" />}
                </span>
                <span className={styles.rowMain}>
                  <span className={styles.rowTitle} style={{ fontSize: 14 }}>{a.title}</span>
                  <span className={styles.small}>{[a.type, a.year].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CreatorReviewEditor({ reviewId }: { reviewId?: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [anime, setAnime] = useState<AnimePick | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [withScore, setWithScore] = useState(false);
  const [score, setScore] = useState(8);
  const [spoilerLevel, setSpoilerLevel] = useState<string>('SPOILER_FREE');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(!reviewId);

  // Editing: load the review. New: optional ?anime=<slug> preselect.
  useEffect(() => {
    if (reviewId) {
      fetch(`/api/creator/reviews/${encodeURIComponent(reviewId)}`, { cache: 'no-store' })
        .then(async (r) => {
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error || 'Review not found.');
          const rv = d.review;
          setAnime({ id: rv.anime.id, slug: rv.anime.slug, title: rv.anime.title, posterUrl: rv.anime.posterUrl });
          setTitle(rv.title);
          setBody(rv.body);
          setSpoilerLevel(rv.spoilerLevel);
          setStatus(rv.status);
          if (typeof rv.score === 'number') {
            setWithScore(true);
            setScore(rv.score);
          }
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoaded(true));
      return;
    }
    const slug = new URLSearchParams(window.location.search).get('anime');
    if (slug) {
      fetch(`/api/search?q=${encodeURIComponent(slug.replace(/-/g, ' '))}&limit=8`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          const hit = (d?.anime || []).find((a: any) => a.slug === slug);
          if (hit) setAnime({ id: hit.id, slug: hit.slug, title: hit.title, posterUrl: hit.posterUrl ?? null, year: hit.year, type: hit.type });
        })
        .catch(() => {});
    }
  }, [reviewId]);

  const save = async (publish: boolean) => {
    if (!anime) {
      setError('Choose the anime you are reviewing.');
      return;
    }
    if (busy) return; // no double submits
    setBusy(true);
    setError(null);
    try {
      const payload = { animeId: anime.id, title, body, spoilerLevel, publish };
      const r = await fetch(reviewId ? `/api/creator/reviews/${encodeURIComponent(reviewId)}` : '/api/creator/reviews', {
        method: reviewId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Could not save the review.');
      showToast(publish ? 'Published — it now shows on the anime page' : 'Draft saved', 'success');
      if (publish) router.push(`/anime/${anime.slug}#reviews`);
      else if (!reviewId) router.replace(`/creator/reviews/${d.review.id}`);
      else setStatus('DRAFT');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <div className={styles.page}><p className={styles.muted}>Loading…</p></div>;
  const tier = withScore ? getRatingTier(score) : null;
  const live = status === 'PUBLISHED';

  return (
    <div className={`${styles.page} ${styles.narrow}`} style={{ width: 'min(100% - 32px, 760px)' }}>
      <PageHead
        kicker="Creator review"
        title={reviewId ? 'Edit review' : 'Write a review'}
        actions={
          <Link href="/creator" className={styles.btn}>
            <ArrowLeft size={15} aria-hidden="true" /> Dashboard
          </Link>
        }
      >
        Published reviews show on the anime page with a Creator Review label.
      </PageHead>

      <form className={`${styles.card} ${styles.form}`} onSubmit={(e) => e.preventDefault()}>
        {error && <div className={styles.error} role="alert">{error}</div>}
        <div className={styles.field}>
          <span className={styles.label}>Anime</span>
          <AnimePicker value={anime} onChange={setAnime} locked={Boolean(reviewId)} />
        </div>
        <label className={styles.field}>
          <span className={styles.label}>Title</span>
          <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} placeholder="e.g. The quiet masterpiece of the season" />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Review</span>
          <textarea className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} placeholder="What works, what doesn't, and who it's for…" />
          <span className={styles.small}>{body.trim().length.toLocaleString()} / 5,000 · at least 20 characters</span>
        </label>

        <div className={styles.formRow}>
          {/* The 1–10 "Score (optional)" was removed with the star ratings
              (owner, 2026-10-25); a creator's verdict is their episode retention. */}
          <label className={styles.field}>
            <span className={styles.label}>Spoilers</span>
            <select className={styles.select} value={spoilerLevel} onChange={(e) => setSpoilerLevel(e.target.value)}>
              {SPOILERS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className={styles.actionsRow}>
          {!live && (
            <button type="button" className={styles.btn} onClick={() => save(false)} disabled={busy}>
              Save draft
            </button>
          )}
          <button type="button" className={styles.btnPrimary} onClick={() => save(true)} disabled={busy}>
            {busy ? 'Saving…' : live ? 'Update published review' : 'Publish'}
          </button>
        </div>
      </form>
    </div>
  );
}
