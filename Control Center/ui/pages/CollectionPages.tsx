'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { ImageField } from '../ImageField';
import { Field, FormSection, OrderedAnimeList, SaveBar, type PickedAnime } from '../Pickers';
import styles from '../control.module.css';

type Row = { id: string; name: string; visibility: string; count?: number; itemCount?: number; covers?: string[]; bannerUrl?: string | null };
const VIS: Record<string, string> = { PUBLIC: 'Public', LINK: 'Anyone with the link', PRIVATE: 'Private' };

/** Official OTAKUVA collections (public lists owned by your account). */
export function CollectionListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    void fetch('/api/control/collections')
      .then((r) => r.json())
      .then((d) => setRows(d.collections || []));
  }, []);
  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.kicker}>Editorial</p>
        <h1 className={styles.title}>Collections</h1>
        <p className={styles.caption}>Public collections appear on the homepage and on /collections.</p>
      </header>
      <div className={styles.headActions}>
        <Link href="/control/collections/new" className={styles.primary}>
          <Plus size={16} /> New collection
        </Link>
      </div>
      <ul className={styles.chartGrid}>
        {rows.length === 0 && <li className={styles.caption}>No collections yet.</li>}
        {rows.map((c) => (
          <li key={c.id}>
            <Link href={`/control/collections/${c.id}`} className={styles.chartCard}>
              <span className={styles.tags}>
                <em className={c.visibility === 'PUBLIC' ? styles.live : styles.badge}>{VIS[c.visibility] || c.visibility}</em>
              </span>
              <strong>{c.name}</strong>
              <span className={styles.caption}>{c.itemCount ?? c.count ?? 0} anime</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Values = { name: string; description: string; visibility: string; bannerUrl: string };
const EMPTY: Values = { name: '', description: '', visibility: 'PUBLIC', bannerUrl: '' };

export function CollectionFormPage({ id }: { id: string | null }) {
  const router = useRouter();
  const [v, setV] = useState<Values>(EMPTY);
  const [items, setItems] = useState<PickedAnime[]>([]);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    void fetch(`/api/control/collections/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.values) {
          setV({ ...EMPTY, ...d.values });
          setItems(d.items || []);
          setShareToken(d.shareToken);
        } else setMsg({ ok: false, text: d.error || 'Collection not found.' });
      });
  }, [id]);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((p) => ({ ...p, [k]: val }));

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(id ? `/api/control/collections/${id}` : '/api/control/collections', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...v, animeIds: items.map((i) => i.id) }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Could not save.');
      if (!id) {
        router.replace(`/control/collections/${out.id}`);
        return;
      }
      const d = await fetch(`/api/control/collections/${id}`).then((r) => r.json());
      setShareToken(d.shareToken);
      setMsg({ ok: true, text: 'Saved.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!id || !window.confirm('Delete this collection?')) return;
    const res = await fetch(`/api/control/collections/${id}`, { method: 'DELETE' });
    if (res.ok) router.push('/control/collections');
  };

  return (
    <div className={styles.page}>
      <Link href="/control/collections" className={styles.back}>
        <ArrowLeft size={14} /> All collections
      </Link>
      <header className={styles.head}>
        <p className={styles.kicker}>{id ? 'Edit collection' : 'New collection'}</p>
        <h1 className={styles.title}>{v.name || 'Untitled collection'}</h1>
        {shareToken && v.visibility !== 'PRIVATE' && (
          <p className={styles.caption}>
            <Link href={`/l/${shareToken}`} target="_blank" className={styles.inlineLink}>
              View on the site <ExternalLink size={12} />
            </Link>
          </p>
        )}
      </header>
      <FormSection title="Details">
        <Field label="Name *" wide>
          <input className={styles.input} value={v.name} onChange={(e) => set('name', e.target.value)} maxLength={60} />
        </Field>
        <Field label="Description" wide>
          <textarea className={styles.textarea} rows={3} value={v.description} onChange={(e) => set('description', e.target.value)} maxLength={500} />
        </Field>
        <Field label="Who can see it">
          <select className={styles.selectFull} value={v.visibility} onChange={(e) => set('visibility', e.target.value)}>
            {Object.entries(VIS).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <div className={styles.fieldWide}>
          <ImageField label="Banner (optional — otherwise taken from its anime)" kind="banner" shape="banner" value={v.bannerUrl} onChange={(x) => set('bannerUrl', x)} />
        </div>
      </FormSection>
      <FormSection title="Anime in this collection" hint="In the order they should appear.">
        <div className={styles.fieldWide}>
          <OrderedAnimeList items={items} onChange={setItems} max={500} />
        </div>
      </FormSection>
      <SaveBar
        busy={busy}
        label={id ? 'Save collection' : 'Create collection'}
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
