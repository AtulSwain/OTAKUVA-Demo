'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  GitCompare,
  X,
  Building2,
  Trophy,
  Film,
  Users,
  Star,
  Tag,
  Newspaper,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import styles from '../adminStudios.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialStudioId?: string | null;
  studios: Array<{ id: string; name: string }>;
}

export function StudioComparisonModal({ isOpen, onClose, initialStudioId, studios }: Props) {
  const [studioAId, setStudioAId] = useState<string>(initialStudioId || (studios[0]?.id || ''));
  const [studioBId, setStudioBId] = useState<string>(studios[1]?.id || studios[0]?.id || '');
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialStudioId) {
      setStudioAId(initialStudioId);
    }
  }, [initialStudioId]);

  const handleCompare = useCallback(async () => {
    if (!studioAId || !studioBId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/studios/compare?studioA=${studioAId}&studioB=${studioBId}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to compare studios');
      }
      const data = await res.json();
      setComparison(data.comparison);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [studioAId, studioBId]);

  useEffect(() => {
    if (isOpen && studioAId && studioBId) {
      handleCompare();
    }
  }, [isOpen, studioAId, studioBId, handleCompare]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.modalCard}
        style={{ maxWidth: '980px', width: '95%', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GitCompare size={20} color="#3b82f6" />
            <div>
              <h3 className={styles.modalTitle}>Studio Intelligence Comparative Analysis</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
                Side-by-side production, rating, genre, staff, community, and data health comparison
              </p>
            </div>
          </div>
          <button aria-label="Close" type="button" className={styles.closeBtn} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Selectors Bar */}
        <div
          style={{
            padding: '12px 18px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
              Studio A
            </label>
            <select
              value={studioAId}
              onChange={(e) => setStudioAId(e.target.value)}
              className={styles.input}
              style={{ fontSize: '13px', padding: '6px 10px' }}
            >
              {studios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', paddingTop: '16px' }}>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>VS</span>
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
              Studio B
            </label>
            <select
              value={studioBId}
              onChange={(e) => setStudioBId(e.target.value)}
              className={styles.input}
              style={{ fontSize: '13px', padding: '6px 10px' }}
            >
              {studios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Body Content */}
        <div style={{ padding: '18px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
              Aggregating comparative intelligence metrics...
            </div>
          ) : error ? (
            <div style={{ color: '#f87171', padding: '20px' }}>{error}</div>
          ) : comparison ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Leader Banner */}
              <div
                style={{
                  padding: '12px 16px',
                  background: 'rgba(59, 130, 246, 0.12)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                  fontSize: '12.5px',
                  color: '#93c5fd',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Trophy size={16} color="#fbbf24" />
                  <span>
                    Highest Average Score:{' '}
                    <strong>{comparison.comparisonSummary.scoreLeader || 'Tie / Insufficient Ratings'}</strong>
                  </span>
                </div>
                <div>
                  Largest Catalog:{' '}
                  <strong>{comparison.comparisonSummary.catalogSizeLeader || 'Equal Size'}</strong>
                </div>
                {comparison.comparisonSummary.sharedStaffCount > 0 && (
                  <div>
                    Shared Staff: <strong>{comparison.comparisonSummary.sharedStaffCount} Creators</strong>
                  </div>
                )}
              </div>

              {/* Side-by-Side Comparison Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                {/* Studio A Card */}
                <div
                  style={{
                    padding: '16px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={styles.logoThumb} style={{ width: '42px', height: '42px' }}>
                      {comparison.studioA.imageUrl ? (
                        <Image
                          src={comparison.studioA.imageUrl}
                          alt={comparison.studioA.name}
                          width={42}
                          height={42}
                          unoptimized
                          className={styles.logoImg}
                        />
                      ) : (
                        <Building2 size={20} color="#64748b" />
                      )}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', color: '#ffffff' }}>{comparison.studioA.name}</h4>
                      <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                        {comparison.studioA.foundedYear ? `${comparison.studioA.foundedYear} · ` : ''}
                        {comparison.studioA.country || 'Japan'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '6px' }}>
                    <div style={{ padding: '8px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total Works</span>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                        {comparison.studioA.totalWorks}
                      </div>
                    </div>
                    <div style={{ padding: '8px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Avg Score</span>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#4ade80' }}>
                        {comparison.studioA.averageScore ? `★ ${comparison.studioA.averageScore}` : '—'}
                      </div>
                    </div>
                    <div style={{ padding: '8px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>TV / Movie Split</span>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>
                        {comparison.studioA.tvCount} TV · {comparison.studioA.movieCount} Movie
                      </div>
                    </div>
                    <div style={{ padding: '8px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Data Health</span>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8' }}>
                        {comparison.studioA.completenessScore}% Completeness
                      </div>
                    </div>
                  </div>

                  {/* Top Genres */}
                  <div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Top Genres:
                    </span>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {comparison.studioA.topGenres.map((g: string) => (
                        <span
                          key={g}
                          style={{
                            padding: '2px 8px',
                            background: 'rgba(161, 161, 170, 0.15)',
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: '#c4b5fd',
                          }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Studio B Card */}
                <div
                  style={{
                    padding: '16px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div className={styles.logoThumb} style={{ width: '42px', height: '42px' }}>
                      {comparison.studioB.imageUrl ? (
                        <Image
                          src={comparison.studioB.imageUrl}
                          alt={comparison.studioB.name}
                          width={42}
                          height={42}
                          unoptimized
                          className={styles.logoImg}
                        />
                      ) : (
                        <Building2 size={20} color="#64748b" />
                      )}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', color: '#ffffff' }}>{comparison.studioB.name}</h4>
                      <span style={{ fontSize: '11.5px', color: '#94a3b8' }}>
                        {comparison.studioB.foundedYear ? `${comparison.studioB.foundedYear} · ` : ''}
                        {comparison.studioB.country || 'Japan'}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '6px' }}>
                    <div style={{ padding: '8px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total Works</span>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#ffffff' }}>
                        {comparison.studioB.totalWorks}
                      </div>
                    </div>
                    <div style={{ padding: '8px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Avg Score</span>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: '#4ade80' }}>
                        {comparison.studioB.averageScore ? `★ ${comparison.studioB.averageScore}` : '—'}
                      </div>
                    </div>
                    <div style={{ padding: '8px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>TV / Movie Split</span>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#cbd5e1' }}>
                        {comparison.studioB.tvCount} TV · {comparison.studioB.movieCount} Movie
                      </div>
                    </div>
                    <div style={{ padding: '8px', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Data Health</span>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: '#38bdf8' }}>
                        {comparison.studioB.completenessScore}% Completeness
                      </div>
                    </div>
                  </div>

                  {/* Top Genres */}
                  <div>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginBottom: '4px' }}>
                      Top Genres:
                    </span>
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {comparison.studioB.topGenres.map((g: string) => (
                        <span
                          key={g}
                          style={{
                            padding: '2px 8px',
                            background: 'rgba(161, 161, 170, 0.15)',
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: '#c4b5fd',
                          }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
