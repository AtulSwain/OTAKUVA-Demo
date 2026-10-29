'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Plus, Search, Trash2, X } from 'lucide-react';
import { ImageField } from '../ImageField';
import { Field, FormSection, SaveBar, SearchPicker, type PickedAnime } from '../Pickers';
import styles from '../control.module.css';

type Row = { id: string; slug: string; title: string; status: string; imageUrl: string | null; category: string; isFeatured: boolean; publishedAt: string };
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const CAT_LABEL: Record<string, string> = {
  ANIME: 'Anime',
  ANNOUNCEMENTS: 'Announcement',
  TRAILERS: 'Trailer',
  CASTING: 'Casting',
  PRODUCTION: 'Production',
  STUDIOS: 'Studios',
  INDUSTRY: 'Industry',
  MANGA: 'Manga',
};

/** OTAKUVA's own news stories. */
export function NewsListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    const d = await fetch(`/api/control/news?q=${encodeURIComponent(q.trim())}`).then((r) => r.json());
    setRows(d.news || []);
    setTotal(d.total || 0);
  }, [q]);
  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.kicker}>Editorial</p>
        <h1 className={styles.title}>News</h1>
        <p className={styles.caption}>Stories you write here are published as OTAKUVA news. Imported news is managed in the older News tool.</p>
      </header>
      <div className={styles.headActions}>
        <Link href="/control/news/new" className={styles.primary}>
          <Plus size={16} /> Write a story
        </Link>
      </div>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={16} aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your stories" aria-label="Search your stories" />
        </label>
      </div>
      <p className={styles.caption}>{total} stories</p>
      <ul className={styles.list}>
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/control/news/${r.id}`} className={styles.rowBtn}>
              <span className={styles.thumbWide}>
                {r.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.imageUrl} alt="" loading="lazy" />
                ) : null}
              </span>
              <span className={styles.rowText}>
                <strong>{r.title}</strong>
                <span>
                  {CAT_LABEL[r.category] || r.category} · {day.format(new Date(r.publishedAt))}
                </span>
                <span className={styles.tags}>
                  <em className={r.status === 'PUBLISHED' ? styles.live : styles.badge}>{r.status === 'PUBLISHED' ? 'Published' : 'Draft'}</em>
                  {r.isFeatured && <em className={styles.badge}>Featured</em>}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

type NewsValues = { title: string; subtitle: string; summary: string; content: string; imageUrl: string; category: string; status: 'DRAFT' | 'PUBLISHED'; isFeatured: boolean };
const EMPTY: NewsValues = { title: '', subtitle: '', summary: '', content: '', imageUrl: '', category: 'ANIME', status: 'PUBLISHED', isFeatured: false };

export function NewsFormPage({ id }: { id: string | null }) {
  const router = useRouter();
  const [v, setV] = useState<NewsValues>(EMPTY);
  const [anime, setAnime] = useState<PickedAnime[]>([]);
  const [slug, setSlug] = useState<string | null>(null);
  const [cats, setCats] = useState<string[]>(Object.keys(CAT_LABEL));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void fetch('/api/control/news?q=__none__')
      .then((r) => r.json())
      .then((d) => d.categories && setCats(d.categories));
    if (!id) return;
    void fetch(`/api/control/news/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.values) {
          setV({ ...EMPTY, ...d.values });
          setAnime(d.anime || []);
          setSlug(d.slug);
        } else setMsg({ ok: false, text: d.error || 'Story not found.' });
      });
  }, [id]);

  const set = <K extends keyof NewsValues>(k: K, val: NewsValues[K]) => setV((p) => ({ ...p, [k]: val }));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(id ? `/api/control/news/${id}` : '/api/control/news', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v, animeIds: anime.map((a) => a.id) }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Could not save.');
      if (!id) {
        router.replace(`/control/news/${out.id}`);
        return;
      }
      setSlug(out.slug);
      setMsg({ ok: true, text: v.status === 'PUBLISHED' ? 'Saved and live.' : 'Saved as draft.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!id || !window.confirm('Delete this story?')) return;
    const res = await fetch(`/api/control/news/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/control/news');
  };

  return (
    <div className={styles.page}>
      <Link href="/control/news" className={styles.back}>
        <ArrowLeft size={14} /> All stories
      </Link>
      <header className={styles.head}>
        <p className={styles.kicker}>{id ? 'Edit story' : 'New story'}</p>
        <h1 className={styles.title}>{v.title || 'Untitled story'}</h1>
        {slug && v.status === 'PUBLISHED' && (
          <p className={styles.caption}>
            <Link href={`/news/${slug}`} target="_blank" className={styles.inlineLink}>
              View on the site <ExternalLink size={12} />
            </Link>
          </p>
        )}
      </header>

      <FormSection title="Story">
        <Field label="Headline *" wide>
          <input className={styles.input} value={v.title} onChange={(e) => set('title', e.target.value)} maxLength={200} />
        </Field>
        <Field label="Subheading" wide>
          <input className={styles.input} value={v.subtitle} onChange={(e) => set('subtitle', e.target.value)} maxLength={240} />
        </Field>
        <Field label="Summary" wide hint="One or two sentences shown on news cards">
          <textarea className={styles.textarea} rows={2} value={v.summary} onChange={(e) => set('summary', e.target.value)} maxLength={600} />
        </Field>
        <Field label="Full story *" wide hint="Leave a blank line between paragraphs">
          <textarea className={styles.textarea} rows={14} value={v.content} onChange={(e) => set('content', e.target.value)} />
        </Field>
      </FormSection>

      <FormSection title="Image & category">
        <div className={styles.fieldWide}>
          <ImageField label="Cover image" kind="banner" shape="banner" value={v.imageUrl} onChange={(x) => set('imageUrl', x)} />
        </div>
        <Field label="Category">
          <select className={styles.selectFull} value={v.category} onChange={(e) => set('category', e.target.value)}>
            {cats.map((c) => (
              <option key={c} value={c}>
                {CAT_LABEL[c] || c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className={styles.selectFull} value={v.status} onChange={(e) => set('status', e.target.value as NewsValues['status'])}>
            <option value="PUBLISHED">Published</option>
            <option value="DRAFT">Draft (hidden)</option>
          </select>
        </Field>
        <Field label="Featured" wide>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={v.isFeatured} onChange={(e) => set('isFeatured', e.target.checked)} /> Feature this story at the top of the news page
          </label>
        </Field>
      </FormSection>

      <FormSection title="About which anime?" hint="Linked stories also appear on those anime pages.">
        <div className={styles.fieldWide}>
          <SearchPicker placeholder="Search an anime to link" exclude={anime.map((a) => a.id)} onPick={(a) => setAnime((l) => [...l, a].slice(0, 10))} />
          <div className={styles.chipWrap}>
            {anime.map((a) => (
              <span key={a.id} className={styles.tagChip}>
                {a.title}
                <button type="button" onClick={() => setAnime((l) => l.filter((x) => x.id !== a.id))} aria-label={`Unlink ${a.title}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      </FormSection>

      <SaveBar
        busy={busy}
        label={id ? 'Save story' : 'Publish story'}
        msg={msg}
        onSave={save}
        extra={
          id ? (
            <button type="button" className={styles.ghost} onClick={remove}>
              <Trash2 size={14} /> Delete
            </button>
          ) : undefined
        }
      />
    </div>
  );
}
