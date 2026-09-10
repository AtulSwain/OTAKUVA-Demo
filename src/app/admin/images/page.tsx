'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Wrench, Image as ImageIcon } from 'lucide-react';
import styles from '../data/page.module.css';

export default function AdminImagesPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [repairing, setRepairing] = useState(false);

  async function loadImagesHealth() {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/images');
      if (res.ok) {
        const json = await res.json();
        if (json.success) setData(json.data);
      }
    } catch (e) {
      console.error('Failed to load images health:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRepair() {
    try {
      setRepairing(true);
      const res = await fetch('/api/admin/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'repair' }),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) setData(json.data);
      }
    } catch (e) {
      console.error('Repair failed:', e);
    } finally {
      setRepairing(false);
    }
  }

  useEffect(() => {
    loadImagesHealth();
  }, []);

  const totalScanned = data?.totalScanned || 0;
  const validCount = data?.validCount || 0;
  const invalidCount = data?.invalidCount || 0;
  const missingCount = data?.missingCount || 0;
  const repairedCount = data?.repairedCount || 0;
  const brokenAssets = data?.brokenAssets || [];

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link href="/admin/data" className={styles.kicker} style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <ArrowLeft size={12} />
          Back to Data Center
        </Link>
        <h1 className={styles.title}>Media Asset & Image Health Center</h1>
      </div>

      <div className={styles.grid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Scanned</span>
          <strong className={styles.metricValue}>{totalScanned.toLocaleString()}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Valid Assets</span>
          <strong className={styles.metricValue} style={{ color: '#10B981' }}>{validCount.toLocaleString()}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Invalid / Malformed</span>
          <strong className={styles.metricValue} style={{ color: invalidCount > 0 ? '#EF4444' : '#10B981' }}>{invalidCount.toLocaleString()}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Missing Artwork</span>
          <strong className={styles.metricValue} style={{ color: missingCount > 0 ? '#F59E0B' : '#10B981' }}>{missingCount.toLocaleString()}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Repaired via Pipeline</span>
          <strong className={styles.metricValue}>{repairedCount.toLocaleString()}</strong>
        </div>
      </div>

      <div className={styles.sectionBox}>
        <h2 className={styles.sectionTitle}>Image Integrity Actions</h2>
        <p style={{ color: 'var(--text-secondary, #BDBDBD)', fontSize: 13, margin: '0 0 16px 0' }}>
          Scan database records for missing or corrupted poster/banner URLs and apply high-fidelity canonical fallbacks.
        </p>

        <div className={styles.btnRow}>
          <button type="button" onClick={handleRepair} disabled={repairing} className={`${styles.btn} ${styles.btnPrimary}`}>
            <Wrench size={14} />
            <span>{repairing ? 'Repairing Assets...' : 'Auto-Repair Missing Assets'}</span>
          </button>
          <button type="button" onClick={loadImagesHealth} disabled={loading} className={styles.btn}>
            <RefreshCw size={14} />
            <span>Re-Scan Catalog</span>
          </button>
        </div>
      </div>

      {brokenAssets.length > 0 && (
        <div className={styles.sectionBox}>
          <h2 className={styles.sectionTitle}>Attention Required ({brokenAssets.length})</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {brokenAssets.map((asset: any) => (
              <div
                key={asset.id}
                style={{
                  padding: 12,
                  border: '1px solid var(--border-default, #262626)',
                  borderRadius: 6,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong style={{ fontSize: 14, color: '#F4F4F2' }}>{asset.title}</strong>
                  <div style={{ fontSize: 11, color: '#EF4444' }}>{asset.reason}</div>
                </div>
                <span style={{ fontSize: 11, color: '#777' }}>{asset.type}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
