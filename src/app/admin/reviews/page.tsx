'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Shield,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle,
  EyeOff,
  Eye,
  Trash2,
  ExternalLink,
  Star,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import styles from './page.module.css';

const MODERATION_ROLES = new Set(['ADMIN', 'SUPER_ADMIN', 'MODERATOR']);

export default function AdminReviewsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();
  const authorized = !!user && MODERATION_ROLES.has(user.role);

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'HIDDEN' | 'REMOVED' | 'PENDING_REPORTS'>('ALL');
  const [search, setSearch] = useState('');
  const [reviews, setReviews] = useState<any[]>([]);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<any | null>(null);

  const fetchAdminReviews = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter === 'PENDING_REPORTS') {
        params.set('hasReports', 'true');
      } else if (statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }
      if (search.trim()) {
        params.set('search', search.trim());
      }
      params.set('page', String(page));
      params.set('limit', '20');

      const res = await fetch(`/api/admin/reviews?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
        setTotal(data.total || 0);
        setPendingReportsCount(data.pendingReportsCount || 0);
        setTotalPages(data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load admin reviews:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search, page]);

  useEffect(() => {
    if (authorized) {
      fetchAdminReviews();
    }
  }, [authorized, fetchAdminReviews]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchAdminReviews();
  };

  const handleModerate = async (reviewId: string, targetStatus: string, resolveReports = false) => {
    try {
      const res = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewId,
          status: targetStatus,
          resolveReports,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update review status');
      }

      showToast(`Review marked as ${targetStatus.toLowerCase()}`, 'success');
      fetchAdminReviews();
      if (selectedReview?.id === reviewId) {
        setSelectedReview(null);
      }
    } catch (err: any) {
      showToast(err.message || 'Moderation action failed', 'error');
    }
  };

  if (authLoading) {
    return (
      <div className={styles.loadingContainer}>
        <RefreshCw className={styles.spin} size={24} />
        <p>Verifying admin permissions...</p>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className={styles.unauthorized}>
        <Shield size={48} className={styles.shieldIcon} />
        <h2>Access Denied</h2>
        <p>You must have Admin or Moderator credentials to access Review Moderation.</p>
        <Link href="/" className={styles.homeBtn}>
          Return to Otakuva
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleRow}>
            <MessageSquare size={24} className={styles.headerIcon} />
            <h1 className={styles.title}>Review Moderation Queue</h1>
          </div>
          <p className={styles.subtitle}>
            Monitor, inspect, hide, restore, and resolve community reports on user reviews.
          </p>
        </div>

        <div className={styles.metricsRow}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Total Reviews</span>
            <span className={styles.metricVal}>{total}</span>
          </div>
          <div className={`${styles.metricCard} ${pendingReportsCount > 0 ? styles.metricAlert : ''}`}>
            <span className={styles.metricLabel}>Pending Reports</span>
            <span className={styles.metricVal}>{pendingReportsCount}</span>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className={styles.controlBar}>
        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${statusFilter === 'ALL' ? styles.tabActive : ''}`}
            onClick={() => {
              setStatusFilter('ALL');
              setPage(1);
            }}
          >
            All
          </button>
          <button
            type="button"
            className={`${styles.tab} ${statusFilter === 'PENDING_REPORTS' ? styles.tabActive : ''}`}
            onClick={() => {
              setStatusFilter('PENDING_REPORTS');
              setPage(1);
            }}
          >
            Pending Reports ({pendingReportsCount})
          </button>
          <button
            type="button"
            className={`${styles.tab} ${statusFilter === 'PUBLISHED' ? styles.tabActive : ''}`}
            onClick={() => {
              setStatusFilter('PUBLISHED');
              setPage(1);
            }}
          >
            Published
          </button>
          <button
            type="button"
            className={`${styles.tab} ${statusFilter === 'HIDDEN' ? styles.tabActive : ''}`}
            onClick={() => {
              setStatusFilter('HIDDEN');
              setPage(1);
            }}
          >
            Hidden
          </button>
          <button
            type="button"
            className={`${styles.tab} ${statusFilter === 'REMOVED' ? styles.tabActive : ''}`}
            onClick={() => {
              setStatusFilter('REMOVED');
              setPage(1);
            }}
          >
            Removed
          </button>
        </div>

        <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
          <Search size={14} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search anime, user, or headline..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="submit" className={styles.searchBtn}>
            Search
          </button>
        </form>
      </div>

      {/* Reviews Table */}
      <div className={styles.tableWrap}>
        {isLoading ? (
          <div className={styles.loadingBox}>
            <RefreshCw className={styles.spin} size={20} />
            <span>Loading reviews queue...</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className={styles.emptyBox}>
            <CheckCircle size={36} className={styles.checkIcon} />
            <p>No reviews match the current filter criteria.</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Anime</th>
                <th>Author</th>
                <th>Review Details</th>
                <th>Status</th>
                <th>Reports</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id}>
                  {/* Anime */}
                  <td>
                    <div className={styles.animeCell}>
                      <Link
                        href={`/anime/${r.anime.slug || r.anime.id}`}
                        target="_blank"
                        className={styles.animeLink}
                      >
                        <span>{r.anime.title}</span>
                        <ExternalLink size={11} />
                      </Link>
                    </div>
                  </td>

                  {/* Author */}
                  <td>
                    <div className={styles.userCell}>
                      <Link
                        href={`/profile/${r.user.username}`}
                        target="_blank"
                        className={styles.authorName}
                      >
                        {r.user.username}
                      </Link>
                      {r.user.role !== 'USER' && (
                        <span className={styles.roleTag}>{r.user.role}</span>
                      )}
                    </div>
                  </td>

                  {/* Review Details */}
                  <td>
                    <div className={styles.detailsCell}>
                      <div className={styles.detailsMeta}>
                        {r.rating !== null && (
                          <span className={styles.ratingBadge}>
                            <Star size={10} fill="#F59E0B" stroke="#F59E0B" />
                            {r.rating.toFixed(1)}
                          </span>
                        )}
                        <span className={styles.spoilerTag}>{r.spoilerLevel}</span>
                        <span className={styles.dateCell}>
                          {new Date(r.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <strong className={styles.reviewTitleCell}>{r.title}</strong>
                      <p className={styles.reviewExcerpt}>{r.body}</p>
                    </div>
                  </td>

                  {/* Status */}
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        r.status === 'PUBLISHED'
                          ? styles.statusPublished
                          : r.status === 'HIDDEN'
                          ? styles.statusHidden
                          : styles.statusRemoved
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>

                  {/* Reports */}
                  <td>
                    {r.reportCount > 0 ? (
                      <button
                        type="button"
                        className={`${styles.reportCountBadge} ${
                          r.pendingReportCount > 0 ? styles.reportPendingBadge : ''
                        }`}
                        onClick={() => setSelectedReview(r)}
                      >
                        <AlertTriangle size={12} />
                        <span>{r.pendingReportCount} pending ({r.reportCount} total)</span>
                      </button>
                    ) : (
                      <span className={styles.zeroReports}>0</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td>
                    <div className={styles.actionButtons}>
                      {r.status === 'PUBLISHED' ? (
                        <button
                          type="button"
                          className={styles.actionBtnHide}
                          title="Hide Review"
                          onClick={() => handleModerate(r.id, 'HIDDEN')}
                        >
                          <EyeOff size={13} />
                          <span>Hide</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className={styles.actionBtnRestore}
                          title="Restore Review"
                          onClick={() => handleModerate(r.id, 'PUBLISHED', true)}
                        >
                          <Eye size={13} />
                          <span>Restore</span>
                        </button>
                      )}

                      {r.status !== 'REMOVED' && (
                        <button
                          type="button"
                          className={styles.actionBtnRemove}
                          title="Remove Review"
                          onClick={() => handleModerate(r.id, 'REMOVED', true)}
                        >
                          <Trash2 size={13} />
                          <span>Remove</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reports Details Modal */}
      {selectedReview && (
        <div className={styles.modalOverlay} onClick={() => setSelectedReview(null)}>
          <div className={styles.inspectModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.inspectHeader}>
              <div>
                <h3 className={styles.inspectTitle}>Review Reports</h3>
                <p className={styles.inspectSub}>Review: &quot;{selectedReview.title}&quot;</p>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setSelectedReview(null)}
              >
                ✕
              </button>
            </div>

            <div className={styles.inspectBody}>
              <div className={styles.inspectFullReview}>
                <strong>Review Text by @{selectedReview.user.username}:</strong>
                <p>{selectedReview.body}</p>
              </div>

              <h4 className={styles.reportsHeading}>User Reports ({selectedReview.reports.length})</h4>
              <div className={styles.reportsList}>
                {selectedReview.reports.map((rep: any) => (
                  <div key={rep.id} className={styles.reportCard}>
                    <div className={styles.reportTop}>
                      <span className={styles.reportReasonBadge}>{rep.reason}</span>
                      <span className={styles.reportStatusBadge}>{rep.status}</span>
                      <span className={styles.reportDate}>
                        by @{rep.reporter} • {new Date(rep.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {rep.details && <p className={styles.reportDetailsText}>{rep.details}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.inspectFooter}>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => setSelectedReview(null)}
              >
                Close
              </button>
              <button
                type="button"
                className={styles.btnHide}
                onClick={() => handleModerate(selectedReview.id, 'HIDDEN', true)}
              >
                Hide & Resolve Reports
              </button>
              <button
                type="button"
                className={styles.btnResolveOnly}
                onClick={() => handleModerate(selectedReview.id, selectedReview.status, true)}
              >
                Dismiss / Resolve Reports
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
