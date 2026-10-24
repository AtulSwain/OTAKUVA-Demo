'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Database, Image as ImageIcon, Activity, RefreshCw, Layers, MessageSquare, ArrowRightLeft } from 'lucide-react';
import styles from './page.module.css';

const STATUS_CLASS: Record<string, string> = {
  HEALTHY: 'statusHealthy',
  DEGRADED: 'statusDegraded',
  DOWN: 'statusDown',
  UNKNOWN: 'statusUnknown',
};

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

  const providerFailover = data?.providerFailover || { adapters: [], recentFailoverEvents: [] };

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

      <div className={styles.sectionBox}>
        <h2 className={styles.sectionTitle}>
          <ArrowRightLeft size={16} style={{ verticalAlign: 'text-bottom', marginRight: 6 }} />
          Provider Failover
        </h2>
        <p style={{ color: 'var(--text-secondary, #BDBDBD)', fontSize: 13, margin: '0 0 16px 0' }}>
          Anime data (title/synopsis, episodes, characters, staff) is fetched through a failover chain — if the
          preferred adapter errors, times out, or comes back empty where a full record should have data, the same
          entity is automatically retried against the other registered adapter. Status below reflects each
          adapter&apos;s most recent activity, not its lifetime total.
        </p>

        <div className={styles.adapterGrid}>
          {providerFailover.adapters.length === 0 && <p className={styles.emptyState}>No provider activity recorded yet this process.</p>}
          {providerFailover.adapters.map((adapter: any) => (
            <div key={adapter.provider} className={styles.adapterCard}>
              <div className={styles.adapterHeader}>
                <span className={styles.adapterName}>{adapter.provider}</span>
                <span className={`${styles.statusBadge} ${styles[STATUS_CLASS[adapter.status] || 'statusUnknown']}`}>
                  {adapter.status}
                </span>
              </div>
              <div className={styles.adapterStats}>
                {adapter.totalCalls === 0 ? (
                  <>No calls recorded yet.</>
                ) : (
                  <>
                    {adapter.successCount}/{adapter.totalCalls} succeeded
                    {adapter.successRate !== null && <> ({Math.round(adapter.successRate * 100)}%)</>}
                    <br />
                    {adapter.failureCount} failure(s) — {adapter.timeoutCount} timeout, {adapter.incompleteCount} incomplete
                    <br />
                    {adapter.lastFailureAt && <>Last failure: {new Date(adapter.lastFailureAt).toLocaleString()}</>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #F4F4F2)', margin: '20px 0 10px 0' }}>
          Recent Failover Events
        </h3>
        <div className={styles.failoverEventList}>
          {providerFailover.recentFailoverEvents.length === 0 && (
            <p className={styles.emptyState}>No failovers recorded yet this process — every adapter has been serving its own requests directly.</p>
          )}
          {providerFailover.recentFailoverEvents.map((event: any, i: number) => (
            <div key={i} className={styles.failoverEvent}>
              <span className={styles.failoverEventTime}>{new Date(event.timestamp).toLocaleTimeString()}</span>
              <span>
                <strong>{event.method}</strong>({event.externalId}): <strong>{event.fromProvider}</strong> →{' '}
                <strong>{event.toProvider}</strong> — {event.reason} ({event.detail})
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
