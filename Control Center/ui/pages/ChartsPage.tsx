'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Trophy } from 'lucide-react';
import { Field, FormSection } from '../Pickers';
import styles from '../control.module.css';

type Chart = { id: string; slug: string; title: string; description: string | null; size: number; isPublished: boolean; entries: number; updatedAt: string };

/** Owner-made ranked charts: Top 10 / Top 100 / anything, and the OTAKUVA Choice list. */
export default function ChartsPage() {
  const router = useRouter();
  const [charts, setCharts] = useState<Chart[]>([]);
  const [choiceSlug, setChoiceSlug] = useState('otakuva-choice');
  const [title, setTitle] = useState('');
  const [size, setSize] = useState(10);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch('/api/control/charts').then((r) => r.json());
    setCharts(d.charts || []);
    if (d.choiceSlug) setChoiceSlug(d.choiceSlug);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const create = async (input: { title: string; size: number; description?: string; slug?: string }) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/control/charts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Could not create the chart.');
      router.push(`/control/charts/${out.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const hasChoice = charts.some((c) => c.slug === choiceSlug);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.kicker}>Editorial</p>
        <h1 className={styles.title}>Charts</h1>
        <p className={styles.caption}>
          Your own ranked lists. Published charts appear at <Link href="/charts" className={styles.inlineLink} target="_blank">/charts</Link>.
        </p>
      </header>

      {!hasChoice && (
        <div className={styles.callout}>
          <Trophy size={18} aria-hidden="true" />
          <span>
            <strong>OTAKUVA Choice</strong> — make it here and it replaces the built-in list on Top Picks once published.
          </span>
          <button type="button" className={styles.secondary} disabled={busy} onClick={() => void create({ title: 'OTAKUVA Choice', size: 25, slug: choiceSlug })}>
            Create it
          </button>
        </div>
      )}

      <ul className={styles.chartGrid}>
        {charts.map((c) => (
          <li key={c.id}>
            <Link href={`/control/charts/${c.id}`} className={styles.chartCard}>
              <span className={styles.tags}>
                <em className={c.isPublished ? styles.live : styles.badge}>{c.isPublished ? 'Published' : 'Draft'}</em>
                {c.slug === choiceSlug && <em className={styles.badge}>OTAKUVA Choice</em>}
              </span>
              <strong>{c.title}</strong>
              <span className={styles.caption}>
                {c.entries} / {c.size} anime · /charts/{c.slug}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <FormSection title="New chart" hint="E.g. “Top 10 Romance of 2026”, “Top 100 of all time”.">
        <Field label="Title *" wide>
          <input className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="Top 10 …" />
        </Field>
        <Field label="Size">
          <select className={styles.selectFull} value={size} onChange={(e) => setSize(Number(e.target.value))}>
            {[10, 25, 50, 100].map((n) => (
              <option key={n} value={n}>
                Top {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Description" wide>
          <textarea className={styles.textarea} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={600} />
        </Field>
        <div className={styles.fieldWide}>
          {error && <p className={styles.error}>{error}</p>}
          <button type="button" className={styles.primary} disabled={busy || title.trim().length < 2} onClick={() => void create({ title, size, description })}>
            <Plus size={16} /> Create chart
          </button>
        </div>
      </FormSection>
    </div>
  );
}
