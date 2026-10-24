'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Rocket, Ban, BookmarkPlus, Check, Flame, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLibrary } from '../../context/LibraryContext';
import { promptPhoneVerification } from '../auth/VerifyPhonePrompt';
import { HYPE_LEVELS, HYPE_LEVEL_INFO, type HypeCounts, type HypeLevel } from '../../lib/hype/hypeLevels';
import { HypeFx } from './HypeFx';
import styles from './Hype.module.css';
import hx from './HypeMeter.module.css';

export const HYPE_ICONS: Record<HypeLevel, LucideIcon> = {
  HYPED: Rocket,
  SKIP: Ban,
};

/** What a member sees once they've voted. */
const VOTED_LINE: Record<HypeLevel, string> = {
  HYPED: 'You are hyped for this one',
  SKIP: 'Not interested — got it',
};

interface Summary {
  open: boolean;
  counts: HypeCounts;
  total: number;
  percent: number | null;
  mine: HypeLevel | null;
}

/** Stacked bar of the four levels. */
export function HypeBar({ counts, total, height = 8 }: { counts: HypeCounts; total: number; height?: number }) {
  return (
    <span className={styles.stack} style={{ height }} aria-hidden="true">
      {total > 0 &&
        HYPE_LEVELS.map((l) =>
          counts[l] > 0 ? <span key={l} style={{ width: `${(counts[l] / total) * 100}%`, background: HYPE_LEVEL_INFO[l].color }} /> : null
        )}
    </span>
  );
}


/**
 * "Are you hyped?" — the pre-premiere choice on an upcoming anime's page.
 * One question, one button since 2026-10-24 (owner): "Are you hyped for
 * this anime?" → I'm hyped (flame, embers running). No "not interested"
 * choice here. One vote, final once cast (2026-10-21): afterwards it reads
 * "You are hyped for this one". Members who voted Not interested before
 * still see that answer. The homepage Hype board still shows counts.
 */
export function HypeMeter({
  animeId,
  animeTitle,
}: {
  animeId: string;
  animeTitle: string;
  /** Accepted for compatibility; no longer shown here. */
  premiereDate?: string | null;
}) {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const { getItem, updateStatus } = useLibrary();
  const [data, setData] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [justVoted, setJustVoted] = useState<HypeLevel | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/anime/${encodeURIComponent(animeId)}/hype`, { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } catch {
      /* the meter just doesn't show */
    }
  }, [animeId]);

  useEffect(() => {
    load();
  }, [load, user?.id]);

  if (!data) return null;
  if (!data.open && data.total === 0) return null;

  const vote = async (level: HypeLevel) => {
    if (!user) return openAuthModal('login');
    // A vote is final (2026-10-21): once cast there's nothing to click.
    if (busy || !data.open || data.mine) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/anime/${encodeURIComponent(animeId)}/hype`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (body.code === 'PHONE_NOT_VERIFIED') return promptPhoneVerification('rate');
        throw new Error(body.error || 'Could not save your vote.');
      }
      setData(body);
      setJustVoted(level);
    } catch (err) {
      showToast((err as Error).message, 'error');
      load();
    } finally {
      setBusy(false);
    }
  };

  const inLibrary = Boolean(getItem(animeId));
  const offerPlan = justVoted && justVoted === 'HYPED' && !inLibrary;

  // Just the choice (2026-10-23, owner: "remove all the unnecessary
  // information") — no heading, dates, counts or split bar.
  if (!data.open && !data.mine) return null;

  return (
    <section className={hx.card} aria-label={`Are you hyped for ${animeTitle}?`}>
      {/* One option only (owner, 2026-10-24): "Are you hyped for this anime?"
          → I'm hyped. No "not interested" choice on the anime page. */}
      {data.open && !data.mine && (
        <div className={hx.ask}>
          <span className={hx.question}>Are you hyped for this anime?</span>
          <button type="button" className={`${hx.choice} ${hx.hype}`} onClick={() => vote('HYPED')} disabled={busy}>
            <HypeFx level="HYPED" active />
            <Flame size={18} aria-hidden="true" className={hx.choiceIcon} />
            <span className={hx.choiceLabel}>I&apos;m hyped</span>
          </button>
        </div>
      )}

      {data.mine && (
        <div
          className={`${hx.answer} ${data.mine === 'HYPED' ? hx.answerHype : hx.answerSkip} ${justVoted ? hx.answerFresh : ''}`}
          role="status"
        >
          <HypeFx level={data.mine} active />
          {data.mine === 'HYPED' ? (
            <Flame size={17} aria-hidden="true" className={hx.choiceIcon} />
          ) : (
            <Check size={16} strokeWidth={3} aria-hidden="true" className={hx.choiceIcon} />
          )}
          <span className={hx.choiceLabel}>{VOTED_LINE[data.mine]}</span>
        </div>
      )}

      {offerPlan && (
        <div className={hx.plan}>
          <button
            type="button"
            className={hx.planBtn}
            onClick={async () => {
              const ok = await updateStatus(animeId, 'plan_to_watch');
              if (ok) {
                showToast('Added to Plan to Watch', 'success');
                setJustVoted(null);
              }
            }}
          >
            <BookmarkPlus size={14} aria-hidden="true" /> Add to Plan to Watch
          </button>
        </div>
      )}
    </section>
  );
}
