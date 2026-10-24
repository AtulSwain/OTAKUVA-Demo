'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Newspaper,
  Plus,
  Search,
  Filter,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RotateCcw,
  Eye,
  Edit2,
  Trash2,
  Archive,
  Layers,
  Sparkles,
  RefreshCw,
  Clock,
  Activity,
  Shield,
  BarChart3,
  ExternalLink,
  Flame,
  Check,
  Building2,
  Film,
} from 'lucide-react';
import styles from './page.module.css';
import { useAuth } from '../../../context/AuthContext';

const ADMIN_NEWS_ROLES = new Set(['NEWS_EDITOR', 'ADMIN', 'SUPER_ADMIN']);

const CATEGORIES = [
  'ALL',
  'ANIME',
  'PRODUCTION',
  'ANNOUNCEMENT',
  'TRAILER',
  'CAST',
  'STAFF',
  'STUDIO',
  'INDUSTRY',
  'MANGA',
  'OTHER',
];

export default function AdminNewsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const authorized = !!user && ADMIN_NEWS_ROLES.has(user.role);

  const [activeTab, setActiveTab] = useState<'articles' | 'create' | 'review' | 'duplicates' | 'operations' | 'analytics' | 'sync'>('articles');
  const [articles, setArticles] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals & Drawers
  const [editingArticle, setEditingArticle] = useState<any>(null);
  const [qualityCheckResult, setQualityCheckResult] = useState<any>(null);
  const [operationsData, setOperationsData] = useState<any>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [duplicateClusters, setDuplicateClusters] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Form State for Manual Create
  const [createForm, setCreateForm] = useState({
    title: '',
    subtitle: '',
    summary: '',
    content: '',
    category: 'ANIME',
    sourceName: 'OTAKUVA Editorial',
    sourceUrl: '',
    imageUrl: '',
    author: 'OTAKUVA News Desk',
    status: 'PUBLISHED',
    isFeatured: false,
    scheduledPublishAt: '',
  });

  // Load articles
  const loadArticles = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (categoryFilter !== 'ALL') params.set('category', categoryFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      params.set('page', page.toString());
      params.set('limit', '15');

      const res = await fetch(`/api/admin/news?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setArticles(data.articles || []);
        setMetrics(data.metrics || null);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching admin news:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, categoryFilter, searchQuery, page]);

  // Load Operations Data
  const loadOperations = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/news/operations');
      if (res.ok) {
        const data = await res.json();
        setOperationsData(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Load Analytics Data
  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/news/analytics?timeframe=7d');
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Load Review Queue
  const loadReviewQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/news/review');
      if (res.ok) {
        const data = await res.json();
        setReviewQueue(data.items || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Load Duplicates
  const loadDuplicates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/news/duplicates');
      if (res.ok) {
        const data = await res.json();
        setDuplicateClusters(data.clusters || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  // Load Sync Status
  const loadSyncStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/news/sync');
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (authorized) {
      if (activeTab === 'articles') loadArticles();
      else if (activeTab === 'operations') loadOperations();
      else if (activeTab === 'analytics') loadAnalytics();
      else if (activeTab === 'review') loadReviewQueue();
      else if (activeTab === 'duplicates') loadDuplicates();
      else if (activeTab === 'sync') loadSyncStatus();
    }
  }, [authorized, activeTab, loadArticles, loadOperations, loadAnalytics, loadReviewQueue, loadDuplicates, loadSyncStatus]);

  if (authLoading) {
    return <div className={styles.adminNewsContainer}><p>Loading administrative session...</p></div>;
  }

  if (!authorized) {
    return (
      <div className={styles.adminNewsContainer}>
        <h2>Access Restricted</h2>
        <p>You must hold an authorized editorial or administrative role to access the News Operations Center.</p>
        <Link href="/" className={styles.secondaryBtn}>← Return to Platform</Link>
      </div>
    );
  }

  // Handle Manual Create
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        alert('News article created successfully!');
        setActiveTab('articles');
        loadArticles();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to create article');
      }
    } catch (err: any) {
      alert(err.message || 'Network error');
    }
  };

  // Handle Status Action
  const handleStatusChange = async (id: string, action: string) => {
    if (!confirm(`Are you sure you want to ${action.toLowerCase()} this article?`)) return;
    try {
      const res = await fetch(`/api/admin/news/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        loadArticles();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Reset Override
  const handleResetOverride = async (id: string) => {
    if (!confirm('Reset all manual edits and restore original provider values?')) return;
    try {
      const res = await fetch(`/api/admin/news/${id}/reset-override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        alert('Overrides reset to provider values.');
        loadArticles();
        if (editingArticle?.id === id) setEditingArticle(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Run Quality Check
  const handleRunQualityCheck = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/news/${id}/quality-check`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setQualityCheckResult(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger Manual Provider Sync
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/admin/news/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerSlug: 'ann' }),
      });
      if (res.ok) {
        alert('Provider synchronization completed successfully.');
        loadArticles();
        loadSyncStatus();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Bulk Actions
  const handleBulkAction = async (action: string) => {
    if (!confirm(`Apply bulk action "${action}" to ${selectedIds.length} selected articles?`)) return;
    try {
      const res = await fetch('/api/admin/news/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, articleIds: selectedIds }),
      });
      if (res.ok) {
        setSelectedIds([]);
        loadArticles();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={styles.adminNewsContainer}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerTitleWrap}>
          <div className={styles.pillarBadge}>
            <Shield size={13} />
            <span>EDITORIAL CONTROL &amp; OPERATIONS</span>
          </div>
          <h1 className={styles.pageTitle}>News Management &amp; Intelligence</h1>
          <p className={styles.pageSubtitle}>
            Full lifecycle control: automated ingestion, editorial overrides, entity review, and operational telemetry.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={handleTriggerSync}
            disabled={isSyncing}
          >
            <RefreshCw size={13} className={isSyncing ? styles.spin : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Provider'}</span>
          </button>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={() => setActiveTab('create')}
          >
            <Plus size={14} />
            <span>Create Article</span>
          </button>
        </div>
      </header>

      {/* Metrics Row */}
      {metrics && (
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Total News</span>
            <span className={styles.metricValue}>{metrics.totalNews}</span>
            <span className={styles.metricSubtitle}>Indexed articles</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Published</span>
            <span className={styles.metricValue}>{metrics.published}</span>
            <span className={styles.metricSubtitle}>Publicly visible</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Drafts</span>
            <span className={styles.metricValue}>{metrics.draft}</span>
            <span className={styles.metricSubtitle}>Unpublished</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Scheduled</span>
            <span className={styles.metricValue}>{metrics.scheduled}</span>
            <span className={styles.metricSubtitle}>Auto-publish due</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Review Queue</span>
            <span className={styles.metricValue}>{metrics.pendingReview}</span>
            <span className={styles.metricSubtitle}>Pending matching</span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Archived</span>
            <span className={styles.metricValue}>{metrics.archived}</span>
            <span className={styles.metricSubtitle}>Retained records</span>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className={styles.tabNav}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'articles' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('articles')}
        >
          <Newspaper size={14} />
          <span>Articles</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'create' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('create')}
        >
          <Plus size={14} />
          <span>Create Article</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'review' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('review')}
        >
          <CheckCircle size={14} />
          <span>Entity Review</span>
          {reviewQueue.length > 0 && <span className={styles.tabBadge}>{reviewQueue.length}</span>}
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'duplicates' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('duplicates')}
        >
          <Layers size={14} />
          <span>Duplicates &amp; Clusters</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'operations' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('operations')}
        >
          <Activity size={14} />
          <span>Operations &amp; Health</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'analytics' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={14} />
          <span>Analytics</span>
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'sync' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('sync')}
        >
          <RefreshCw size={14} />
          <span>Provider Sync</span>
        </button>
      </nav>

      {/* TAB 1: ARTICLES MANAGEMENT TABLE */}
      {activeTab === 'articles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Controls Bar */}
          <div className={styles.tableControlsBar}>
            <div className={styles.filterGroup}>
              <select
                className={styles.selectInput}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="ARCHIVED">Archived</option>
              </select>

              <select
                className={styles.selectInput}
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <form
              className={styles.searchBox}
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                loadArticles();
              }}
            >
              <Search size={13} style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search headlines, ID, source..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </form>
          </div>

          {/* Bulk Action Bar */}
          {selectedIds.length > 0 && (
            <div className={styles.bulkBar}>
              <span className={styles.bulkInfo}>{selectedIds.length} articles selected</span>
              <div className={styles.bulkActions}>
                <button type="button" className={styles.bulkBtn} onClick={() => handleBulkAction('PUBLISH')}>
                  Publish Selected
                </button>
                <button type="button" className={styles.bulkBtn} onClick={() => handleBulkAction('ARCHIVE')}>
                  Archive Selected
                </button>
                <button type="button" className={`${styles.bulkBtn} ${styles.bulkBtnDanger}`} onClick={() => handleBulkAction('DELETE')}>
                  Soft Delete
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className={styles.tableContainer}>
            <table className={styles.newsTable}>
              <thead>
                <tr>
                  <th style={{ width: '36px' }}>
                    <input
                      type="checkbox"
                      checked={articles.length > 0 && selectedIds.length === articles.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(articles.map((a) => a.id));
                        else setSelectedIds([]);
                      }}
                    />
                  </th>
                  <th>Article &amp; Source</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Related Entities</th>
                  <th>Published</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px' }}>Loading articles...</td>
                  </tr>
                ) : articles.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '30px' }}>No articles found.</td>
                  </tr>
                ) : (
                  articles.map((article) => {
                    const isSelected = selectedIds.includes(article.id);
                    return (
                      <tr key={article.id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedIds([...selectedIds, article.id]);
                              else setSelectedIds(selectedIds.filter((id) => id !== article.id));
                            }}
                          />
                        </td>
                        <td>
                          <div className={styles.articleTitleCell}>
                            <span className={styles.articleHeadline}>{article.displayTitle}</span>
                            {article.hasAdminOverride && (
                              <span className={styles.overrideTag}>
                                <Edit2 size={9} />
                                ADMIN OVERRIDDEN
                              </span>
                            )}
                            <span className={styles.articleMetaSub}>
                              Source: {article.sourceName} • ID: {article.id}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={styles.categoryTag}>{article.displayCategory}</span>
                        </td>
                        <td>
                          <span
                            className={`${styles.statusBadge} ${
                              article.status === 'PUBLISHED'
                                ? styles.statusPublished
                                : article.status === 'DRAFT'
                                ? styles.statusDraft
                                : article.status === 'SCHEDULED'
                                ? styles.statusScheduled
                                : styles.statusArchived
                            }`}
                          >
                            {article.status}
                          </span>
                        </td>
                        <td>
                          {article.animeRelations?.map((rel: any) => (
                            <span key={rel.animeId} className={styles.entityPill}>
                              {rel.anime.canonicalTitle}
                            </span>
                          ))}
                          {article.studioRelations?.map((rel: any) => (
                            <span key={rel.studioId} className={styles.entityPill}>
                              {rel.studio.name}
                            </span>
                          ))}
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            {new Date(article.publishedAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td>
                          <div className={styles.tableActions}>
                            <Link aria-label="View Reader" href={`/news/${article.slug || article.id}`} target="_blank" className={styles.iconActionBtn} title="View Reader">
                              <Eye size={13} />
                            </Link>
                            <button aria-label="Edit / Override"
                              type="button"
                              className={styles.iconActionBtn}
                              onClick={() => setEditingArticle(article)}
                              title="Edit / Override"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button aria-label="Quality Check"
                              type="button"
                              className={styles.iconActionBtn}
                              onClick={() => handleRunQualityCheck(article.id)}
                              title="Quality Check"
                            >
                              <Shield size={13} />
                            </button>
                            {article.hasAdminOverride && (
                              <button aria-label="Reset to Provider Values"
                                type="button"
                                className={styles.iconActionBtn}
                                onClick={() => handleResetOverride(article.id)}
                                title="Reset to Provider Values"
                              >
                                <RotateCcw size={13} />
                              </button>
                            )}
                            {article.status === 'PUBLISHED' ? (
                              <button aria-label="Unpublish to Draft"
                                type="button"
                                className={styles.iconActionBtn}
                                onClick={() => handleStatusChange(article.id, 'UNPUBLISH')}
                                title="Unpublish to Draft"
                              >
                                <Archive size={13} />
                              </button>
                            ) : (
                              <button aria-label="Publish"
                                type="button"
                                className={styles.iconActionBtn}
                                onClick={() => handleStatusChange(article.id, 'PUBLISH')}
                                title="Publish"
                              >
                                <Check size={13} />
                              </button>
                            )}
                            <button aria-label="Soft Delete"
                              type="button"
                              className={styles.iconActionBtn}
                              onClick={() => handleStatusChange(article.id, 'DELETE')}
                              title="Soft Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className={styles.paginationBar}>
            <span className={styles.pageInfo}>
              Showing page {page} of {totalPages} ({total} total articles)
            </span>
            <div className={styles.pageBtns}>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </button>
              <button
                type="button"
                className={styles.pageBtn}
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CREATE ARTICLE */}
      {activeTab === 'create' && (
        <form onSubmit={handleCreateSubmit} style={{ background: 'var(--surface-main)', padding: '24px', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Create Manual Editorial Article</h3>
          
          <div className={styles.formRow}>
            <label>Headline / Title *</label>
            <input
              type="text"
              required
              className={styles.formInput}
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              placeholder="e.g. Solo Leveling Theatrical Anime Film Officially Confirmed for 2027"
            />
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formRow}>
              <label>Category</label>
              <select
                className={styles.formInput}
                value={createForm.category}
                onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
              >
                {CATEGORIES.filter((c) => c !== 'ALL').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className={styles.formRow}>
              <label>Initial Publication Status</label>
              <select
                className={styles.formInput}
                value={createForm.status}
                onChange={(e) => setCreateForm({ ...createForm, status: e.target.value })}
              >
                <option value="PUBLISHED">Publish Immediately</option>
                <option value="DRAFT">Save as Draft</option>
                <option value="SCHEDULED">Schedule for Future</option>
              </select>
            </div>
          </div>

          <div className={styles.formRow}>
            <label>Summary / Lead Paragraph</label>
            <textarea
              rows={3}
              className={styles.formInput}
              value={createForm.summary}
              onChange={(e) => setCreateForm({ ...createForm, summary: e.target.value })}
              placeholder="1-2 sentences summarizing key facts..."
            />
          </div>

          <div className={styles.formRow}>
            <label>Full Content (Markdown or Text)</label>
            <textarea
              rows={6}
              className={styles.formInput}
              value={createForm.content}
              onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
              placeholder="Article body content..."
            />
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formRow}>
              <label>Source Name Attribution</label>
              <input
                type="text"
                className={styles.formInput}
                value={createForm.sourceName}
                onChange={(e) => setCreateForm({ ...createForm, sourceName: e.target.value })}
              />
            </div>
            <div className={styles.formRow}>
              <label>Hero Image URL</label>
              <input
                type="url"
                className={styles.formInput}
                value={createForm.imageUrl}
                onChange={(e) => setCreateForm({ ...createForm, imageUrl: e.target.value })}
                placeholder="https://..."
              />
            </div>
          </div>

          {createForm.status === 'SCHEDULED' && (
            <div className={styles.formRow}>
              <label>Scheduled Publication Time (UTC)</label>
              <input
                type="datetime-local"
                className={styles.formInput}
                value={createForm.scheduledPublishAt}
                onChange={(e) => setCreateForm({ ...createForm, scheduledPublishAt: e.target.value })}
              />
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" className={styles.secondaryBtn} onClick={() => setActiveTab('articles')}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn}>
              Save Article
            </button>
          </div>
        </form>
      )}

      {/* TAB 5: OPERATIONS & HEALTH */}
      {activeTab === 'operations' && operationsData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Data Quality Score</span>
              <span className={styles.metricValue} style={{ color: '#00E676' }}>
                {operationsData.dataQuality.overallScore} / 100
              </span>
              <span className={styles.metricSubtitle}>Completeness &amp; URL Validity</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Provider Health</span>
              <span className={styles.metricValue}>
                {operationsData.providers.filter((p: any) => p.status === 'HEALTHY').length} / {operationsData.providers.length}
              </span>
              <span className={styles.metricSubtitle}>Active healthy adapters</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Ingestion Volume</span>
              <span className={styles.metricValue}>{operationsData.ingestionHealth.totalCreated}</span>
              <span className={styles.metricSubtitle}>Articles created in batch</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Duplicate Rate</span>
              <span className={styles.metricValue}>{operationsData.ingestionHealth.duplicateRate}%</span>
              <span className={styles.metricSubtitle}>Detected &amp; clustered</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: ANALYTICS */}
      {activeTab === 'analytics' && analyticsData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className={styles.metricsGrid}>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Article Opens</span>
              <span className={styles.metricValue}>{analyticsData.metrics.articleOpens}</span>
              <span className={styles.metricSubtitle}>Reader interactions</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Source Clicks</span>
              <span className={styles.metricValue}>{analyticsData.metrics.sourceClicks}</span>
              <span className={styles.metricSubtitle}>Outbound original reads</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Click-Through Rate</span>
              <span className={styles.metricValue}>{analyticsData.metrics.clickThroughRate}</span>
              <span className={styles.metricSubtitle}>Source interest conversion</span>
            </div>
            <div className={styles.metricCard}>
              <span className={styles.metricLabel}>Unique Readers</span>
              <span className={styles.metricValue}>{analyticsData.metrics.uniqueReaders}</span>
              <span className={styles.metricSubtitle}>Distinct user sessions</span>
            </div>
          </div>
        </div>
      )}

      {/* QUALITY CHECK RESULT MODAL */}
      {qualityCheckResult && (
        <div className={styles.modalOverlay} onClick={() => setQualityCheckResult(null)}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Automated Quality Inspector</h3>
              <button type="button" className={styles.modalCloseBtn} onClick={() => setQualityCheckResult(null)}>×</button>
            </div>
            <div className={styles.modalBody}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', background: 'var(--surface-elevated)', borderRadius: '4px' }}>
                <span>Quality Status: <strong>{qualityCheckResult.status}</strong></span>
                <span>Score: <strong>{qualityCheckResult.qualityScore} / 100</strong></span>
              </div>

              {qualityCheckResult.issues.length === 0 ? (
                <p style={{ color: '#00E676' }}>✓ All automated quality and safety checks passed.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {qualityCheckResult.issues.map((issue: any, idx: number) => (
                    <div
                      key={idx}
                      className={`${styles.issueCard} ${issue.severity === 'CRITICAL' ? styles.issueCritical : styles.issueWarning}`}
                    >
                      <span className={styles.issueMessage}>[{issue.severity}] {issue.message}</span>
                      <span className={styles.issueRemediation}>Remediation: {issue.remediation}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.modalFooter}>
              <button type="button" className={styles.primaryBtn} onClick={() => setQualityCheckResult(null)}>
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
