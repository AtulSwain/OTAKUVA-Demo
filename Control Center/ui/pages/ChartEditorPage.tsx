'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react';
import { Field, FormSection, OrderedAnimeList, SaveBar, type PickedAnime } from '../Pickers';
import styles from '../control.module.css';

type Chart = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  size: number;
  isPublished: boolean;
  items: { animeId: string; title: string; posterUrl: string | null; note: string | null; slug: string; type: string | null; year: number | null }[];
};

export default function ChartEditorPage({ id }: { id: string }) {
  const router = useRouter();
  const [chart, setChart] = useState<Chart | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [size, setSize] = useState(10);
  const [items, setItems] = useState<PickedAnime[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const apply = (c: Chart) => {
    setChart(c);
    setTitle(c.title);
    setDescription(c.description || '');
    setSize(c.size);
    setItems(c.items.map((i) => ({ id: i.animeId, title: i.title, posterUrl: i.posterUrl, note: i.note, slug: i.slug })));
  };
  const load = useCallback(async () => {
    const res = await fetch(`/api/control/charts/${id}`);
    const d = await res.json();
    if (res.ok) apply(d);
    else setMsg({ ok: false, text: d.error || 'Chart not found.' });
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const call = async (url: string, method: string, payload?: unknown) => {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || 'Could not save.');
    return out;
  };

  const save = async (publish?: boolean) => {
    if (!chart) return;
    setBusy(true);
    setMsg(null);
    try {
      // Ranking first (a smaller size must fit the list), then details.
      if (size >= items.length) {
        await call(`/api/control/charts/${id}`, 'PATCH', { title, description, size: Math.max(size, chart.size) });
      }
      await call(`/api/control/charts/${id}/entries`, 'PUT', { entries: items.map((i) => ({ animeId: i.id, note: i.note ?? null })) });
      const out = await call(`/api/control/charts/${id}`, 'PATCH', { title, description, size, ...(publish !== undefined ? { isPublished: publish } : {}) });
      apply(out);
      setMsg({ ok: true, text: publish === true ? 'Published.' : publish === false ? 'Unpublished (saved as draft).' : 'Saved.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!chart || !window.confirm(`Delete “${chart.title}”? This can't be undone.`)) return;
    try {
      await call(`/api/control/charts/${id}`, 'DELETE');
      router.push('/control/charts');
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  };

  if (!chart) return <div className={styles.page}>{msg ? <p className={styles.error}>{msg.text}</p> : 'Loading…'}</div>;

  return (
    <div className={styles.page}>
      <Link href="/control/charts" className={styles.back}>
        <ArrowLeft size={14} /> All charts
      </Link>
      <header className={styles.head}>
        <p className={styles.kicker}>{chart.isPublished ? 'Published chart' : 'Draft chart'}</p>
        <h1 className={styles.title}>{title || 'Untitled chart'}</h1>
        {chart.isPublished && (
          <p className={styles.caption}>
            <Link href={`/charts/${chart.slug}`} target="_blank" className={styles.inlineLink}>
              View on the site <ExternalLink size={12} />
            </Link>
          </p>
        )}
      </header>

      <FormSection title="Details">
        <Field label="Title" wide>
          <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
        </Field>
        <Field label="Size">
          <select className={styles.selectFull} value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n} disabled={n < items.length}>
                Top {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description" wide>
          <textarea className={styles.textarea} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
        </Field>
      </FormSection>

      <FormSection title="Ranking" hint="#1 at the top. Add a short note for why each one is here.">
        <div className={styles.fieldWide}>
          <OrderedAnimeList items={items} onChange={setItems} withNotes max={size} />
        </div>
      </FormSection>

      <SaveBar
        busy={busy}
        label="Save"
        msg={msg}
        onSave={() => void save()}
        extra={
          <>
            <button type="button" className={styles.ghost} onClick={remove}>
              <Trash2 size={14} /> Delete
            </button>
            <button type="button" className={styles.secondary} onClick={() => void save(!chart.isPublished)} disabled={busy}>
              {chart.isPublished ? 'Unpublish' : 'Save & publish'}
            </button>
          </>
        }
      />
    </div>
  );
}
