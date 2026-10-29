'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Pencil, X } from 'lucide-react';
import { SearchPicker, type PickedAnime } from '../Pickers';
import styles from '../control.module.css';

type Pick = { day: string; animeId: string; slug: string; title: string; posterUrl: string | null; bannerUrl: string | null; headline: string | null; note: string | null };

const DAYS = 30;
const label = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

function DayEditor({ day, pick, onDone }: { day: string; pick: Pick | null; onDone: () => void }) {
  const [anime, setAnime] = useState<PickedAnime | null>(pick ? { id: pick.animeId, title: pick.title, posterUrl: pick.posterUrl } : null);
  const [headline, setHeadline] = useState(pick?.headline || '');
  const [note, setNote] = useState(pick?.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!anime) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/control/picks/${day}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ animeId: anime.id, headline, note }) });
    const out = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setError(out.error || 'Could not save.');
    else onDone();
  };
  const clear = async () => {
    setBusy(true);
    await fetch(`/api/control/picks/${day}`, { method: 'DELETE' });
    setBusy(false);
    onDone();
  };

  return (
    <div className={styles.dayEditor}>
      {anime ? (
        <div className={styles.pickedRow}>
          <span className={styles.pickerThumb}>
            {anime.posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={anime.posterUrl} alt="" />
            ) : null}
          </span>
          <strong>{anime.title}</strong>
          <button type="button" className={styles.iconBtnSm} onClick={() => setAnime(null)} aria-label="Choose another">
            <X size={14} />
          </button>
        </div>
      ) : (
        <SearchPicker placeholder="Search the anime to feature" onPick={setAnime} />
      )}
      <input className={styles.input} value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={120} placeholder="Headline (optional), e.g. “A perfect weekend binge”" />
      <textarea className={styles.textarea} rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={600} placeholder="Why it's today's pick (shown instead of the synopsis)" />
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.imageBtns}>
        <button type="button" className={styles.primary} onClick={save} disabled={busy || !anime}>
          Save pick
        </button>
        {pick && (
          <button type="button" className={styles.ghost} onClick={clear} disabled={busy}>
            Use rotation instead
          </button>
        )}
        <button type="button" className={styles.ghost} onClick={onDone}>
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Plan the homepage's daily OTAKUVA Choice spotlight. */
export default function PicksPage() {
  const [today, setToday] = useState<string | null>(null);
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch('/api/control/picks').then((r) => r.json());
    setToday(d.today);
    setPicks(Object.fromEntries((d.picks || []).map((p: Pick) => [p.day, p])));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const days = today
    ? Array.from({ length: DAYS }, (_, i) => {
        const d = new Date(`${today}T00:00:00Z`);
        d.setUTCDate(d.getUTCDate() + i);
        return d.toISOString().slice(0, 10);
      })
    : [];

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.kicker}>Editorial</p>
        <h1 className={styles.title}>OTAKUVA Choice — daily</h1>
        <p className={styles.caption}>The homepage spotlight for each day (UTC). Days without a pick rotate through your OTAKUVA Choice chart.</p>
      </header>
      <ul className={styles.dayList}>
        {days.map((day, i) => {
          const p = picks[day] || null;
          return (
            <li key={day} className={`${styles.dayRow} ${i === 0 ? styles.dayToday : ''}`}>
              <div className={styles.dayHead}>
                <span className={styles.dayDate}>
                  {i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : label.format(new Date(`${day}T00:00:00Z`))}
                </span>
                {p ? (
                  <span className={styles.dayPick}>
                    <span className={styles.pickerThumb}>
                      {p.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.posterUrl} alt="" />
                      ) : null}
                    </span>
                    <span className={styles.rowText}>
                      <strong>{p.title}</strong>
                      {p.headline && <span>{p.headline}</span>}
                    </span>
                  </span>
                ) : (
                  <span className={styles.dayAuto}>Automatic rotation</span>
                )}
                {editing !== day && (
                  <button type="button" className={styles.secondary} onClick={() => setEditing(day)}>
                    <Pencil size={13} /> {p ? 'Change' : 'Choose'}
                  </button>
                )}
              </div>
              {editing === day && (
                <DayEditor
                  day={day}
                  pick={p}
                  onDone={() => {
                    setEditing(null);
                    void load();
                  }}
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
