'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Plus, Trash2, X } from 'lucide-react';
import { ImageField } from '../ImageField';
import { Field, FormSection, SaveBar, SearchPicker, type PickedAnime } from '../Pickers';
import styles from '../control.module.css';

type Row = { id: string; slug: string; title: string; status: string; coverImageUrl: string | null; createdAt: string };
const day = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/** Articles written by the owner's account. */
export function ArticleListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    void fetch('/api/control/articles')
      .then((r) => r.json())
      .then((d) => setRows(d.articles || []));
  }, []);
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.kicker}>Editorial</p>
        <h1 className={styles.title}>Articles</h1>
        <p className={styles.caption}>Long-form pieces published on /articles under your account.</p>
      </header>
      <div className={styles.headActions}>
        <Link href="/control/articles/new" className={styles.primary}>
          <Plus size={16} /> Write an article
        </Link>
      </div>
      <ul className={styles.list}>
        {rows.length === 0 && <li className={styles.caption}>No articles yet.</li>}
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/control/articles/${r.id}`} className={styles.rowBtn}>
              <span className={styles.thumbWide}>
                {r.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.coverImageUrl} alt="" loading="lazy" />
                ) : null}
              </span>
              <span className={styles.rowText}>
                <strong>{r.title}</strong>
                <span>{day.format(new Date(r.createdAt))}</span>
                <span className={styles.tags}>
                  <em className={r.status === 'PUBLISHED' ? styles.live : styles.badge}>{r.status === 'PUBLISHED' ? 'Published' : 'Hidden'}</em>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Values = { title: string; summary: string; body: string; coverImageUrl: string; links: { label: string; url: string }[]; status: 'PUBLISHED' | 'HIDDEN' };
const EMPTY: Values = { title: '', summary: '', body: '', coverImageUrl: '', links: [], status: 'PUBLISHED' };

export function ArticleFormPage({ id }: { id: string | null }) {
  const router = useRouter();
  const [v, setV] = useState<Values>(EMPTY);
  const [anime, setAnime] = useState<PickedAnime | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    void fetch(`/api/control/articles/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.values) {
          setV({ ...EMPTY, ...d.values });
          setAnime(d.anime);
          setSlug(d.slug);
        } else setMsg({ ok: false, text: d.error || 'Article not found.' });
      });
  }, [id]);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((p) => ({ ...p, [k]: val }));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(id ? `/api/control/articles/${id}` : '/api/control/articles', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v, links: v.links.filter((l) => l.url.trim()), animeId: anime?.id ?? null }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Could not save.');
      if (!id) {
        router.replace(`/control/articles/${out.id}`);
        return;
      }
      setSlug(out.slug);
      setMsg({ ok: true, text: 'Saved.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!id || !window.confirm('Delete this article?')) return;
    const res = await fetch(`/api/control/articles/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/control/articles');
  };

  return (
    <div className={styles.page}>
      <Link href="/control/articles" className={styles.back}>
        <ArrowLeft size={14} /> All articles
      </Link>
      <header className={styles.head}>
        <p className={styles.kicker}>{id ? 'Edit article' : 'New article'}</p>
        <h1 className={styles.title}>{v.title || 'Untitled article'}</h1>
        {slug && v.status === 'PUBLISHED' && (
          <p className={styles.caption}>
            <Link href={`/articles/${slug}`} target="_blank" className={styles.inlineLink}>
              View on the site <ExternalLink size={12} />
            </Link>
          </p>
        )}
      </header>
      <FormSection title="Article">
        <Field label="Title *" wide>
          <input className={styles.input} value={v.title} onChange={(e) => set('title', e.target.value)} maxLength={140} />
        </Field>
        <Field label="Summary" wide>
          <textarea className={styles.textarea} rows={2} value={v.summary} onChange={(e) => set('summary', e.target.value)} />
        </Field>
        <Field label="Text *" wide hint="Plain text; leave a blank line between paragraphs">
          <textarea className={styles.textarea} rows={16} value={v.body} onChange={(e) => set('body', e.target.value)} />
        </Field>
      </FormSection>
      <FormSection title="Cover, anime & sources">
        <div className={styles.fieldWide}>
          <ImageField label="Cover image" kind="banner" shape="banner" value={v.coverImageUrl} onChange={(x) => set('coverImageUrl', x)} />
        </div>
        <Field label="Related anime" wide>
          {anime ? (
            <span className={styles.tagChip}>
              {anime.title}
              <button type="button" onClick={() => setAnime(null)} aria-label="Remove">
                <X size={12} />
              </button>
            </span>
          ) : (
            <SearchPicker placeholder="Search an anime (optional)" onPick={setAnime} />
          )}
        </Field>
        <Field label="Source links (up to 5)" wide>
          {v.links.map((l, i) => (
            <div key={i} className={styles.streamRow}>
              <input className={styles.input} placeholder="Label" value={l.label} onChange={(e) => set('links', v.links.map((x, k) => (k === i ? { ...x, label: e.target.value } : x)))} />
              <input className={styles.input} placeholder="https://…" value={l.url} onChange={(e) => set('links', v.links.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} />
              <button type="button" className={styles.iconBtnSm} onClick={() => set('links', v.links.filter((_, k) => k !== i))} aria-label="Remove link">
                <X size={14} />
              </button>
            </div>
          ))}
          {v.links.length < 5 && (
            <button type="button" className={styles.secondary} onClick={() => set('links', [...v.links, { label: '', url: '' }])}>
              <Plus size={14} /> Add a source
            </button>
          )}
        </Field>
        <Field label="Status">
          <select className={styles.selectFull} value={v.status} onChange={(e) => set('status', e.target.value as Values['status'])}>
            <option value="PUBLISHED">Published</option>
            <option value="HIDDEN">Hidden</option>
          </select>
        </Field>
      </FormSection>
      <SaveBar
        busy={busy}
        label={id ? 'Save article' : 'Publish article'}
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
