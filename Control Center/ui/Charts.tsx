import React from 'react';
import Link from 'next/link';
import styles from './control.module.css';

const fmt = new Intl.NumberFormat('en-US');
const dayLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export type Kpi = { label: string; value: number | string; note?: string; tone?: 'good' | 'warn' };

/** A row of big numbers. */
export function KpiGrid({ items }: { items: Kpi[] }) {
  return (
    <div className={styles.stats}>
      {items.map((k) => (
        <div key={k.label} className={styles.stat}>
          <span className={styles.statLabel}>{k.label}</span>
          <strong className={`${styles.statValue} ${k.tone === 'good' ? styles.toneGood : k.tone === 'warn' ? styles.toneWarn : ''}`}>
            {typeof k.value === 'number' ? fmt.format(k.value) : k.value}
          </strong>
          {k.note && <span className={styles.statNote}>{k.note}</span>}
        </div>
      ))}
    </div>
  );
}

/** Daily bars (one per day), total in the title, hover for the exact day. */
export function DayBars({ title, points, unit, empty }: { title: string; points: { day: string; value: number }[]; unit: string; empty?: string }) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const sum = points.reduce((a, p) => a + p.value, 0);
  const step = points.length > 31 ? 14 : points.length > 14 ? 7 : 2;
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h3>{title}</h3>
        <span className={styles.rankCount}>
          {fmt.format(sum)} <small>{unit}</small>
        </span>
      </div>
      {sum === 0 && empty ? (
        <p className={styles.caption}>{empty}</p>
      ) : (
        <div className={styles.dayBars} style={{ ['--cols' as string]: points.length }}>
          {points.map((p, i) => (
            <div key={p.day} className={styles.dayBar} title={`${dayLabel.format(new Date(`${p.day}T00:00:00Z`))}: ${fmt.format(p.value)} ${unit}`}>
              <span style={{ height: `${p.value ? Math.max(4, (p.value / max) * 100) : 2}%` }} data-zero={p.value === 0 || undefined} />
              <small>{(points.length - 1 - i) % step === 0 ? dayLabel.format(new Date(`${p.day}T00:00:00Z`)) : ''}</small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type RankItem = { id?: string; label: string; sub?: string | null; href?: string | null; image?: string | null; value: number; extra?: number };

/** Horizontal bars, biggest first. `format` turns the value into text (e.g. a %). */
export function RankBars({
  title,
  items,
  unit,
  empty = 'No data yet.',
  format,
  extraLabel,
}: {
  title: string;
  items: RankItem[];
  unit?: string;
  empty?: string;
  format?: (v: number) => string;
  extraLabel?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className={styles.panel}>
      <div className={styles.panelHead}>
        <h3>{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className={styles.caption}>{empty}</p>
      ) : (
        <ol className={styles.hbars}>
          {items.map((it, i) => {
            const body = (
              <>
                {it.image !== undefined && (
                  <span className={styles.hbarThumb}>
                    {it.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.image} alt="" loading="lazy" />
                    ) : null}
                  </span>
                )}
                <span className={styles.hbarText}>
                  <span className={styles.hbarLabel}>
                    <strong>{it.label}</strong>
                    <em>
                      {format ? format(it.value) : fmt.format(it.value)}
                      {unit ? ` ${it.value === 1 ? unit.replace(/s$/, '') : unit}` : ''}
                      {extraLabel && it.extra !== undefined ? ` · ${fmt.format(it.extra)} ${extraLabel}` : ''}
                    </em>
                  </span>
                  {it.sub && <span className={styles.hbarSub}>{it.sub}</span>}
                  <span className={styles.hbarTrack}>
                    <span style={{ width: `${Math.max(2, (it.value / max) * 100)}%` }} />
                  </span>
                </span>
              </>
            );
            return (
              <li key={it.id ?? `${it.label}-${i}`}>
                {it.href ? (
                  <Link href={it.href} className={styles.hbarRow}>
                    {body}
                  </Link>
                ) : (
                  <div className={styles.hbarRow}>{body}</div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

/** 7 / 30 / 90-day switch (plain links, works without JavaScript). */
export function RangeTabs({ base, days }: { base: string; days: number }) {
  return (
    <div className={styles.chips} role="group" aria-label="Time range">
      {[7, 30, 90].map((d) => (
        <Link key={d} href={`${base}?days=${d}`} className={days === d ? styles.chipOn : styles.chip} style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
          Last {d} days
        </Link>
      ))}
    </div>
  );
}

/** Two or three panels side by side (stacked on phones). */
export function PanelRow({ children }: { children: React.ReactNode }) {
  return <div className={styles.panels}>{children}</div>;
}
