'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Plus, Star, X } from 'lucide-react';
import { ImageField } from '../ImageField';
import { Field, FormSection, SaveBar, SearchPicker } from '../Pickers';
import styles from '../control.module.css';

type Options = {
  genres: { id: string; name: string }[];
  themes: { id: string; name: string }[];
  types: string[];
  statuses: string[];
  seasons: string[];
  sources: string[];
  ratings: string[];
  weekdays: string[];
};

type Values = {
  canonicalTitle: string;
  englishTitle: string;
  romajiTitle: string;
  nativeTitle: string;
  synonyms: string[];
  synopsis: string;
  background: string;
  type: string;
  status: string;
  source: string;
  episodes: number | null;
  duration: string;
  rating: string;
  season: string;
  seasonYear: number | null;
  startDate: string;
  endDate: string;
  broadcastDay: string;
  broadcastTime: string;
  country: string;
  posterUrl: string;
  bannerUrl: string;
  trailerUrl: string;
  anilistId: number | null;
  malId: number | null;
  genreIds: string[];
  themeIds: string[];
  studios: { id: string; name: string; isMain: boolean }[];
  streaming: { provider: string; url: string }[];
};

const EMPTY: Values = {
  canonicalTitle: '',
  englishTitle: '',
  romajiTitle: '',
  nativeTitle: '',
  synonyms: [],
  synopsis: '',
  background: '',
  type: 'TV',
  status: 'Not Yet Aired',
  source: '',
  episodes: null,
  duration: '',
  rating: '',
  season: '',
  seasonYear: null,
  startDate: '',
  endDate: '',
  broadcastDay: '',
  broadcastTime: '',
  country: 'JP',
  posterUrl: '',
  bannerUrl: '',
  trailerUrl: '',
  anilistId: null,
  malId: null,
  genreIds: [],
  themeIds: [],
  studios: [],
  streaming: [],
};

