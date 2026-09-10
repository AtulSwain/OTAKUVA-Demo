'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Eye,
  EyeOff,
  ExternalLink,
  Film,
  User as UserIcon,
  Sparkles,
  ArrowUpDown,
  History as HistoryIcon,
  X,
} from 'lucide-react';
import styles from '../adminStudios.module.css';

interface Props {
  studioId: string;
}

export function StudioHistoryTab({ studioId }: Props) {
  const [events, setEvents] = useState<any[]>([]);
  const [eras, setEras] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [importanceFilter, setImportanceFilter] = useState('ALL');
  const [verifFilter, setVerifFilter] = useState('ALL');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [eventYear, setEventYear] = useState<string>('');
  const [eventDate, setEventDate] = useState('');
  const [eventEndYear, setEventEndYear] = useState<string>('');
  const [eventType, setEventType] = useState('MILESTONE');
  const [importance, setImportance] = useState('NORMAL');
  const [eraId, setEraId] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageCaption, setImageCaption] = useState('');
  const [animeId, setAnimeId] = useState('');
  const [personId, setPersonId] = useState('');
  const [source, setSource] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState('OFFICIAL');
  const [verificationStatus, setVerificationStatus] = useState('VERIFIED');
  const [publicationState, setPublicationState] = useState('PUBLISHED');

  // Search helpers
  const [animeQuery, setAnimeQuery] = useState('');
  const [animeResults, setAnimeResults] = useState<any[]>([]);

  const fetchHistory = useCallback(async () => {
    if (!studioId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (typeFilter !== 'ALL') params.set('eventType', typeFilter);
      if (importanceFilter !== 'ALL') params.set('importance', importanceFilter);
      if (verifFilter !== 'ALL') params.set('verificationStatus', verifFilter);

      const res = await fetch(`/api/admin/studios/${studioId}/history?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
        setEras(data.eras || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [studioId, search, typeFilter, importanceFilter, verifFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Anime Search
  useEffect(() => {
    if (!animeQuery.trim()) {
      setAnimeResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/anime?q=${encodeURIComponent(animeQuery.trim())}&limit=5`);
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

  // Live duplicate check on title/year
  useEffect(() => {
    if (!title.trim() || title.length < 3) {
      setDuplicateWarning(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/studios/${studioId}/history/duplicates`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            year: eventYear ? parseInt(eventYear, 10) : undefined,
            eventType,
            excludeEventId: editingEventId || undefined,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.matches && data.matches.length > 0) {
            setDuplicateWarning(`Potential duplicate detected: "${data.matches[0].event.title}" (${data.matches[0].reason})`);
          } else {
            setDuplicateWarning(null);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [title, eventYear, eventType, studioId, editingEventId]);

  const openCreateModal = () => {
    setEditingEventId(null);
    setTitle('');
    setShortDescription('');
    setFullDescription('');
    setEventYear(new Date().getFullYear().toString());
    setEventDate('');
    setEventEndYear('');
    setEventType('MILESTONE');
    setImportance('NORMAL');
    setEraId('');
    setImageUrl('');
    setImageCaption('');
    setAnimeId('');
    setPersonId('');
    setSource('Official Documentation');
    setSourceUrl('');
    setSourceType('OFFICIAL');
    setVerificationStatus('VERIFIED');
    setPublicationState('PUBLISHED');
    setFormError(null);
    setDuplicateWarning(null);
    setIsModalOpen(true);
  };

  const openEditModal = (event: any) => {
    setEditingEventId(event.id);
    setTitle(event.title || '');
    setShortDescription(event.shortDescription || '');
    setFullDescription(event.fullDescription || '');
    setEventYear(event.eventYear ? String(event.eventYear) : '');
    setEventDate(event.eventDate ? event.eventDate.split('T')[0] : '');
    setEventEndYear(event.eventEndYear ? String(event.eventEndYear) : '');
    setEventType(event.eventType || 'MILESTONE');
    setImportance(event.importance || 'NORMAL');
    setEraId(event.eraId || '');
    setImageUrl(event.imageUrl || '');
    setImageCaption(event.imageCaption || '');
    setAnimeId(event.anime?.id || '');
    setPersonId(event.person?.id || '');
    setSource(event.source || '');
    setSourceUrl(event.sourceUrl || '');
    setSourceType(event.sourceType || 'OFFICIAL');
    setVerificationStatus(event.verificationStatus || 'VERIFIED');
    setPublicationState(event.publicationState || 'PUBLISHED');
    setFormError(null);
    setDuplicateWarning(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Title is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    const payload = {
      title: title.trim(),
      shortDescription: shortDescription.trim() || null,
      fullDescription: fullDescription.trim() || null,
      eventYear: eventYear ? parseInt(eventYear, 10) : null,
      eventDate: eventDate || null,
      eventEndYear: eventEndYear ? parseInt(eventEndYear, 10) : null,
      eventType,
      importance,
      eraId: eraId || null,
      imageUrl: imageUrl.trim() || null,
      imageCaption: imageCaption.trim() || null,
      animeId: animeId || null,
      personId: personId || null,
      source: source.trim() || null,
      sourceUrl: sourceUrl.trim() || null,
      sourceType,
      verificationStatus,
      publicationState,
    };

    try {
      const url = editingEventId
        ? `/api/admin/studios/${studioId}/history/${editingEventId}`
        : `/api/admin/studios/${studioId}/history`;
      const method = editingEventId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save history event.');

      setIsModalOpen(false);
      fetchHistory();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePublish = async (event: any) => {
    const newState = event.publicationState === 'PUBLISHED' ? 'ARCHIVE' : 'PUBLISH';
    try {
      await fetch(`/api/admin/studios/${studioId}/history/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: newState }),
      });
      fetchHistory();
    } catch (e) {
      console.error(e);
    }
  };

  const handleArchive = async (eventId: string) => {
    if (!confirm('Are you sure you want to archive this historical event?')) return;
    try {
      await fetch(`/api/admin/studios/${studioId}/history/${eventId}`, {
        method: 'DELETE',
      });
      fetchHistory();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header with Stats & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#cbd5e1' }}>
            <HistoryIcon size={16} color="#8b5cf6" />
            <span><strong>{stats?.totalEvents ?? events.length}</strong> Milestones</span>
          </div>
          <span style={{ color: '#475569' }}>•</span>
          <span style={{ fontSize: '12px', color: '#60a5fa' }}>{stats?.verifiedCount ?? 0} Verified</span>
          <span style={{ color: '#475569' }}>•</span>
          <span style={{ fontSize: '12px', color: '#4ade80' }}>{stats?.publishedCount ?? 0} Published</span>
        </div>

        <button type="button" className={styles.primaryBtn} onClick={openCreateModal}>
          <Plus size={15} /> Add Historical Event
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          className={styles.input}
          style={{ flex: 1, minWidth: '180px' }}
          placeholder="Filter milestones..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className={styles.select} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="ALL">All Event Types</option>
          <option value="FOUNDING">FOUNDING</option>
          <option value="MAJOR_PROJECT">MAJOR_PROJECT</option>
          <option value="LEADERSHIP">LEADERSHIP</option>
          <option value="MILESTONE">MILESTONE</option>
          <option value="EXPANSION">EXPANSION</option>
          <option value="AWARD">AWARD</option>
          <option value="MERGER">MERGER</option>
          <option value="ACQUISITION">ACQUISITION</option>
          <option value="PRODUCTION_EVENT">PRODUCTION_EVENT</option>
        </select>
        <select className={styles.select} value={importanceFilter} onChange={(e) => setImportanceFilter(e.target.value)}>
          <option value="ALL">All Importance</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="MAJOR">MAJOR</option>
          <option value="IMPORTANT">IMPORTANT</option>
          <option value="NORMAL">NORMAL</option>
          <option value="LOW">LOW</option>
        </select>
        <select className={styles.select} value={verifFilter} onChange={(e) => setVerifFilter(e.target.value)}>
          <option value="ALL">All Verifications</option>
          <option value="VERIFIED">VERIFIED</option>
          <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
          <option value="UNVERIFIED">UNVERIFIED</option>
        </select>
      </div>

      {/* Events List */}
      {loading ? (
        <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>Loading studio history...</div>
      ) : events.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <h4 style={{ margin: '0 0 6px 0', color: '#ffffff' }}>No Historical Milestones Documented</h4>
          <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: '#94a3b8' }}>
            Add founding dates, major productions, expansions, and leadership milestones to build this studio&apos;s interactive timeline.
          </p>
          <button type="button" className={styles.primaryBtn} onClick={openCreateModal}>
            <Plus size={15} /> Add First Milestone
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
          {events.map((e) => (
            <div
              key={e.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                gap: '14px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1 }}>
                <div style={{ minWidth: '60px', fontWeight: 800, color: '#8b5cf6', fontSize: '14px' }}>
                  {e.displayDate}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, color: '#ffffff', fontSize: '14px' }}>{e.title}</span>
                    <span className={styles.badge}>{e.eventType}</span>
                    {e.importance === 'MAJOR' || e.importance === 'CRITICAL' ? (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24', background: 'rgba(245, 158, 11, 0.15)', padding: '2px 6px', borderRadius: '4px' }}>
                        {e.importance}
                      </span>
                    ) : null}
                  </div>
                  {e.shortDescription && (
                    <span style={{ fontSize: '12.5px', color: '#94a3b8', lineHeight: 1.4 }}>
                      {e.shortDescription}
                    </span>
                  )}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', fontSize: '11.5px', color: '#64748b' }}>
                    {e.anime && <span>🎬 {e.anime.canonicalTitle}</span>}
                    {e.person && <span>👤 {e.person.name}</span>}
                    {e.eraName && <span>🏛️ {e.eraName}</span>}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className={styles.iconActionBtn}
                  onClick={() => handleTogglePublish(e)}
                  title={e.publicationState === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
                >
                  {e.publicationState === 'PUBLISHED' ? <Eye size={14} color="#4ade80" /> : <EyeOff size={14} color="#94a3b8" />}
                </button>
                <button
                  type="button"
                  className={styles.iconActionBtn}
                  onClick={() => openEditModal(e)}
                  title="Edit Milestone"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  type="button"
                  className={styles.iconActionBtn}
                  onClick={() => handleArchive(e.id)}
                  title="Archive Milestone"
                  style={{ color: '#f87171' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE / EDIT EVENT MODAL */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard} style={{ maxWidth: '720px' }}>
            <div className={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <HistoryIcon color="#8b5cf6" size={22} />
                <h3 className={styles.modalTitle}>{editingEventId ? 'Edit History Milestone' : 'Add History Milestone'}</h3>
              </div>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {duplicateWarning && (
              <div style={{ padding: '10px 14px', background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', color: '#fbbf24', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} /> {duplicateWarning}
              </div>
            )}

            {formError && (
              <div style={{ padding: '10px 14px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#f87171', fontSize: '13px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className={styles.formGrid}>
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label className={styles.label}>Milestone Title *</label>
                  <input
                    className={styles.input}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Satoshi Kon Directorial Debut: Perfect Blue"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Event Type</label>
                  <select className={styles.select} value={eventType} onChange={(e) => setEventType(e.target.value)}>
                    <option value="FOUNDING">FOUNDING</option>
                    <option value="MAJOR_PROJECT">MAJOR_PROJECT</option>
                    <option value="LEADERSHIP">LEADERSHIP</option>
                    <option value="MILESTONE">MILESTONE</option>
                    <option value="EXPANSION">EXPANSION</option>
                    <option value="AWARD">AWARD</option>
                    <option value="MERGER">MERGER</option>
                    <option value="ACQUISITION">ACQUISITION</option>
                    <option value="PRODUCTION_EVENT">PRODUCTION_EVENT</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Importance Level</label>
                  <select className={styles.select} value={importance} onChange={(e) => setImportance(e.target.value)}>
                    <option value="CRITICAL">CRITICAL (Featured Highlight)</option>
                    <option value="MAJOR">MAJOR (Prominent)</option>
                    <option value="IMPORTANT">IMPORTANT (Standard Milestone)</option>
                    <option value="NORMAL">NORMAL</option>
                    <option value="LOW">LOW</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Year (or Start Year) *</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={eventYear}
                    onChange={(e) => setEventYear(e.target.value)}
                    placeholder="e.g. 1997"
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>End Year (If Multi-Year Period)</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={eventEndYear}
                    onChange={(e) => setEventEndYear(e.target.value)}
                    placeholder="e.g. 2000"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Exact Date (Optional)</label>
                  <input
                    type="date"
                    className={styles.input}
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Historical Era</label>
                  <select className={styles.select} value={eraId} onChange={(e) => setEraId(e.target.value)}>
                    <option value="">-- No specific era --</option>
                    {eras.map((era) => (
                      <option key={era.id} value={era.id}>
                        {era.name} ({era.startYear}–{era.endYear || 'Present'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label className={styles.label}>Short Summary</label>
                  <input
                    className={styles.input}
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    placeholder="1-2 sentences summarizing this event's significance..."
                  />
                </div>

                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label className={styles.label}>Full Editorial Description</label>
                  <textarea
                    className={styles.textarea}
                    value={fullDescription}
                    onChange={(e) => setFullDescription(e.target.value)}
                    placeholder="Detailed historical context, directors, reception, and impact..."
                  />
                </div>

                {/* Related Anime search */}
                <div className={`${styles.formGroup} ${styles.fullWidth}`}>
                  <label className={styles.label}>Link Associated Anime Project</label>
                  <input
                    className={styles.input}
                    placeholder="Search anime title..."
                    value={animeQuery}
                    onChange={(e) => setAnimeQuery(e.target.value)}
                  />
                  {animeResults.length > 0 && (
                    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {animeResults.map((a) => (
                        <div
                          key={a.id}
                          onClick={() => {
                            setAnimeId(a.id);
                            setAnimeQuery(a.canonicalTitle || a.title);
                            setAnimeResults([]);
                          }}
                          style={{
                            padding: '6px 10px',
                            background: animeId === a.id ? 'rgba(139, 92, 246, 0.2)' : 'rgba(255,255,255,0.04)',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12.5px',
                            color: '#ffffff',
                          }}
                        >
                          {a.canonicalTitle || a.title} ({a.year || 'N/A'})
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Source Name</label>
                  <input
                    className={styles.input}
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="e.g. Official Studio Archive"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Source URL</label>
                  <input
                    type="url"
                    className={styles.input}
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button type="button" className={styles.secondaryBtn} onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>
                  Cancel
                </button>
                <button type="submit" className={styles.primaryBtn} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingEventId ? 'Update Milestone' : 'Save Milestone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
