'use client';

import React, { useState, useEffect } from 'react';
import { X, GitMerge, AlertTriangle, CheckCircle, ArrowRight } from 'lucide-react';
import styles from '../adminStudios.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialStudioId?: string | null;
}

export function MergeStudioModal({ isOpen, onClose, onSuccess, initialStudioId }: Props) {
  const [primaryStudioId, setPrimaryStudioId] = useState(initialStudioId || '');
  const [secondaryStudioId, setSecondaryStudioId] = useState('');
  const [reason, setReason] = useState('');
  const [keepSecondaryAsAlias, setKeepSecondaryAsAlias] = useState(true);
  const [allStudios, setAllStudios] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialStudioId) setPrimaryStudioId(initialStudioId);

    async function fetchStudios() {
      try {
        const res = await fetch('/api/admin/studios?limit=100');
        if (res.ok) {
          const data = await res.json();
          setAllStudios(data.studios || []);
        }
      } catch (e) {
        console.error(e);
      }
    }
    fetchStudios();
  }, [isOpen, initialStudioId]);

  if (!isOpen) return null;

  const primaryStudio = allStudios.find((s) => s.id === primaryStudioId);
  const secondaryStudio = allStudios.find((s) => s.id === secondaryStudioId);

  const handleMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryStudioId || !secondaryStudioId) {
      setError('Please select both primary and secondary studios.');
      return;
    }
    if (primaryStudioId === secondaryStudioId) {
      setError('Cannot merge a studio into itself.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 5) {
      setError('A descriptive reason is required for audit records.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/studios/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryStudioId,
          secondaryStudioId,
          reason: reason.trim(),
          keepSecondaryAsAlias,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to merge studios.');

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard} style={{ maxWidth: '640px' }}>
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <GitMerge color="#ec4899" size={24} />
            <h2 className={styles.modalTitle}>Safe Studio Merge Tool</h2>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div style={{ background: 'rgba(236, 72, 153, 0.1)', border: '1px solid rgba(236, 72, 153, 0.25)', borderRadius: '10px', padding: '14px', fontSize: '13px', color: '#f472b6' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '4px' }}>
            <AlertTriangle size={16} /> Non-Destructive Merge Notice
          </div>
          Merging migrates all associated anime productions, founder relationships, and news references from the secondary studio into the canonical primary record. The secondary studio will be archived and preserved for audit traceability.
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleMerge} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className={styles.formGroup}>
            <label className={styles.label}>1. Canonical Primary Studio (Retained) *</label>
            <select
              className={styles.select}
              value={primaryStudioId}
              onChange={(e) => setPrimaryStudioId(e.target.value)}
              required
            >
              <option value="">-- Select Canonical Studio --</option>
              {allStudios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.totalAnimeCount} anime) [{s.status}]
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>2. Duplicate Secondary Studio (Merged & Archived) *</label>
            <select
              className={styles.select}
              value={secondaryStudioId}
              onChange={(e) => setSecondaryStudioId(e.target.value)}
              required
            >
              <option value="">-- Select Secondary Studio --</option>
              {allStudios
                .filter((s) => s.id !== primaryStudioId)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.totalAnimeCount} anime) [{s.status}]
                  </option>
                ))}
            </select>
          </div>

          {primaryStudio && secondaryStudio && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '14px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#f87171' }}>{secondaryStudio.name}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>{secondaryStudio.totalAnimeCount} anime</div>
              </div>
              <ArrowRight color="#ec4899" size={20} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, color: '#4ade80' }}>{primaryStudio.name}</div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>{primaryStudio.totalAnimeCount} anime</div>
              </div>
            </div>
          )}

          <div className={styles.formGroup}>
            <label className={styles.label}>Audit Reason for Merge *</label>
            <input
              className={styles.input}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Duplicate entry created from external API sync"
              required
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#cbd5e1' }}>
            <input
              type="checkbox"
              checked={keepSecondaryAsAlias}
              onChange={(e) => setKeepSecondaryAsAlias(e.target.checked)}
            />
            Keep secondary studio name as search alias on primary studio
          </label>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={isSubmitting} style={{ background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)' }}>
              {isSubmitting ? 'Merging...' : 'Confirm Safe Merge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
