'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ImagePlus, Link2, Plus, Trash2, X, Loader2, ArrowLeft, Search } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import styles from '../articles.module.css';
import { resolveMediaUrl } from '../../../lib/mediaResolver';

// Mirrors ARTICLE_LIMITS in src/lib/articles/articleService.ts (the server enforces them).
const LIMITS = { titleMin: 8, titleMax: 140, summaryMax: 280, bodyMin: 80, bodyMax: 20000, linksMax: 5 };

type AnimeOption = { id: string; slug: string; title: string; posterUrl: string | null; year?: number | null };

export default function NewArticlePage() {
  const router = useRouter();
  const { user, isLoading, openAuthModal } = useAuth();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [body, setBody] = useState('');
  const [links, setLinks] = useState<Array<{ label: string; url: string }>>([{ label: '', url: '' }]);
  const [anime, setAnime] = useState<AnimeOption | null>(null);
  const [animeQuery, setAnimeQuery] = useState('');
  const [animeResults, setAnimeResults] = useState<AnimeOption[]>([]);
  const [cover, setCover] = useState<{ assetId: string; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // "Write one" on an anime page links here with ?anime=<slug>: pre-select it.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('anime');
    if (!slug) return;
    fetch(`/api/anime/${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const a = d?.anime;
        if (a?.id) setAnime({ id: a.id, slug: a.slug, title: a.title || a.canonicalTitle, posterUrl: a.posterImage || a.posterUrl || null, year: a.year ?? null });
      })
      .catch(() => {});
  }, []);

  // Related-anime search, debounced.
  useEffect(() => {
    const q = animeQuery.trim();
    if (q.length < 2) {
      setAnimeResults([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => setAnimeResults((d?.anime || []).slice(0, 6)))
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [animeQuery]);

  const uploadCover = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/articles/cover', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Image upload failed.');
      setCover({ assetId: data.assetId, url: data.url });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const publish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (title.trim().length < LIMITS.titleMin) return setError(`Give it a title of at least ${LIMITS.titleMin} characters.`);
    if (body.trim().length < LIMITS.bodyMin) return setError(`Write at least ${LIMITS.bodyMin} characters.`);
    setPublishing(true);
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          summary,
          body,
          links: links.filter((l) => l.url.trim()),
          animeId: anime?.id,
          coverAssetId: cover?.assetId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Could not publish the article.');
      showToast('Article published', 'success');
      router.push(`/articles/${data.article.slug}`);
    } catch (err) {
      setError((err as Error).message);
      setPublishing(false);
    }
  };

  if (!isLoading && !user) {
    return (
      <div className={styles.page}>
        <div className={styles.empty}>
          <h2>Sign in to write an article</h2>
          <p>Articles show who shared them, so you need an account first.</p>
          <button type="button" className={styles.writeBtn} onClick={() => openAuthModal('login')}>
            Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/articles" className={styles.back}>
        <ArrowLeft size={15} aria-hidden="true" /> All articles
      </Link>
      <header className={styles.formHead}>
        <p className={styles.kicker}>New article</p>
        <h1 className={styles.title}>Share something with everyone</h1>
        <p className={styles.subtitle}>
          Found anime news or information others should know? Write it up and link your sources. It appears in
          Articles and on your profile, with your name on it.
        </p>
      </header>

      <form className={styles.form} onSubmit={publish} noValidate>
        {/* Cover */}
        <div className={styles.field}>
          <span className={styles.label}>Cover image (optional)</span>
          {cover ? (
            <div className={styles.coverPreview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resolveMediaUrl(cover.url) || undefined} alt="Cover preview" />
              <button type="button" className={styles.coverRemove} onClick={() => setCover(null)} aria-label="Remove image">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button type="button" className={styles.coverDrop} onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 size={22} className={styles.spin} aria-hidden="true" /> : <ImagePlus size={22} aria-hidden="true" />}
              <span>{uploading ? 'Uploading…' : 'Add an image'}</span>
              <small>JPG, PNG or WebP, up to 15 MB</small>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            hidden
            onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])}
          />
        </div>

        <label className={styles.field}>
          <span className={styles.label}>Title</span>
          <input
            className={styles.input}
            value={title}
            maxLength={LIMITS.titleMax}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Season 2 announced with a new trailer"
            required
          />
          <span className={styles.hint}>
            {title.trim().length}/{LIMITS.titleMax}
          </span>
        </label>

        {/* Related anime */}
        <div className={styles.field}>
          <span className={styles.label}>Related anime (optional)</span>
          {anime ? (
            <div className={styles.animePicked}>
              {anime.posterUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={anime.posterUrl} alt="" />
              )}
              <span>{anime.title}</span>
              <button type="button" className={styles.iconBtn} onClick={() => setAnime(null)} aria-label="Remove related anime">
                <X size={15} />
              </button>
            </div>
          ) : (
            <div className={styles.animeSearch}>
              <Search size={15} aria-hidden="true" className={styles.animeSearchIcon} />
              <input
                className={styles.input}
                value={animeQuery}
                onChange={(e) => setAnimeQuery(e.target.value)}
                placeholder="Search for the anime this is about"
              />
              {animeResults.length > 0 && (
                <ul className={styles.animeResults} role="listbox">
                  {animeResults.map((a) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setAnime(a);
                          setAnimeQuery('');
                          setAnimeResults([]);
                        }}
                      >
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

        <label className={styles.field}>
          <span className={styles.label}>Short summary (optional)</span>
          <input
            className={styles.input}
            value={summary}
            maxLength={LIMITS.summaryMax}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="One or two lines shown on the article card"
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>Article</span>
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            value={body}
            maxLength={LIMITS.bodyMax}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What happened, where you heard it, and why it matters. Leave a blank line between paragraphs."
            rows={12}
            required
          />
          <span className={styles.hint}>
            {body.trim().length.toLocaleString('en-US')} characters {body.trim().length < LIMITS.bodyMin ? `(at least ${LIMITS.bodyMin})` : ''}
          </span>
        </label>

        {/* Links */}
        <div className={styles.field}>
          <span className={styles.label}>Sources &amp; links</span>
          <div className={styles.links}>
            {links.map((l, i) => (
              <div key={i} className={styles.linkRow}>
                <Link2 size={15} aria-hidden="true" className={styles.linkIcon} />
                <input
                  className={styles.input}
                  value={l.label}
                  onChange={(e) => setLinks((prev) => prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  placeholder="Label (e.g. Official site)"
                  maxLength={60}
                />
                <input
                  className={styles.input}
                  type="url"
                  inputMode="url"
                  value={l.url}
                  onChange={(e) => setLinks((prev) => prev.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                  placeholder="https://"
                />
                <button
                  type="button"
                  className={styles.iconBtn}
                  onClick={() => setLinks((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [{ label: '', url: '' }]))}
                  aria-label="Remove link"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            {links.length < LIMITS.linksMax && (
              <button type="button" className={styles.addLink} onClick={() => setLinks((prev) => [...prev, { label: '', url: '' }])}>
                <Plus size={14} aria-hidden="true" /> Add link
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        <div className={styles.formActions}>
          <Link href="/articles" className={styles.cancelBtn}>
            Cancel
          </Link>
          <button type="submit" className={styles.writeBtn} disabled={publishing || uploading}>
            {publishing ? 'Publishing…' : 'Publish article'}
          </button>
        </div>
      </form>
    </div>
  );
}
