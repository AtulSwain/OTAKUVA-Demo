'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Eye } from 'lucide-react';
import type { AnimeFacts } from '../../lib/anime/animeFacts';
import styles from './AnimeDetails.module.css';

// Server-safe date (fixed locale + UTC): this renders on the server first.
function formatDate(iso: string | null, precision: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const opts: Intl.DateTimeFormatOptions =
    precision === 'YEAR'
      ? { year: 'numeric', timeZone: 'UTC' }
      : precision === 'MONTH'
        ? { month: 'short', year: 'numeric', timeZone: 'UTC' }
        : { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
  return d.toLocaleDateString('en-US', opts);
}

const fmt = (n: number | null | undefined) => (typeof n === 'number' ? n.toLocaleString('en-US') : null);
const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  if (children === null || children === undefined || children === false || children === '') return null;
  return (
    <div className={styles.row}>
      <dt className={styles.label}>{label}</dt>
      <dd className={styles.value}>{children}</dd>
    </div>
  );
}

/**
 * The full fact sheet for an anime: every stored detail the hero and
 * overview don't already show. Rows with no data are simply absent.
 */
export function AnimeDetails({ facts }: { facts: AnimeFacts }) {
  const [showSpoilerTags, setShowSpoilerTags] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);
  // The next-episode time is shown in the viewer's timezone, which the
  // server can't know — localise after mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { titles, release, stats } = facts;
  const aired = (() => {
    const from = formatDate(release.airedFrom, release.datePrecision);
    const to = formatDate(release.airedTo, release.datePrecision);
    if (!from) return null;
    if (!to || to === from) return release.status && /airing|releasing/i.test(release.status) ? `${from} – present` : from;
    return `${from} – ${to}`;
  })();
  const broadcast = release.broadcast
    ? [release.broadcast.day, release.broadcast.time, release.broadcast.timezone ? `(${release.broadcast.timezone})` : null]
        .filter(Boolean)
        .join(' ')
    : null;
  const nextEp = release.nextEpisode
    ? mounted
      ? `Episode ${release.nextEpisode.number} · ${new Date(release.nextEpisode.at).toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })}`
      : `Episode ${release.nextEpisode.number}`
    : null;

  const visibleTags = facts.tags.filter((t) => showSpoilerTags || !t.isSpoiler);
  const hiddenSpoilers = facts.tags.filter((t) => t.isSpoiler).length;
  const tagsShown = showAllTags ? visibleTags : visibleTags.slice(0, 14);
  const hasTitles = titles.english.length + titles.japanese.length + titles.romaji.length + titles.synonyms.length > 0;

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h2 className={styles.title}>Details</h2>
      </div>

      <div className={styles.grid}>
        <section className={styles.group} aria-labelledby="facts-release">
          <h3 id="facts-release" className={styles.groupTitle}>Release</h3>
          <dl className={styles.list}>
            <Row label="Format">{release.type}</Row>
            <Row label="Episodes">{fmt(release.episodes)}</Row>
            <Row label="Duration">{release.duration}</Row>
            <Row label="Status">{release.status}</Row>
            <Row label="Aired">{aired}</Row>
            <Row label="Season">{release.season && release.seasonYear ? `${titleCase(release.season)} ${release.seasonYear}` : null}</Row>
            <Row label="Broadcast">{broadcast}</Row>
            <Row label="Next episode">{nextEp}</Row>
            <Row label="Source">{release.source}</Row>
            <Row label="Country">{release.country}</Row>
            <Row label="Age rating">{release.ageRating}</Row>
          </dl>
        </section>

        <section className={styles.group} aria-labelledby="facts-production">
          <h3 id="facts-production" className={styles.groupTitle}>Production</h3>
          <dl className={styles.list}>
            <Row label={facts.studios.length === 1 ? 'Studio' : 'Studios'}>
              {facts.studios.length > 0 &&
                facts.studios.map((s, i) => (
                  <React.Fragment key={s.name}>
                    {i > 0 && ', '}
                    {s.slug ? (
                      <Link href={`/studios/${s.slug}`} className={styles.link}>
                        {s.name}
                      </Link>
                    ) : (
                      s.name
                    )}
                  </React.Fragment>
                ))}
            </Row>
            <Row label="Producers">
              {facts.producers.length > 0 &&
                facts.producers.map((p, i) => (
                  <React.Fragment key={p.name}>
                    {i > 0 && ', '}
                    {p.slug ? (
                      <Link href={`/producer/${p.slug}`} className={styles.link}>
                        {p.name}
                      </Link>
                    ) : (
                      p.name
                    )}
                  </React.Fragment>
                ))}
            </Row>
          </dl>

          {stats && (
            <>
              <h3 className={`${styles.groupTitle} ${styles.groupTitleSpaced}`}>On {stats.provider}</h3>
              <dl className={styles.list}>
                <Row label="Score">
                  {typeof stats.score === 'number'
                    ? `${stats.score.toFixed(2)}${stats.scoredBy ? ` · ${fmt(stats.scoredBy)} votes` : ''}`
                    : null}
                </Row>
                <Row label="Ranked">{stats.rank ? `#${fmt(stats.rank)}` : null}</Row>
                <Row label="Popularity">
                  {stats.popularity ? (stats.popularityIsRank ? `#${fmt(stats.popularity)}` : `${fmt(stats.popularity)} users`) : null}
                </Row>
                <Row label="Members">{fmt(stats.members)}</Row>
                <Row label="Favorites">{fmt(stats.favorites)}</Row>
              </dl>
            </>
          )}
        </section>

        {hasTitles && (
          <section className={styles.group} aria-labelledby="facts-titles">
            <h3 id="facts-titles" className={styles.groupTitle}>Titles</h3>
            <dl className={styles.list}>
              <Row label="English">{titles.english.join(' · ') || null}</Row>
              <Row label="Japanese">{titles.japanese.join(' · ') || null}</Row>
              <Row label="Romaji">{titles.romaji.join(' · ') || null}</Row>
              <Row label="Also known as">{titles.synonyms.join(' · ') || null}</Row>
            </dl>
          </section>
        )}
      </div>

      {(facts.themes.length > 0 || facts.tags.length > 0) && (
        <section className={styles.group} aria-labelledby="facts-tags">
          <h3 id="facts-tags" className={styles.groupTitle}>Themes &amp; tags</h3>
          <ul className={styles.chips}>
            {facts.themes.map((t) => (
              <li key={`th-${t.slug}`}>
                <Link href={`/theme/${t.slug}`} className={`${styles.chip} ${styles.chipTheme}`}>
                  {t.name}
                </Link>
              </li>
            ))}
            {tagsShown.map((t) => (
              <li key={`tg-${t.name}`}>
                <span className={`${styles.chip} ${t.isSpoiler ? styles.chipSpoiler : ''}`} title={t.description ?? undefined}>
                  {t.name}
                  {typeof t.rank === 'number' && t.rank > 0 && <span className={styles.chipRank}>{t.rank}%</span>}
                </span>
              </li>
            ))}
          </ul>
          <div className={styles.tagActions}>
            {visibleTags.length > 14 && (
              <button type="button" className={styles.textBtn} onClick={() => setShowAllTags((v) => !v)}>
                {showAllTags ? 'Show fewer tags' : `Show all ${visibleTags.length} tags`}
              </button>
            )}
            {hiddenSpoilers > 0 && (
              <button type="button" className={styles.textBtn} onClick={() => setShowSpoilerTags((v) => !v)}>
                <Eye size={13} aria-hidden="true" />
                {showSpoilerTags ? 'Hide spoiler tags' : `Show ${hiddenSpoilers} spoiler tag${hiddenSpoilers === 1 ? '' : 's'}`}
              </button>
            )}
          </div>
          {facts.tags.length > 0 && <p className={styles.note}>Tag relevance from AniList.</p>}
        </section>
      )}

      {facts.background && (
        <section className={styles.group} aria-labelledby="facts-background">
          <h3 id="facts-background" className={styles.groupTitle}>Background</h3>
          <p className={styles.background}>{facts.background}</p>
        </section>
      )}

      {facts.links.length > 0 && (
        <div className={styles.links}>
          {facts.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className={styles.extLink}>
              {l.label} <ExternalLink size={12} aria-hidden="true" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
