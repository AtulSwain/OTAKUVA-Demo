'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Building2,
  Sliders,
  Film,
  Users,
  Image as ImageIcon,
  History,
  Trash2,
  Plus,
  RotateCcw,
  Check,
  ExternalLink,
  Upload,
} from 'lucide-react';
import styles from '../adminStudios.module.css';
import { StudioHistoryTab } from './StudioHistoryTab';

interface Props {
  studioId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditStudioModal({ studioId, isOpen, onClose, onSuccess }: Props) {
  const [activeTab, setActiveTab] = useState<'METADATA' | 'HISTORY' | 'OVERRIDES' | 'ANIME' | 'STAFF' | 'MEDIA' | 'MEDIA_GALLERY' | 'ANALYTICS' | 'DATA_HEALTH' | 'COMMUNITIES' | 'VERSIONS' | 'AUDIT'>('METADATA');
  const [studio, setStudio] = useState<any>(null);
  const [studioAnalytics, setStudioAnalytics] = useState<any>(null);
  const [studioHealth, setStudioHealth] = useState<any>(null);
  const [studioCommunities, setStudioCommunities] = useState<any[]>([]);
  const [studioVersions, setStudioVersions] = useState<any[]>([]);
  const [studioMediaItems, setStudioMediaItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states for Metadata
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
  const [verificationStatus, setVerificationStatus] = useState('UNVERIFIED');
  const [publicationState, setPublicationState] = useState('PUBLISHED');

  // Form states for Overrides
  const [overrideName, setOverrideName] = useState('');
  const [overrideAbout, setOverrideAbout] = useState('');
  const [overrideYear, setOverrideYear] = useState<string>('');
  const [overrideWebsite, setOverrideWebsite] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  // Anime Search & Link
  const [animeQuery, setAnimeQuery] = useState('');
  const [animeResults, setAnimeResults] = useState<any[]>([]);
  const [selectedAnimeId, setSelectedAnimeId] = useState('');
  const [selectedAnimeRole, setSelectedAnimeRole] = useState('MAIN_STUDIO');
  const [isPrimaryAnime, setIsPrimaryAnime] = useState(true);

  // Staff Link
  const [staffName, setStaffName] = useState('');
  const [staffRole, setStaffRole] = useState('FOUNDER');
  const [staffNotes, setStaffNotes] = useState('');

  // File Upload
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState<'LOGO' | 'BANNER'>('LOGO');

  useEffect(() => {
    if (!studioId || !isOpen) return;

    async function loadStudio() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/studios/${studioId}`);
        if (!res.ok) throw new Error('Failed to load studio details.');
        const data = await res.json();
        const s = data.studio;
        setStudio(s);

        setName(s.name || '');
        setNativeName(s.nativeName || '');
        setSlug(s.slug || '');
        setFoundedYear(s.foundedYear ? String(s.foundedYear) : '');
        setStatus(s.status || 'ACTIVE');
        setCountry(s.country || 'Japan');
        setRegion(s.region || '');
        setCity(s.city || '');
        setWebsite(s.website || '');
        setAbout(s.about || '');
        setVerificationStatus(s.verificationStatus || 'UNVERIFIED');
        setPublicationState(s.publicationState || 'PUBLISHED');

        setOverrideName(s.adminOverrideName || '');
        setOverrideAbout(s.adminOverrideDescription || '');
        setOverrideYear(s.adminOverrideFoundedYear ? String(s.adminOverrideFoundedYear) : '');
        setOverrideWebsite(s.adminOverrideWebsite || '');
      } catch (err: any) {
        setError(err.message || 'Error loading studio');
      } finally {
        setIsLoading(false);
      }
    }

    loadStudio();
  }, [studioId, isOpen]);

  // Handle Anime Search
  useEffect(() => {
    if (!animeQuery.trim()) {
      setAnimeResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/anime?q=${encodeURIComponent(animeQuery.trim())}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          setAnimeResults(data.anime || data.results || []);
        }
      } catch (e) {
        console.error(e);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [animeQuery]);

  if (!isOpen) return null;

  const handleSaveMetadata = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studioId) return;
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/admin/studios/${studioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          nativeName: nativeName.trim() || null,
          slug: slug.trim() || null,
          foundedYear: foundedYear ? parseInt(foundedYear, 10) : null,
          status,
          country: country.trim() || null,
          region: region.trim() || null,
          city: city.trim() || null,
          website: website.trim() || null,
          about: about.trim() || null,
          verificationStatus,
          publicationState,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save metadata');

      setSuccessMsg('Studio metadata updated successfully!');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studioId) return;
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/studios/${studioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isOverrideAction: true,
          action: 'APPLY',
          overrides: {
            name: overrideName.trim() || null,
            about: overrideAbout.trim() || null,
            foundedYear: overrideYear ? parseInt(overrideYear, 10) : null,
            website: overrideWebsite.trim() || null,
            overrideReason: overrideReason.trim() || 'Admin editorial override',
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply override');

      setSuccessMsg('Editorial overrides applied!');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetOverride = async () => {
    if (!studioId) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/studios/${studioId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isOverrideAction: true,
          action: 'RESET',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset override');
      setOverrideName('');
      setOverrideAbout('');
      setOverrideYear('');
      setOverrideWebsite('');
      setSuccessMsg('Overrides reset to normalized provider data.');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLinkAnime = async () => {
    if (!studioId || !selectedAnimeId) return;
    try {
      const res = await fetch(`/api/admin/studios/${studioId}/anime`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          animeId: selectedAnimeId,
          role: selectedAnimeRole,
          isPrimary: isPrimaryAnime,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to link anime');
      setSelectedAnimeId('');
      setAnimeQuery('');
      setSuccessMsg('Anime linked successfully.');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUnlinkAnime = async (animeId: string) => {
    if (!studioId) return;
    try {
      const res = await fetch(`/api/admin/studios/${studioId}/anime?animeId=${animeId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to unlink anime');
      setSuccessMsg('Anime unlinked.');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleUploadImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studioId || !selectedFile) return;
    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('imageType', uploadType);

      const res = await fetch(`/api/admin/studios/${studioId}/image`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to upload image');
      setSuccessMsg(`${uploadType} uploaded successfully!`);
      setSelectedFile(null);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalCard} style={{ maxWidth: '820px' }}>
        <div className={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Building2 color="#8b5cf6" size={24} />
            <div>
              <h2 className={styles.modalTitle}>{studio?.name || 'Edit Studio'}</h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>ID: {studio?.id}</span>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={styles.tabNav}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'METADATA' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('METADATA')}
          >
            Profile & Metadata
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'HISTORY' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('HISTORY')}
          >
            History & Timeline
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'OVERRIDES' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('OVERRIDES')}
          >
            Admin Overrides
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'ANIME' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('ANIME')}
          >
            Anime Productions ({studio?.projects?.length || 0})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'STAFF' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('STAFF')}
          >
            Founders & Staff ({studio?.staff?.length || 0})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'MEDIA' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('MEDIA')}
          >
            Branding & Images
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'ANALYTICS' ? styles.activeTab : ''}`}
            onClick={async () => {
              setActiveTab('ANALYTICS');
              if (studioId && !studioAnalytics) {
                try {
                  const res = await fetch(`/api/admin/studios/${studioId}/analytics`);
                  if (res.ok) {
                    const data = await res.json();
                    setStudioAnalytics(data);
                  }
                } catch (e) {
                  console.error(e);
                }
              }
            }}
          >
            Analytics & Insights
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'COMMUNITIES' ? styles.activeTab : ''}`}
            onClick={async () => {
              setActiveTab('COMMUNITIES');
              if (studioId) {
                try {
                  const res = await fetch(`/api/admin/studios/${studioId}/communities`);
                  if (res.ok) {
                    const data = await res.json();
                    setStudioCommunities(data.communities || []);
                  }
                } catch (e) {
                  console.error(e);
                }
              }
            }}
          >
            Communities
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'DATA_HEALTH' ? styles.activeTab : ''}`}
            onClick={async () => {
              setActiveTab('DATA_HEALTH');
              if (studioId) {
                try {
                  const res = await fetch(`/api/admin/studios/${studioId}/data-health`);
                  if (res.ok) {
                    const data = await res.json();
                    setStudioHealth(data.report);
                  }
                } catch (e) {
                  console.error(e);
                }
              }
            }}
          >
            Data Health &amp; Verification
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'MEDIA_GALLERY' ? styles.activeTab : ''}`}
            onClick={async () => {
              setActiveTab('MEDIA_GALLERY');
              if (studioId) {
                try {
                  const res = await fetch(`/api/admin/studios/${studioId}/media`);
                  if (res.ok) {
                    const data = await res.json();
                    setStudioMediaItems(data.media || []);
                  }
                } catch (e) {
                  console.error(e);
                }
              }
            }}
          >
            Media Assets
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'VERSIONS' ? styles.activeTab : ''}`}
            onClick={async () => {
              setActiveTab('VERSIONS');
              if (studioId) {
                try {
                  const res = await fetch(`/api/admin/studios/${studioId}/versions`);
                  if (res.ok) {
                    const data = await res.json();
                    setStudioVersions(data.versions || []);
                  }
                } catch (e) {
                  console.error(e);
                }
              }
            }}
          >
            Version History
          </button>
        </div>

        {error && (
          <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {successMsg && (
          <div style={{ padding: '10px 14px', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '8px', color: '#4ade80', fontSize: '13px' }}>
            {successMsg}
          </div>
        )}

        {/* TAB 1: METADATA */}
        {activeTab === 'METADATA' && (
          <form onSubmit={handleSaveMetadata} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Canonical Name *</label>
                <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Native Name (Kanji / Kana)</label>
                <input className={styles.input} value={nativeName} onChange={(e) => setNativeName(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>URL Slug</label>
                <input className={styles.input} value={slug} onChange={(e) => setSlug(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Founded Year</label>
                <input type="number" className={styles.input} value={foundedYear} onChange={(e) => setFoundedYear(e.target.value)} />
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
                <label className={styles.label}>Verification Status</label>
                <select className={styles.select} value={verificationStatus} onChange={(e) => setVerificationStatus(e.target.value)}>
                  <option value="VERIFIED">VERIFIED</option>
                  <option value="PARTIALLY_VERIFIED">PARTIALLY_VERIFIED</option>
                  <option value="UNVERIFIED">UNVERIFIED</option>
                  <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Publication State</label>
                <select className={styles.select} value={publicationState} onChange={(e) => setPublicationState(e.target.value)}>
                  <option value="PUBLISHED">PUBLISHED</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="HIDDEN">HIDDEN</option>
                  <option value="ARCHIVED">ARCHIVED</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Country</label>
                <input className={styles.input} value={country} onChange={(e) => setCountry(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Prefecture / Region</label>
                <input className={styles.input} value={region} onChange={(e) => setRegion(e.target.value)} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>City / Ward</label>
                <input className={styles.input} value={city} onChange={(e) => setCity(e.target.value)} />
              </div>
              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label className={styles.label}>Official Website</label>
                <input type="url" className={styles.input} value={website} onChange={(e) => setWebsite(e.target.value)} />
              </div>
              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label className={styles.label}>Editorial Description</label>
                <textarea className={styles.textarea} value={about} onChange={(e) => setAbout(e.target.value)} />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button type="submit" className={styles.primaryBtn} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        )}

        {/* TAB: HISTORY */}
        {activeTab === 'HISTORY' && studio && (
          <StudioHistoryTab studioId={studio.id} />
        )}

        {/* TAB 2: OVERRIDES */}
        {activeTab === 'OVERRIDES' && (
          <form onSubmit={handleApplyOverride} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
              Admin Overrides allow you to manually correct public presentation data without destroying raw external provider data.
            </p>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Display Name Override</label>
                <input className={styles.input} value={overrideName} onChange={(e) => setOverrideName(e.target.value)} placeholder="Leave blank to use provider name" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Founded Year Override</label>
                <input type="number" className={styles.input} value={overrideYear} onChange={(e) => setOverrideYear(e.target.value)} placeholder="Leave blank to use provider year" />
              </div>
              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label className={styles.label}>Official Website Override</label>
                <input type="url" className={styles.input} value={overrideWebsite} onChange={(e) => setOverrideWebsite(e.target.value)} placeholder="https://..." />
              </div>
              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label className={styles.label}>Description Override</label>
                <textarea className={styles.textarea} value={overrideAbout} onChange={(e) => setOverrideAbout(e.target.value)} placeholder="Custom editorial copy..." />
              </div>
              <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                <label className={styles.label}>Audit Override Reason</label>
                <input className={styles.input} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="Why is this override being applied?" />
              </div>
            </div>
            <div className={styles.modalFooter} style={{ justifyContent: 'space-between' }}>
              <button type="button" className={styles.secondaryBtn} onClick={handleResetOverride} disabled={isSaving}>
                <RotateCcw size={14} /> Reset to Provider Data
              </button>
              <button type="submit" className={styles.primaryBtn} disabled={isSaving}>
                {isSaving ? 'Applying...' : 'Apply Editorial Overrides'}
              </button>
            </div>
          </form>
        )}

        {/* TAB 3: ANIME PRODUCTIONS */}
        {activeTab === 'ANIME' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#ffffff' }}>Link Anime to Studio</h4>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  className={styles.input}
                  style={{ flex: 1, minWidth: '200px' }}
                  placeholder="Search anime title..."
                  value={animeQuery}
                  onChange={(e) => setAnimeQuery(e.target.value)}
                />
                <select className={styles.select} value={selectedAnimeRole} onChange={(e) => setSelectedAnimeRole(e.target.value)}>
                  <option value="MAIN_STUDIO">MAIN_STUDIO</option>
                  <option value="CO_PRODUCER">CO_PRODUCER</option>
                  <option value="ANIMATION">ANIMATION</option>
                  <option value="PRODUCTION_ASSISTANCE">PRODUCTION_ASSISTANCE</option>
                  <option value="CG">CG</option>
                  <option value="BACKGROUND">BACKGROUND</option>
                  <option value="OTHER">OTHER</option>
                </select>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#cbd5e1' }}>
                  <input type="checkbox" checked={isPrimaryAnime} onChange={(e) => setIsPrimaryAnime(e.target.checked)} />
                  Primary Studio
                </label>
              </div>

              {animeResults.length > 0 && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {animeResults.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => setSelectedAnimeId(a.id)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: selectedAnimeId === a.id ? 'rgba(139, 92, 246, 0.25)' : 'rgba(255, 255, 255, 0.04)',
                        border: selectedAnimeId === a.id ? '1px solid #8b5cf6' : '1px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ fontWeight: 600, color: '#ffffff' }}>{a.canonicalTitle || a.title}</span>
                      <span style={{ color: '#64748b' }}>Score: {a.score || 'N/A'}</span>
                    </div>
                  ))}
                  {selectedAnimeId && (
                    <button type="button" className={styles.primaryBtn} onClick={handleLinkAnime} style={{ marginTop: '8px', alignSelf: 'flex-start' }}>
                      <Plus size={15} /> Confirm Link
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Current Anime List */}
            <div>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#ffffff' }}>Currently Associated Anime ({studio?.projects?.length || 0})</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
                {(studio?.projects || []).map((p: any) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      borderRadius: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '13.5px' }}>{p.canonicalTitle}</span>
                      <span className={styles.badge}>{p.role}</span>
                      {p.isPrimary && <span style={{ fontSize: '11px', color: '#4ade80' }}>Primary</span>}
                    </div>
                    <button
                      type="button"
                      className={styles.iconActionBtn}
                      onClick={() => handleUnlinkAnime(p.id)}
                      title="Unlink anime"
                      style={{ color: '#f87171' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: STAFF */}
        {activeTab === 'STAFF' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto' }}>
              {(studio?.staff || []).map((s: any) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontWeight: 700, color: '#ffffff' }}>{s.name}</span>
                    <span className={styles.badge}>{s.role}</span>
                    {s.notes && <span style={{ fontSize: '12px', color: '#64748b' }}>({s.notes})</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: MEDIA */}
        {activeTab === 'MEDIA' && (
          <form onSubmit={handleUploadImage} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <span className={styles.label}>Current Logo</span>
                <div className={styles.logoThumb} style={{ width: '80px', height: '80px', borderRadius: '12px' }}>
                  {studio?.displayImageUrl ? (
                    <img src={studio.displayImageUrl} alt="Logo" className={styles.logoImg} />
                  ) : (
                    <Building2 color="#64748b" size={32} />
                  )}
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Image Type</label>
                  <select className={styles.select} value={uploadType} onChange={(e: any) => setUploadType(e.target.value)}>
                    <option value="LOGO">STUDIO LOGO (Square/Icon)</option>
                    <option value="BANNER">STUDIO BANNER (Wide 16:9)</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Select Local Image (PNG, JPEG, WebP, AVIF — Max 5MB)</label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    className={styles.input}
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                </div>

                <button type="submit" className={styles.primaryBtn} disabled={!selectedFile || isSaving} style={{ alignSelf: 'flex-start' }}>
                  <Upload size={16} /> {isSaving ? 'Uploading...' : `Upload ${uploadType}`}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* TAB: ANALYTICS & INSIGHTS */}
        {activeTab === 'ANALYTICS' && studioAnalytics && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Overview Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Total Productions</span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', color: '#ffffff' }}>{studioAnalytics.overview.totalProjects}</h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{studioAnalytics.overview.totalEpisodes} total episodes</span>
              </div>
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Average Score</span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', color: '#fbbf24' }}>
                  {studioAnalytics.overview.averageScore !== null ? `★ ${studioAnalytics.overview.averageScore}` : 'N/A'}
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>{studioAnalytics.overview.sampleSizeContext}</span>
              </div>
              <div style={{ padding: '14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                <span style={{ fontSize: '12px', color: '#94a3b8' }}>Engagement</span>
                <h3 style={{ margin: '4px 0 0 0', fontSize: '20px', color: '#4ade80' }}>
                  {studioAnalytics.engagement.totalWatches.toLocaleString()}
                </h3>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {studioAnalytics.engagement.totalFavorites} favorites · {studioAnalytics.engagement.totalReviews} reviews
                </span>
              </div>
            </div>

            {/* Genre & Format Distribution */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#cbd5e1' }}>Top Genres</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {studioAnalytics.genreDistribution.slice(0, 6).map((g: any) => (
                    <div key={g.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                      <span style={{ color: '#ffffff' }}>{g.name}</span>
                      <span style={{ color: '#8b5cf6', fontWeight: 600 }}>{g.percentage}% ({g.count})</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#cbd5e1' }}>Format Breakdown</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {studioAnalytics.typeDistribution.map((t: any) => (
                    <div key={t.type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                      <span style={{ color: '#ffffff' }}>{t.type}</span>
                      <span style={{ color: '#60a5fa', fontWeight: 600 }}>{t.percentage}% ({t.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: COMMUNITIES */}
        {activeTab === 'COMMUNITIES' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', color: '#ffffff' }}>Associated Communities ({studioCommunities.length})</h4>
            {studioCommunities.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>No active communities directly linked to this studio.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                {studioCommunities.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: '12px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, color: '#ffffff', fontSize: '13.5px' }}>{c.name}</span>
                      <span className={styles.badge}>{c.visibility}</span>
                    </div>
                    <p style={{ fontSize: '12px', color: '#94a3b8', margin: '6px 0' }}>{c.description}</p>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>{c.memberCount} members · {c.discussionCount} discussions</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: DATA HEALTH & VERIFICATION */}
        {activeTab === 'DATA_HEALTH' && studioHealth && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Completeness & Health Meter */}
            <div style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Data Completeness Score</span>
                  <h3 style={{ margin: '4px 0 0 0', fontSize: '24px', color: '#ffffff' }}>{studioHealth.completenessScore}%</h3>
                </div>
                <span
                  style={{
                    padding: '6px 12px',
                    borderRadius: '20px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: studioHealth.healthTier === 'EXCELLENT' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(234, 179, 8, 0.2)',
                    color: studioHealth.healthTier === 'EXCELLENT' ? '#4ade80' : '#facc15',
                  }}
                >
                  {studioHealth.healthTier}
                </span>
              </div>
            </div>

            {/* Checklist */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
              {Object.entries(studioHealth.checks).map(([key, val]) => (
                <div
                  key={key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    background: val ? 'rgba(34, 197, 94, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    border: val ? '1px solid rgba(34, 197, 94, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                    fontSize: '12.5px',
                    color: val ? '#4ade80' : '#f87171',
                  }}
                >
                  <span>{val ? '✓' : '✗'}</span>
                  <span style={{ textTransform: 'capitalize', color: '#ffffff' }}>{key.replace(/([A-Z])/g, ' $1')}</span>
                </div>
              ))}
            </div>

            {/* Missing Elements */}
            {studioHealth.missingElements.length > 0 && (
              <div style={{ padding: '12px', background: 'rgba(234, 179, 8, 0.08)', borderRadius: '6px', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
                <h5 style={{ margin: '0 0 6px 0', color: '#facc15', fontSize: '12px' }}>Missing Data Recommended for Enrichment</h5>
                <ul style={{ margin: 0, paddingLeft: '20px', color: '#cbd5e1', fontSize: '12px' }}>
                  {studioHealth.missingElements.map((el: string) => (
                    <li key={el}>{el}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* TAB: MEDIA ASSETS */}
        {activeTab === 'MEDIA_GALLERY' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', color: '#ffffff' }}>Studio Media Gallery ({studioMediaItems.length})</h4>
            {studioMediaItems.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>No additional gallery images uploaded for this studio.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                {studioMediaItems.map((m) => (
                  <div key={m.id} style={{ padding: '10px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
                    <img src={m.url} alt={m.mediaType} style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '6px' }} />
                    <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                      <span style={{ color: '#ffffff', fontWeight: 600 }}>{m.mediaType}</span>
                      <span style={{ color: '#4ade80' }}>{m.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB: VERSION HISTORY & ROLLBACK */}
        {activeTab === 'VERSIONS' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '14px', color: '#ffffff' }}>Immutable Version History Snapshots ({studioVersions.length})</h4>
            {studioVersions.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px' }}>No historical version snapshots recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {studioVersions.map((v) => (
                  <div
                    key={v.id}
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#8b5cf6', fontSize: '13px' }}>Version {v.versionNumber}</span>
                        <span style={{ color: '#ffffff', fontSize: '13px' }}>— {v.changesSummary || 'Snapshot'}</span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Saved by {v.author?.username || 'Admin'} on {new Date(v.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!confirm(`Are you sure you want to rollback to Version ${v.versionNumber}?`)) return;
                        try {
                          const res = await fetch(`/api/admin/studios/${studioId}/versions/${v.versionNumber}/rollback`, { method: 'POST' });
                          if (res.ok) {
                            alert(`Studio successfully rolled back to Version ${v.versionNumber}!`);
                            onSuccess();
                          } else {
                            const err = await res.json();
                            alert(err.error || 'Rollback failed');
                          }
                        } catch (e: any) {
                          alert(e.message);
                        }
                      }}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#f87171',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Rollback to v{v.versionNumber}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
