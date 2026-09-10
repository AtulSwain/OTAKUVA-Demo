'use client';

import React, { useState } from 'react';
import { X, Flag, AlertTriangle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import styles from './ReportReviewModal.module.css';

interface ReportReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reviewId: string;
  reviewTitle?: string;
}

const REPORT_REASONS = [
  { key: 'UNTAGGED_SPOILER', label: 'Untagged Spoiler', desc: 'Contains major plot reveals without proper spoiler warning' },
  { key: 'SPAM_OR_TROLLING', label: 'Spam or Trolling', desc: 'Low effort, promotional link, or intentional bait' },
  { key: 'HARASSMENT_OR_HATE', label: 'Harassment or Hate Speech', desc: 'Attacking users, creators, or toxic conduct' },
  { key: 'OFF_TOPIC', label: 'Off-Topic or Misinformation', desc: 'Not a review of this anime' },
  { key: 'OTHER', label: 'Other', desc: 'Any other violation of community guidelines' },
];

export const ReportReviewModal: React.FC<ReportReviewModalProps> = ({
  isOpen,
  onClose,
  reviewId,
  reviewTitle,
}) => {
  const { showToast } = useToast();
  const [reason, setReason] = useState('UNTAGGED_SPOILER');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/reviews/${reviewId}/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          details: details.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit report');
      }

      showToast('Thank you. Your report has been submitted to moderators.', 'info');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerTitleRow}>
            <Flag size={16} className={styles.flagIcon} />
            <h2 className={styles.headerTitle}>Report Review</h2>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {reviewTitle && <p className={styles.reviewContext}>&quot;{reviewTitle}&quot;</p>}
          {error && <div className={styles.errorBox}>{error}</div>}

          <div className={styles.reasonsList}>
            {REPORT_REASONS.map((r) => (
              <label
                key={r.key}
                className={`${styles.reasonItem} ${reason === r.key ? styles.reasonItemActive : ''}`}
              >
                <input
                  type="radio"
                  name="reportReason"
                  value={r.key}
                  checked={reason === r.key}
                  onChange={() => setReason(r.key)}
                  className={styles.radioInput}
                />
                <div className={styles.reasonText}>
                  <span className={styles.reasonLabel}>{r.label}</span>
                  <span className={styles.reasonDesc}>{r.desc}</span>
                </div>
              </label>
            ))}
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Additional Details (Optional)</label>
            <textarea
              className={styles.textarea}
              placeholder="Provide any additional context for the moderation team..."
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
