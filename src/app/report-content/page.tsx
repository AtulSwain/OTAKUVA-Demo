'use client';

import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import styles from './report-content.module.css';

const TARGET_TYPES = [
  { value: 'DISCUSSION', label: 'A discussion' },
  { value: 'COMMENT', label: 'A comment' },
  { value: 'MESSAGE', label: 'A community chat message' },
  { value: 'USER', label: 'A user profile' },
  { value: 'COMMUNITY', label: 'A community' },
] as const;

const REASONS = [
  { value: 'SPAM', label: 'Spam' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'HATE', label: 'Hate speech' },
  { value: 'OFFENSIVE', label: 'Offensive content' },
  { value: 'SPOILER_MISUSE', label: 'Untagged / misused spoiler' },
  { value: 'PIRACY', label: 'Piracy or illegal streaming links' },
  { value: 'MISINFORMATION', label: 'Misinformation' },
  { value: 'OTHER', label: 'Something else' },
] as const;

function isValidTargetType(value: string | null): value is (typeof TARGET_TYPES)[number]['value'] {
  return TARGET_TYPES.some((t) => t.value === value);
}

function ReportContentForm() {
  const { user, openAuthModal } = useAuth();
  const searchParams = useSearchParams();

  // A "Report" button elsewhere in the app can deep-link here with the
  // target already known (?targetType=COMMENT&targetId=...), which locks
  // those two fields since the reporter shouldn't be guessing an ID by
  // hand in that case. Landed on directly (e.g. from the footer), it's a
  // generic form instead.
  const presetType = searchParams?.get('targetType') ?? null;
  const presetId = searchParams?.get('targetId') ?? null;
  const hasPresetTarget = isValidTargetType(presetType) && Boolean(presetId);

  const [targetType, setTargetType] = useState<string>(hasPresetTarget ? (presetType as string) : TARGET_TYPES[0].value);
  const [targetId, setTargetId] = useState(hasPresetTarget ? (presetId as string) : '');
  const [reason, setReason] = useState<string>(REASONS[0].value);
  const [description, setDescription] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (!user) {
    return (
      <div className={styles.signInPrompt}>
        <p>You need to be signed in to report content.</p>
        <button type="button" className={styles.signInBtn} onClick={() => openAuthModal('login')}>
          Sign in
        </button>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId.trim()) {
      setState('error');
      setMessage('Enter what you’re reporting.');
      return;
    }

    setState('sending');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType,
          targetId: targetId.trim(),
          reason,
          description: description.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState('error');
        setMessage(data.error || 'Could not send the report.');
        return;
      }
      setState('done');
      setMessage(
        data.alreadyReported
          ? 'You already reported this — moderators will review it.'
          : 'Thanks — moderators will review this report.'
      );
    } catch {
      setState('error');
      setMessage('Could not send the report. Check your connection and try again.');
    }
  };

  if (state === 'done') {
    return <div className={styles.messageSuccess}>{message}</div>;
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      {hasPresetTarget ? (
        <div className={styles.contextBanner}>
          Reporting a <strong>{TARGET_TYPES.find((t) => t.value === targetType)?.label.toLowerCase()}</strong>.
        </div>
      ) : (
        <>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="targetType">
              What are you reporting?
            </label>
            <select
              id="targetType"
              className={styles.select}
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
            >
              {TARGET_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="targetId">
              Content ID
            </label>
            <input
              id="targetId"
              className={styles.input}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="Paste the ID of the user, community, discussion, comment, or message"
            />
            <span className={styles.hint}>
              If you’re not sure where to find this, use the Report button next to the specific
              content instead — it fills this in for you.
            </span>
          </div>
        </>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="reason">
          Reason
        </label>
        <select id="reason" className={styles.select} value={reason} onChange={(e) => setReason(e.target.value)}>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="description">
          Additional details (optional)
        </label>
        <textarea
          id="description"
          className={styles.textarea}
          maxLength={1000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Anything moderators should know"
        />
      </div>

      {state === 'error' && <p className={styles.messageError} role="alert">{message}</p>}

      <div className={styles.actions}>
        <button type="submit" className={styles.submitBtn} disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Send report'}
        </button>
      </div>
    </form>
  );
}

export default function ReportContentPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Report content</h1>
        <p className={styles.subtitle}>
          Reports go to OTAKUVA’s moderation queue for review. Use this for anything that
          violates the community guidelines — harassment, spam, hate speech, piracy links,
          untagged spoilers, or anything else that shouldn’t be here.
        </p>
      </div>

      <Suspense fallback={null}>
        <ReportContentForm />
      </Suspense>
    </div>
  );
}
