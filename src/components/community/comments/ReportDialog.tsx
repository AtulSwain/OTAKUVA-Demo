'use client';

import React, { useEffect, useState } from 'react';
import styles from './Comments.module.css';

export const REPORT_REASONS = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'OFFENSIVE', label: 'Offensive content' },
  { value: 'SPOILER', label: 'Untagged spoiler' },
  { value: 'MISINFORMATION', label: 'Misinformation' },
  { value: 'OTHER', label: 'Something else' },
] as const;

interface ReportDialogProps {
  targetType: 'COMMENT' | 'DISCUSSION';
  targetId: string;
  onClose: () => void;
}

/** Report a comment or discussion to moderators (POST /api/reports). */
export const ReportDialog: React.FC<ReportDialogProps> = ({ targetType, targetId, onClose }) => {
  const [reason, setReason] = useState<string>('SPAM');
  const [details, setDetails] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setState('sending');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason, description: details.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState('error');
        setMessage(data.error || 'Could not send the report.');
        return;
      }
      setState('done');
      setMessage(data.alreadyReported ? 'You already reported this. Moderators will review it.' : 'Thanks — moderators will review it.');
    } catch {
      setState('error');
      setMessage('Could not send the report. Check your connection.');
    }
  };

  return (
    <div className={styles.dialogBackdrop} onClick={onClose}>
      <div className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="report-title" className={styles.dialogTitle}>
          Report {targetType === 'COMMENT' ? 'comment' : 'discussion'}
        </h3>
        {state === 'done' ? (
          <>
            <p className={styles.dialogText}>{message}</p>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.postBtn} onClick={onClose}>Done</button>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <fieldset className={styles.reasonList}>
              <legend className={styles.srOnly}>Reason</legend>
              {REPORT_REASONS.map((r) => (
                <label key={r.value} className={styles.reasonOption}>
                  <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} />
                  <span>{r.label}</span>
                </label>
              ))}
            </fieldset>
            <label className={styles.srOnly} htmlFor="report-details">Details</label>
            <textarea
              id="report-details"
              className={styles.dialogInput}
              rows={3}
              maxLength={1000}
              placeholder="Anything moderators should know (optional)"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
            />
            {state === 'error' && <p className={styles.composerError} role="alert">{message}</p>}
            <div className={styles.dialogActions}>
              <button type="button" className={styles.linkBtn} onClick={onClose}>Cancel</button>
              <button type="submit" className={styles.postBtn} disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending…' : 'Send report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
