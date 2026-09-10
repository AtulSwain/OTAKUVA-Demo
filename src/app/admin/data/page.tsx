'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Database, Image as ImageIcon, Activity, RefreshCw, Layers, MessageSquare } from 'lucide-react';
import styles from './page.module.css';

export default function AdminDataCenterPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadDataCenter() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/data');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setData(json.data);
      }
    } catch (e) {
      console.error('Failed to fetch admin data center:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDataCenter();
  }, []);

  const catalog = data?.catalog || {
    anime: 0,
    studios: 0,
    creators: 0,
    characters: 0,
    episodes: 0,
    news: 0,
  };

  const metrics = data?.provider?.metrics || {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    status: 'HEALTHY',
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <p className={styles.kicker}>Data Operations</p>
        <h1 className={styles.title}>OTAKUVA Data Center</h1>
      </div>

      <div className={styles.grid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Canonical Anime</span>
          <strong className={styles.metricValue}>{catalog.anime.toLocaleString()}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Studios</span>
          <strong className={styles.metricValue}>{catalog.studios.toLocaleString()}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Creators & Staff</span>
          <strong className={styles.metricValue}>{catalog.creators.toLocaleString()}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Characters</span>
          <strong className={styles.metricValue}>{catalog.characters.toLocaleString()}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Episodes</span>
          <strong className={styles.metricValue}>{catalog.episodes.toLocaleString()}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>News Articles</span>
          <strong className={styles.metricValue}>{catalog.news.toLocaleString()}</strong>
        </div>
      </div>

      <div className={styles.sectionBox}>
        <h2 className={styles.sectionTitle}>External Data Providers & Ingestion</h2>
        <p style={{ color: 'var(--text-secondary, #BDBDBD)', fontSize: 13, margin: '0 0 16px 0' }}>
          Jikan v4 Provider Status: <strong>{metrics.status}</strong> • Total Ingestion Calls: <strong>{metrics.totalRequests}</strong> • Cache Hits: <strong>{metrics.cacheHits}</strong>
        </p>
        <div className={styles.btnRow}>
          <Link href="/admin/data-sources" className={`${styles.btn} ${styles.btnPrimary}`}>
            <Activity size={14} />
            <span>Data Sources & Health</span>
          </Link>
          <Link href="/admin/images" className={styles.btn}>
            <ImageIcon size={14} />
            <span>Image Health Center</span>
          </Link>
          <Link href="/admin/anime" className={styles.btn}>
            <Layers size={14} />
            <span>Manage Anime Catalog</span>
          </Link>
          <Link href="/admin/reviews" className={styles.btn}>
            <MessageSquare size={14} />
            <span>Review Moderation Queue</span>
          </Link>
          <button type="button" onClick={loadDataCenter} className={styles.btn}>
            <RefreshCw size={14} />
            <span>Refresh Metrics</span>
          </button>
        </div>
      </div>
    </div>
  );
}