const ytId = (url: string) => /(?:v=|youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/.exec(url)?.[1] ?? null;
const num = (v: string) => (v.trim() === '' ? null : Number(v));

export default function AnimeFormPage({ id }: { id: string | null }) {
  const router = useRouter();
  const [opts, setOpts] = useState<Options | null>(null);
  const [v, setV] = useState<Values>(EMPTY);
  const [meta, setMeta] = useState<{ slug: string; overrides: string[]; externalSource: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [synonymDraft, setSynonymDraft] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [o, f] = await Promise.all([
          fetch('/api/control/anime-form').then((r) => r.json()),
          id ? fetch(`/api/control/anime-form/${id}`).then((r) => r.json()) : Promise.resolve(null),
        ]);
        setOpts(o);
        if (f?.values) {
          setV({ ...EMPTY, ...f.values });
          setMeta({ slug: f.slug, overrides: f.overrides || [], externalSource: f.externalSource });
        } else if (id) setMsg({ ok: false, text: f?.error || 'Anime not found.' });
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((p) => ({ ...p, [k]: val }));
  const toggle = (k: 'genreIds' | 'themeIds', val: string) => set(k, v[k].includes(val) ? v[k].filter((x) => x !== val) : [...v[k], val]);
  const mine = useMemo(() => new Set(meta?.overrides || []), [meta]);
  const by = (f: string) => (mine.has(f) ? 'set by you' : undefined);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(id ? `/api/control/anime-form/${id}` : '/api/control/anime-form', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Could not save.');
      if (!id) {
        router.replace(`/control/anime/${out.id}?created=1`);
        return;
      }
      setMsg({ ok: true, text: out.changed?.length ? `Saved: ${out.changed.join(', ')}. Sync won't overwrite what you set.` : 'Nothing changed.' });
      const f = await fetch(`/api/control/anime-form/${id}`).then((r) => r.json());
      if (f?.values) {
        setV({ ...EMPTY, ...f.values });
        setMeta({ slug: f.slug, overrides: f.overrides || [], externalSource: f.externalSource });
      }
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  if (loading || !opts) return <div className={styles.page}>Loading…</div>;
  const trailer = ytId(v.trailerUrl);
  const checklist = [
    ['Identity', Boolean(v.canonicalTitle && (v.romajiTitle || v.englishTitle))],
    ['Story', Boolean(v.synopsis.trim())],
    ['Format', Boolean(v.type && v.status)],
    ['Artwork', Boolean(v.posterUrl && v.bannerUrl)],
    ['Discovery', v.genreIds.length > 0 && v.streaming.length > 0],
  ];
  const complete = checklist.filter(([, ok]) => ok).length;

  return (
    <div className={styles.page}>
      <Link href="/control/anime" className={styles.back}>
        <ArrowLeft size={14} /> All anime
      </Link>
      <header className={styles.head}>
        <p className={styles.kicker}>{id ? 'Edit anime' : 'New anime'}</p>
        <h1 className={styles.title}>{v.canonicalTitle || 'Untitled anime'}</h1>
        {meta && (
          <p className={styles.caption}>
            <Link href={`/anime/${meta.slug}`} target="_blank" className={styles.inlineLink}>
              Open public page <ExternalLink size={12} />
            </Link>{' '}
            · source: {meta.externalSource}
          </p>
        )}
      </header>
      <section className={styles.formSection} aria-label="Publish readiness">
        <div className={styles.formSectionHead}><h2>Publish readiness <span className={styles.countTag}>{complete}/{checklist.length}</span></h2><p>Complete the essentials before publishing. Optional provider IDs can be added later.</p></div>
        <div className={styles.readiness}>{checklist.map(([label, ok]) => <span key={String(label)} className={ok ? styles.ready : styles.notReady}><span aria-hidden="true">{ok ? '✓' : '○'}</span>{label}</span>)}</div>
      </section>

      <FormSection title="Titles" hint="The main title is what the site shows. The others help search.">
        <Field label="Main title *" wide badge={by('canonicalTitle')}>
          <input className={styles.input} value={v.canonicalTitle} onChange={(e) => set('canonicalTitle', e.target.value)} maxLength={300} />
        </Field>
        <Field label="English title">
          <input className={styles.input} value={v.englishTitle} onChange={(e) => set('englishTitle', e.target.value)} />
        </Field>
        <Field label="Romaji title">
          <input className={styles.input} value={v.romajiTitle} onChange={(e) => set('romajiTitle', e.target.value)} />
        </Field>
        <Field label="Japanese title">
          <input className={styles.input} value={v.nativeTitle} onChange={(e) => set('nativeTitle', e.target.value)} lang="ja" />
        </Field>
        <Field label="Other names" hint="Press Enter to add">
          <div className={styles.tagInput}>
            {v.synonyms.map((s) => (
              <span key={s} className={styles.tagChip}>
                {s}
                <button type="button" onClick={() => set('synonyms', v.synonyms.filter((x) => x !== s))} aria-label={`Remove ${s}`}>
                  <X size={12} />
                </button>
              </span>
            ))}
            <input
              className={styles.tagField}
              value={synonymDraft}
              onChange={(e) => setSynonymDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && synonymDraft.trim()) {
                  e.preventDefault();
                  if (!v.synonyms.includes(synonymDraft.trim())) set('synonyms', [...v.synonyms, synonymDraft.trim()]);
                  setSynonymDraft('');
                }
              }}
              placeholder="Add a name"
            />
          </div>
        </Field>
      </FormSection>

      <FormSection title="Story">
        <Field label="Synopsis" wide badge={by('synopsis')}>
          <textarea className={styles.textarea} rows={7} value={v.synopsis} onChange={(e) => set('synopsis', e.target.value)} />
        </Field>
        <Field label="Background" wide hint="Production notes, adaptation history — optional" badge={by('background')}>
          <textarea className={styles.textarea} rows={3} value={v.background} onChange={(e) => set('background', e.target.value)} />
        </Field>
      </FormSection>

      <FormSection title="Format & status">
        <Field label="Format" badge={by('type')}>
          <select className={styles.selectFull} value={v.type} onChange={(e) => set('type', e.target.value)}>
            {opts.types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Status" badge={by('status')}>
          <select className={styles.selectFull} value={v.status} onChange={(e) => set('status', e.target.value)}>
            {opts.statuses.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Episodes" badge={by('episodes')}>
          <input className={styles.input} type="number" min={1} inputMode="numeric" value={v.episodes ?? ''} onChange={(e) => set('episodes', num(e.target.value))} />
        </Field>
        <Field label="Episode length" hint="e.g. 24 min" badge={by('duration')}>
          <input className={styles.input} value={v.duration} onChange={(e) => set('duration', e.target.value)} />
        </Field>
        <Field label="Source" badge={by('source')}>
          <select className={styles.selectFull} value={v.source} onChange={(e) => set('source', e.target.value)}>
            <option value="">—</option>
            {opts.sources.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Age rating" badge={by('rating')}>
          <select className={styles.selectFull} value={v.rating} onChange={(e) => set('rating', e.target.value)}>
            <option value="">—</option>
            {opts.ratings.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Country" hint="Two letters, e.g. JP, KR, CN" badge={by('country')}>
          <input className={styles.input} value={v.country} maxLength={2} onChange={(e) => set('country', e.target.value.toUpperCase())} />
        </Field>
      </FormSection>

      <FormSection title="Dates & broadcast">
        <Field label="Season" badge={by('season')}>
          <select className={styles.selectFull} value={v.season} onChange={(e) => set('season', e.target.value)}>
            <option value="">—</option>
            {opts.seasons.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Year" badge={by('seasonYear')}>
          <input className={styles.input} type="number" inputMode="numeric" value={v.seasonYear ?? ''} onChange={(e) => set('seasonYear', num(e.target.value))} />
        </Field>
        <Field label="First aired" badge={by('startDate')}>
          <input className={styles.input} type="date" value={v.startDate} onChange={(e) => set('startDate', e.target.value)} />
        </Field>
        <Field label="Last aired" badge={by('endDate')}>
          <input className={styles.input} type="date" value={v.endDate} onChange={(e) => set('endDate', e.target.value)} />
        </Field>
        <Field label="Broadcast day (JST)" badge={by('broadcastDay')}>
          <select className={styles.selectFull} value={v.broadcastDay} onChange={(e) => set('broadcastDay', e.target.value)}>
            <option value="">—</option>
            {opts.weekdays.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Broadcast time (JST)" badge={by('broadcastTime')}>
          <input className={styles.input} type="time" value={v.broadcastTime} onChange={(e) => set('broadcastTime', e.target.value)} />
        </Field>
      </FormSection>

      <FormSection title="Artwork & trailer" hint="Paste an https:// link or upload a file.">
        <div className={styles.fieldWide}>
          <ImageField label={`Poster${by('posterUrl') ? ' · set by you' : ''}`} kind="poster" shape="poster" value={v.posterUrl} onChange={(x) => set('posterUrl', x)} />
        </div>
        <div className={styles.fieldWide}>
          <ImageField label={`Banner / background image${by('bannerUrl') ? ' · set by you' : ''}`} kind="banner" shape="banner" value={v.bannerUrl} onChange={(x) => set('bannerUrl', x)} />
        </div>
        <Field label="Trailer (YouTube link)" wide badge={by('trailerUrl')}>
          <input className={styles.input} value={v.trailerUrl} onChange={(e) => set('trailerUrl', e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
          {trailer && (
            <div className={styles.trailer}>
              <iframe src={`https://www.youtube-nocookie.com/embed/${trailer}`} title="Trailer preview" allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" />
            </div>
          )}
        </Field>
      </FormSection>

      <FormSection title="Genres & themes" hint="Tap to select.">
        <Field label={`Genres (${v.genreIds.length})`} wide>
          <div className={styles.chipWrap}>
            {opts.genres.map((g) => (
              <button key={g.id} type="button" className={v.genreIds.includes(g.id) ? styles.chipOn : styles.chip} onClick={() => toggle('genreIds', g.id)}>
                {g.name}
              </button>
            ))}
          </div>
        </Field>
        <Field label={`Themes (${v.themeIds.length})`} wide>
          <div className={styles.chipWrap}>
            {opts.themes.map((t) => (
              <button key={t.id} type="button" className={v.themeIds.includes(t.id) ? styles.chipOn : styles.chip} onClick={() => toggle('themeIds', t.id)}>
                {t.name}
              </button>
            ))}
          </div>
        </Field>
      </FormSection>

      <FormSection title="Studios" hint="The main studio gets a star; others are co-producers/animation.">
        <div className={styles.fieldWide}>
          <SearchPicker
            kind="studios"
            placeholder="Search a studio to add"
            exclude={v.studios.map((s) => s.id)}
            onPick={(s) => set('studios', [...v.studios, { id: s.id, name: s.title, isMain: v.studios.length === 0 }])}
          />
          <ul className={styles.studioRows}>
            {v.studios.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={s.isMain ? styles.starOn : styles.star}
                  onClick={() => set('studios', v.studios.map((x) => (x.id === s.id ? { ...x, isMain: !x.isMain } : x)))}
                  aria-label={s.isMain ? 'Main studio' : 'Make main studio'}
                  title={s.isMain ? 'Main studio' : 'Make main studio'}
                >
                  <Star size={15} />
                </button>
                <span>{s.name}</span>
                <small>{s.isMain ? 'Main studio' : 'Co-production'}</small>
                <button type="button" className={styles.iconBtnSm} onClick={() => set('studios', v.studios.filter((x) => x.id !== s.id))} aria-label={`Remove ${s.name}`}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </FormSection>

      <FormSection title="Where to watch" hint="Official streaming links you add. Links from AniList stay as they are.">
        <div className={styles.fieldWide}>
          {v.streaming.map((s, i) => (
            <div key={i} className={styles.streamRow}>
              <input className={styles.input} placeholder="Platform, e.g. Crunchyroll" value={s.provider} onChange={(e) => set('streaming', v.streaming.map((x, k) => (k === i ? { ...x, provider: e.target.value } : x)))} />
              <input className={styles.input} placeholder="https://…" value={s.url} onChange={(e) => set('streaming', v.streaming.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))} />
              <button type="button" className={styles.iconBtnSm} onClick={() => set('streaming', v.streaming.filter((_, k) => k !== i))} aria-label="Remove link">
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" className={styles.secondary} onClick={() => set('streaming', [...v.streaming, { provider: '', url: '' }])}>
            <Plus size={14} /> Add a link
          </button>
        </div>
      </FormSection>

      <FormSection title="Provider IDs" hint="Optional. Links the anime to AniList / MyAnimeList data.">
        <Field label="AniList ID" badge={by('anilistId')}>
          <input className={styles.input} inputMode="numeric" value={v.anilistId ?? ''} onChange={(e) => set('anilistId', num(e.target.value.replace(/\D/g, '')))} />
        </Field>
        <Field label="MyAnimeList ID" badge={by('malId')}>
          <input className={styles.input} inputMode="numeric" value={v.malId ?? ''} onChange={(e) => set('malId', num(e.target.value.replace(/\D/g, '')))} />
        </Field>
      </FormSection>

      <SaveBar busy={busy} label={id ? 'Save changes' : 'Create anime'} msg={msg} onSave={save} />
    </div>
  );
}
