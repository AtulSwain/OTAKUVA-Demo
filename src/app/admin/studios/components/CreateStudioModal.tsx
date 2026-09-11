'use client';

import React, { useState } from 'react';
import { X, Building2, AlertTriangle, CheckCircle, Sparkles } from 'lucide-react';
import styles from '../adminStudios.module.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (studio: any) => void;
}

export function CreateStudioModal({ isOpen, onClose, onSuccess }: Props) {
  const [name, setName] = useState('');
  const [nativeName, setNativeName] = useState('');
  const [slug, setSlug] = useState('');
  const [foundedYear, setFoundedYear] = useState<string>('');
  const [status, setStatus] = useState('ACTIVE');
  const [country, setCountry] = useState('Japan');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [website, setWebsite] = useState('');
  const [about, setAbout] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Studio name is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/studios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          nativeName: nativeName.trim() || null,
          slug: slug.trim() || null,
          foundedYear: foundedYear ? parseInt(foundedYear, 10) : null,
          status,
          country: country.trim() || 'Japan',
          region: region.trim() || null,
          city: city.trim() || null,
          website: website.trim() || null,
          about: about.trim() || null,
          imageUrl: imageUrl.trim() || null,
          verificationStatus: 'UNVERIFIED',
          publicationState: 'PUBLISHED',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create studio.');
      }

      onSuccess(data.studio);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error creating studio');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard}>
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building2 color="#8b5cf6" size={22} />
            <h2 className={styles.modalTitle}>Create New Studio</h2>
          </div>
          <button aria-label="Close" className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '13px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Studio Name (Canonical) *</label>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kyoto Animation"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Native Name (Kanji / Japanese)</label>
              <input
                className={styles.input}
                value={nativeName}
                onChange={(e) => setNativeName(e.target.value)}
                placeholder="e.g. 株式会社京都アニメーション"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Custom Slug (Optional)</label>
              <input
                className={styles.input}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="Auto-generated if blank"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Founded Year</label>
              <input
                type="number"
                className={styles.input}
                value={foundedYear}
                onChange={(e) => setFoundedYear(e.target.value)}
                placeholder="e.g. 1981"
                min="1900"
                max={new Date().getFullYear() + 1}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Status</label>
              <select className={styles.select} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="CLOSED">CLOSED</option>
                <option value="MERGED">MERGED</option>
                <option value="ACQUIRED">ACQUIRED</option>
                <option value="UNKNOWN">UNKNOWN</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Country</label>
              <input
                className={styles.input}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="Japan"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Prefecture / Region</label>
              <input
                className={styles.input}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="e.g. Kyoto / Tokyo"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>City / Ward</label>
              <input
                className={styles.input}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Uji"
              />
            </div>

            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.label}>Official Website URL</label>
              <input
                type="url"
                className={styles.input}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.label}>Logo Image URL</label>
              <input
                type="url"
                className={styles.input}
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label className={styles.label}>Editorial Summary / Description</label>
              <textarea
                className={styles.textarea}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="Overview of studio heritage, style, and history..."
              />
            </div>
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className={styles.secondaryBtn} onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Studio Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
