'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import styles from './page.module.css';

interface UpcomingItem {
  id: string;
  slug: string;
  title: string;
  type: string;
  status: string;
  season: string | null;
  year: number | null;
  startDate: string | null;
  datePrecision: string;
  posterUrl: string;
  genres: string[];
  studios: string[];
}

export default function UpcomingPage() {
  const [confirmedList, setConfirmedList] = useState<UpcomingItem[]>([]);
  const [seasonList, setSeasonList] = useState<UpcomingItem[]>([]);
  const [yearList, setYearList] = useState<UpcomingItem[]>([]);
  const [tbaList, setTbaList] = useState<UpcomingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUpcoming() {
      try {
        setLoading(true);
        const res = await fetch('/api/upcoming');
        if (res.ok) {
          const data = await res.json();
          if (data.grouped) {
            setConfirmedList(data.grouped.confirmedDate || []);
            setSeasonList(data.grouped.seasonConfirmed || []);
            setYearList(data.grouped.yearOnly || []);
            setTbaList(data.grouped.TBA || []);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchUpcoming();
  }, []);

  const renderCard = (item: UpcomingItem) => (
    <Link href={`/anime/${item.slug || item.id}`} key={item.id} className={styles.card}>
      <div className={styles.posterWrapper}>
        {item.posterUrl ? (
          <Image
            src={item.posterUrl}
            alt={item.title}
            fill
            sizes="180px"
            className={styles.poster}
            unoptimized
          />
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#14161C' }} />
        )}
      </div>
      <div className={styles.cardContent}>
        <h4 className={styles.cardTitle}>{item.title}</h4>
        <div className={styles.cardMeta}>
          <span className={styles.tag}>{item.type}</span>
          {item.year && <span className={styles.tag}>{item.season ? `${item.season} ${item.year}` : item.year}</span>}
          {item.studios.length > 0 && <span className={styles.tag}>{typeof item.studios[0] === 'string' ? item.studios[0] : (item.studios[0] as any)?.name}</span>}
        </div>
      </div>
    </Link>
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Upcoming Anime Releases</h1>
        <p className={styles.subtitle}>
          Future anime broadcasts, confirmed release dates, announced seasons, and upcoming productions.
        </p>
      </div>

      {loading ? (
        <div style={{ color: '#8B8D98', padding: '40px 0', textAlign: 'center' }}>
          Loading upcoming release catalog...
        </div>
      ) : (
        <>
          {confirmedList.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span>Confirmed Premiere Dates</span>
                <span className={styles.countBadge}>{confirmedList.length}</span>
              </h2>
              <div className={styles.grid}>{confirmedList.map(renderCard)}</div>
            </div>
          )}

          {seasonList.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span>Upcoming Seasons</span>
                <span className={styles.countBadge}>{seasonList.length}</span>
              </h2>
              <div className={styles.grid}>{seasonList.map(renderCard)}</div>
            </div>
          )}

          {yearList.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span>Confirmed Year (Schedule TBA)</span>
                <span className={styles.countBadge}>{yearList.length}</span>
              </h2>
              <div className={styles.grid}>{yearList.map(renderCard)}</div>
            </div>
          )}

          {tbaList.length > 0 && (
            <div className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span>Announcements & In Production</span>
                <span className={styles.countBadge}>{tbaList.length}</span>
              </h2>
              <div className={styles.grid}>{tbaList.map(renderCard)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
