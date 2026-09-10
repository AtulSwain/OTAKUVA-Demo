'use client';

import React, { useState, useEffect } from 'react';
import { ImportJobState } from '../../../lib/ingestion/jikanImportJob';

export default function AdminAnimeDashboardPage() {
  const [job, setJob] = useState<ImportJobState | null>(null);
  const [metrics, setMetrics] = useState<any>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [startPageInput, setStartPageInput] = useState('1');

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/admin/anime/import');
      if (res.ok) {
        const data = await res.json();
        setJob(data.job);
        setMetrics(data.catalogMetrics || {});
      }
    } catch (e) {
      console.error('Failed to load admin anime status:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (action: 'start' | 'resume' | 'stop' | 'reset') => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/admin/anime/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          startPage: parseInt(startPageInput, 10) || 1,
          maxPages: 5,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setJob(data.job);
      }
    } catch (e) {
      console.error('Action failed:', e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '32px 24px 60px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      <div>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#EDEDEF', textTransform: 'uppercase' }}>
          ADMIN / ANIME CATALOG & JIKAN INGESTION
        </h1>
        <p style={{ fontSize: '13px', color: '#A1A1AA', marginTop: '4px' }}>
          Manage canonical anime records, trigger rate-limited Jikan v4 imports, and monitor ingestion progress.
        </p>
      </div>

      {/* Catalog Metric Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '14px',
        }}
      >
        <div style={{ background: '#18181B', border: '1px solid #2A2A2E', borderRadius: '8px', padding: '16px' }}>
          <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase', fontWeight: 600 }}>
            Total Canonical Anime
          </span>
          <p style={{ fontSize: '28px', fontWeight: 800, color: '#EDEDEF', marginTop: '4px' }}>
            {metrics.totalAnime ?? '...'}
          </p>
        </div>
        <div style={{ background: '#18181B', border: '1px solid #2A2A2E', borderRadius: '8px', padding: '16px' }}>
          <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase', fontWeight: 600 }}>
            Canonical Studios
          </span>
          <p style={{ fontSize: '28px', fontWeight: 800, color: '#818CF8', marginTop: '4px' }}>
            {metrics.totalStudios ?? '...'}
          </p>
        </div>
        <div style={{ background: '#18181B', border: '1px solid #2A2A2E', borderRadius: '8px', padding: '16px' }}>
          <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase', fontWeight: 600 }}>
            Creators & Staff
          </span>
          <p style={{ fontSize: '28px', fontWeight: 800, color: '#10B981', marginTop: '4px' }}>
            {metrics.totalCreators ?? '...'}
          </p>
        </div>
        <div style={{ background: '#18181B', border: '1px solid #2A2A2E', borderRadius: '8px', padding: '16px' }}>
          <span style={{ fontSize: '11px', color: '#71717A', textTransform: 'uppercase', fontWeight: 600 }}>
            Characters & Cast
          </span>
          <p style={{ fontSize: '28px', fontWeight: 800, color: '#F59E0B', marginTop: '4px' }}>
            {metrics.totalCharacters ?? '...'}
          </p>
        </div>
      </div>

      {/* Jikan Ingestion Job Card */}
      <div
        style={{
          background: '#18181B',
          border: '1px solid #2A2A2E',
          borderRadius: '10px',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#EDEDEF' }}>Jikan v4 Ingestion Job Engine</h2>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor:
                job?.status === 'RUNNING'
                  ? 'rgba(99, 102, 241, 0.2)'
                  : job?.status === 'COMPLETED'
                  ? 'rgba(16, 185, 129, 0.2)'
                  : '#27272B',
              color:
                job?.status === 'RUNNING'
                  ? '#818CF8'
                  : job?.status === 'COMPLETED'
                  ? '#10B981'
                  : '#A1A1AA',
            }}
          >
            STATUS: {job?.status || 'IDLE'}
          </span>
        </div>

        {/* Progress Bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#A1A1AA', marginBottom: '6px' }}>
            <span>Progress: {job?.progressPercent || 0}%</span>
            <span>Current Checkpoint: Page {job?.currentPage || 1}</span>
          </div>
          <div style={{ width: '100%', height: '8px', background: '#202024', borderRadius: '4px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${job?.progressPercent || 0}%`,
                height: '100%',
                background: '#6366F1',
                transition: 'width 300ms ease',
              }}
            />
          </div>
        </div>

        {/* Job Metrics Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '10px',
            backgroundColor: '#202024',
            padding: '12px 14px',
            borderRadius: '6px',
            fontSize: '12px',
          }}
        >
          <div>
            <span style={{ color: '#71717A' }}>Processed Anime:</span>{' '}
            <strong style={{ color: '#EDEDEF' }}>{job?.processedAnime || 0}</strong>
          </div>
          <div>
            <span style={{ color: '#71717A' }}>Inserted/Upserted:</span>{' '}
            <strong style={{ color: '#10B981' }}>{job?.insertedAnime || 0}</strong>
          </div>
          <div>
            <span style={{ color: '#71717A' }}>Failed Records:</span>{' '}
            <strong style={{ color: '#EF4444' }}>{job?.failedAnime || 0}</strong>
          </div>
          <div>
            <span style={{ color: '#71717A' }}>Failed Pages:</span>{' '}
            <strong style={{ color: '#F59E0B' }}>{job?.failedPages?.length || 0}</strong>
          </div>
        </div>

        {/* Action Buttons & Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', color: '#A1A1AA' }}>Start Page:</span>
            <input
              type="number"
              min="1"
              value={startPageInput}
              onChange={(e) => setStartPageInput(e.target.value)}
              style={{
                width: '70px',
                padding: '6px 8px',
                background: '#202024',
                border: '1px solid #2A2A2E',
                borderRadius: '4px',
                color: '#EDEDEF',
                fontSize: '13px',
              }}
            />
          </div>

          <button
            type="button"
            disabled={isProcessing || job?.status === 'RUNNING'}
            onClick={() => handleAction('start')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6366F1',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              opacity: isProcessing || job?.status === 'RUNNING' ? 0.5 : 1,
            }}
          >
            Start / Resume Ingestion Batch (5 Pages)
          </button>

          <button
            type="button"
            disabled={isProcessing || job?.status !== 'RUNNING'}
            onClick={() => handleAction('stop')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#27272B',
              color: '#EDEDEF',
              border: '1px solid #2A2A2E',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Pause Job
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => handleAction('reset')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#27272B',
              color: '#EF4444',
              border: '1px solid #2A2A2E',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reset State
          </button>
        </div>
      </div>
    </div>
  );
}
