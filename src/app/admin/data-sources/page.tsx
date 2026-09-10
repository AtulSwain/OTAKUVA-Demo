'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import styles from '../data/page.module.css';

export default function AdminDataSourcesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  async function loadDataSources() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/data-sources');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setData(json.data);
      }
    } catch (e) {
      console.error('Failed to load data sources:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDataSources();
  }, []);

  const metrics = data?.metrics || {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    cacheHits: 0,
    rateLimitHits: 0,
    status: 'HEALTHY',
  };

  const isHealthy = metrics.status === 'HEALTHY';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/admin/data" className={styles.kicker} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft size={12} />
          Back to Data Center
        </Link>
        <h1 className={styles.title}>External Data Sources & Health</h1>
      </div>

      <div className={styles.grid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Provider Status</span>
          <strong className={styles.metricValue} style={{ color: isHealthy ? '#10B981' : '#F59E0B' }}>
            {metrics.status}
          </strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total API Invocations</span>
          <strong className={styles.metricValue}>{metrics.totalRequests.toLocaleString()}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Successful Responses</span>
          <strong className={styles.metricValue}>{metrics.successfulRequests.toLocaleString()}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Rate Limit Backoffs</span>
          <strong className={styles.metricValue}>{metrics.rateLimitHits.toLocaleString()}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Memory Cache Hits</span>
          <strong className={styles.metricValue}>{metrics.cacheHits.toLocaleString()}</strong>
        </div>
      </div>

      <div className={styles.sectionBox}>
        <h2 className={styles.sectionTitle}>Provider Configuration (Jikan v4)</h2>
        <p style={{ color: 'var(--text-secondary, #BDBDBD)', fontSize: 13, lineHeight: 1.6 }}>
          Base Endpoint: <code>{data?.baseUrl || 'https://api.jikan.moe/v4'}</code><br />
          Throttling Window: <strong>800ms per request</strong> (~2.5 req/sec)<br />
          In-Flight Request Deduplication: <strong>ACTIVE</strong><br />
          Resilience: <strong>Exponential Backoff + Retries (2x)</strong>
        </p>

        <div className={styles.btnRow}>
          <button type="button" onClick={loadDataSources} className={styles.btn}>
            <RefreshCw size={14} />
            <span>Refresh Health Status</span>
          </button>
        </div>
      </div>
    </div>
  );
}
