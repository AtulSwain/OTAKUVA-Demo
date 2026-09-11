'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2,
  Search,
  Plus,
  GitMerge,
  RotateCw,
  Edit2,
  ExternalLink,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Database,
  Layers,
  Sparkles,
  Network,
  GitCompare,
} from 'lucide-react';
import styles from './adminStudios.module.css';
import { CreateStudioModal } from './components/CreateStudioModal';
import { EditStudioModal } from './components/EditStudioModal';
import { MergeStudioModal } from './components/MergeStudioModal';
import { StudioGraphExplorerModal } from './components/StudioGraphExplorerModal';
import { StudioComparisonModal } from './components/StudioComparisonModal';

export default function AdminStudiosPage() {
  const [studios, setStudios] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [verifFilter, setVerifFilter] = useState('ALL');
  const [pubFilter, setPubFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMergeOpen, setIsMergeOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareStudioId, setCompareStudioId] = useState<string | null>(null);
  const [isGraphOpen, setIsGraphOpen] = useState(false);
  const [graphStudioId, setGraphStudioId] = useState<string | null>(null);
  const [graphStudioName, setGraphStudioName] = useState<string>('');
  const [editingStudioId, setEditingStudioId] = useState<string | null>(null);
  const [initialMergeStudioId, setInitialMergeStudioId] = useState<string | null>(null);

  const fetchStudios = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (verifFilter !== 'ALL') params.set('verificationStatus', verifFilter);
      if (pubFilter !== 'ALL') params.set('publicationState', pubFilter);
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/admin/studios?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setStudios(data.studios || []);
        setTotalPages(data.totalPages || 1);
        setTotalCount(data.total || 0);
        if (data.stats) setStats(data.stats);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, verifFilter, pubFilter, page]);

  useEffect(() => {
    fetchStudios();
  }, [fetchStudios]);

  const handleRunBackfill = async () => {
    if (!confirm('Run canonical studio knowledge backfill to sync and enrich studios?')) return;
    try {
      const res = await fetch('/api/admin/studios/backfill', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert(`Backfill completed! ${data.summary.slugsPopulated} slugs populated, ${data.summary.enrichedWithKnowledge} enriched with knowledge, ${data.summary.foundersLinked} founders linked.`);
        fetchStudios();
      } else {
        alert(data.error || 'Backfill failed');
      }
    } catch (e: any) {
      alert(e.message);
    }
  };

  return (
    <div className={styles.container}>
      {/* 1. Header */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.badge}>
            <Sparkles size={13} />
            <span>OTAKUVA ADMIN · STUDIO CORE</span>
          </div>
          <h1 className={styles.pageTitle}>Studio Management Center</h1>
          <p className={styles.pageSubtitle}>
            Canonical animation studio records, metadata curation, founder attribution, anime linking, and safe entity merges.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            className={styles.secondaryBtn}
            onClick={() => {
              setCompareStudioId(null);
              setIsCompareOpen(true);
            }}
            title="Side-by-side Studio Intelligence Comparison"
          >
            <GitCompare size={15} /> Compare Studios
          </button>
          <button className={styles.secondaryBtn} onClick={handleRunBackfill} title="Run Knowledge Backfill">
            <RotateCw size={15} /> Sync Knowledge
          </button>
          <button
            className={styles.secondaryBtn}
            onClick={() => {
              setInitialMergeStudioId(null);
              setIsMergeOpen(true);
            }}
          >
            <GitMerge size={15} /> Merge Tool
          </button>
          <button className={styles.primaryBtn} onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} /> Create Studio
          </button>
        </div>
      </header>

      {/* 2. Telemetry Stats Bar */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Total Studios</span>
          <span className={styles.statValue}>{stats?.totalStudios ?? '—'}</span>
          <span className={styles.statSub}>{stats?.publishedStudios ?? '—'} published</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Verified Studios</span>
          <span className={styles.statValue} style={{ color: '#60a5fa' }}>{stats?.verifiedStudios ?? '—'}</span>
          <span className={styles.statSub}>Curated records</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Anime Productions</span>
          <span className={styles.statValue} style={{ color: '#4ade80' }}>{stats?.totalAnimeProductions ?? '—'}</span>
          <span className={styles.statSub}>Linked catalog works</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>Admin Overrides</span>
          <span className={styles.statValue} style={{ color: '#e879f9' }}>{stats?.activeOverrides ?? '—'}</span>
          <span className={styles.statSub}>Editorial adjustments</span>
        </div>
      </div>

      {/* 3. Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchBox}>
          <Search size={16} className={styles.searchIcon} />
          <input
            className={styles.searchInput}
            placeholder="Search studios by name, native kanji, slug, or alias..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All Statuses</option>
          <option value="ACTIVE">ACTIVE</option>
          <option value="INACTIVE">INACTIVE</option>
          <option value="CLOSED">CLOSED</option>
          <option value="MERGED">MERGED</option>
          <option value="ACQUIRED">ACQUIRED</option>
        </select>

        <select
          className={styles.filterSelect}
          value={verifFilter}
          onChange={(e) => {
            setVerifFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All Verifications</option>
          <option value="VERIFIED">VERIFIED</option>
          <option value="PARTIALLY_VERIFIED">PARTIALLY_VERIFIED</option>
          <option value="UNVERIFIED">UNVERIFIED</option>
          <option value="NEEDS_REVIEW">NEEDS_REVIEW</option>
        </select>

        <select
          className={styles.filterSelect}
          value={pubFilter}
          onChange={(e) => {
            setPubFilter(e.target.value);
            setPage(1);
          }}
        >
          <option value="ALL">All Publication States</option>
          <option value="PUBLISHED">PUBLISHED</option>
          <option value="DRAFT">DRAFT</option>
          <option value="HIDDEN">HIDDEN</option>
          <option value="ARCHIVED">ARCHIVED</option>
        </select>
      </div>

      {/* 4. Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Studio</th>
              <th>Status</th>
              <th>Verification</th>
              <th>Location</th>
              <th>Founded</th>
              <th>Anime</th>
              <th>Overrides</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  Loading studio catalog...
                </td>
              </tr>
            ) : studios.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                  No studios found matching current criteria.
                </td>
              </tr>
            ) : (
              studios.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className={styles.studioCell}>
                      <div className={styles.logoThumb}>
                        {s.imageUrl ? (
                          <img src={s.imageUrl} alt={s.name} className={styles.logoImg} />
                        ) : (
                          <Building2 size={18} color="#64748b" />
                        )}
                      </div>
                      <div className={styles.studioInfo}>
                        <span className={styles.studioName}>{s.displayTitle}</span>
                        <span className={styles.studioSub}>
                          {s.nativeName && <span>{s.nativeName} · </span>}
                          <span>/{s.slug}</span>
                        </span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${styles[`status${s.status}`] || ''}`}>
                      {s.status}
                    </span>
                  </td>
                  <td>
                    <span className={`${styles.verifBadge} ${styles[`verif${s.verificationStatus}`] || ''}`}>
                      {s.verificationStatus === 'VERIFIED' && <ShieldCheck size={12} />}
                      {s.verificationStatus}
                    </span>
                  </td>
                  <td>{s.city ? `${s.city}, ${s.country || 'Japan'}` : s.country || '—'}</td>
                  <td>{s.foundedYear || '—'}</td>
                  <td>
                    <span style={{ fontWeight: 700, color: '#ffffff' }}>{s.totalAnimeCount}</span>
                  </td>
                  <td>
                    {s.hasAdminOverride ? (
                      <span className={styles.overrideTag}>Override Active</span>
                    ) : (
                      <span style={{ color: '#64748b', fontSize: '12px' }}>Provider Standard</span>
                    )}
                  </td>
                  <td>
                    <div className={styles.actionBtns}>
                      <button aria-label="Edit studio & link relations"
                        className={styles.iconActionBtn}
                        onClick={() => setEditingStudioId(s.id)}
                        title="Edit studio & link relations"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button aria-label="Inspect Knowledge Graph"
                        className={styles.iconActionBtn}
                        onClick={() => {
                          setGraphStudioId(s.id);
                          setGraphStudioName(s.displayTitle || s.name);
                          setIsGraphOpen(true);
                        }}
                        title="Inspect Knowledge Graph"
                      >
                        <Network size={14} />
                      </button>
                      <button aria-label="Compare Studio"
                        className={styles.iconActionBtn}
                        onClick={() => {
                          setCompareStudioId(s.id);
                          setIsCompareOpen(true);
                        }}
                        title="Compare Studio"
                      >
                        <GitCompare size={14} />
                      </button>
                      <button aria-label="Merge with duplicate"
                        className={styles.iconActionBtn}
                        onClick={() => {
                          setInitialMergeStudioId(s.id);
                          setIsMergeOpen(true);
                        }}
                        title="Merge with duplicate"
                      >
                        <GitMerge size={14} />
                      </button>
                      <Link aria-label="View public profile"
                        href={`/studio/${s.slug}`}
                        target="_blank"
                        className={styles.iconActionBtn}
                        title="View public profile"
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* 5. Pagination */}
        <div className={styles.pagination}>
          <span>
            Showing {studios.length} of {totalCount} studios
          </span>
          <div className={styles.pageControls}>
            <button
              className={styles.pageBtn}
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span>
              Page {page} of {totalPages || 1}
            </span>
            <button
              className={styles.pageBtn}
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateStudioModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => fetchStudios()}
      />

      <EditStudioModal
        studioId={editingStudioId}
        isOpen={!!editingStudioId}
        onClose={() => setEditingStudioId(null)}
        onSuccess={() => fetchStudios()}
      />

      <MergeStudioModal
        isOpen={isMergeOpen}
        initialStudioId={initialMergeStudioId}
        onClose={() => setIsMergeOpen(false)}
        onSuccess={() => fetchStudios()}
      />

      <StudioGraphExplorerModal
        studioId={graphStudioId}
        studioName={graphStudioName}
        isOpen={isGraphOpen}
        onClose={() => setIsGraphOpen(false)}
      />

      <StudioComparisonModal
        isOpen={isCompareOpen}
        onClose={() => setIsCompareOpen(false)}
        initialStudioId={compareStudioId}
        studios={studios.map((s) => ({ id: s.id, name: s.displayTitle || s.name }))}
      />
    </div>
  );
}
