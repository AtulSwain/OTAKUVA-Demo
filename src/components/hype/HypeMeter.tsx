'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, Sparkles, type LucideIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLibrary } from '../../context/LibraryContext';
import { promptPhoneVerification } from '../auth/VerifyPhonePrompt';
import { HYPE_LEVELS, HYPE_LEVEL_INFO, type HypeCounts, type HypeLevel } from '../../lib/hype/hypeLevels';
import { HypeFx } from './HypeFx';
import styles from './Hype.module.css';
import hx from './HypeMeter.module.css';

/** The hype icon everywhere (sparkles since 2026-10-27, owner; was Zap). */
export const HypeIcon: LucideIcon = Sparkles;
export const HYPE_ICONS: Record<HypeLevel, LucideIcon> = {
  HYPED: HypeIcon,
};

/** What a member sees once they've voted. */
const VOTED_LINE: Record<HypeLevel, string> = {
  HYPED: "You're hyped for this anime",
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
 * "You are hyped for this one". "Not interested" was retired 2026-10-25:
 * those stored votes aren't counted, so those members see the question
 * again. The homepage Hype board still shows counts.
 */
export function HypeMeter({
  animeId,
  animeTitle,
  compact = false,
}: {
  animeId: string;
  animeTitle: string;
  /** Hero version (2026-10-27, owner): one pill under Add to Library, same shape and size. */
  compact?: boolean;
  /** Accepted for compatibility; no longer shown here. */
  premiereDate?: string | null;
}) {
  const { user, openAuthModal } = useAuth();
  const { showToast } = useToast();
  const { getItem, applyTracking } = useLibrary();
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
      // The server added it to the library as Plan to Watch (only if it wasn't
      // there) — show it as tracked straight away.
      if (level === 'HYPED' && !getItem(animeId)) applyTracking(animeId, { status: 'plan_to_watch' });
      if (compact) showToast("You're hyped! It's in your library — we'll tell you when episode 1 is live.");
    } catch (err) {
      showToast((err as Error).message, 'error');
      load();
    } finally {
      setBusy(false);
    }
  };

  // Just the choice (2026-10-23, owner: "remove all the unnecessary
  // information") — no heading, dates, counts or split bar.
  if (!data.open && !data.mine) return null;

  if (compact) {
    return data.mine ? (
      <div
        className={`${hx.pill} ${hx.pillOn} ${justVoted ? hx.answerFresh : ''}`}
        role="status"
        title={data.open ? "In your library — we'll notify you when episode 1 is live" : undefined}
      >
        <HypeFx level={data.mine} active />
        <HypeIcon size={15} aria-hidden="true" className={hx.choiceIcon} />
        <span className={hx.choiceLabel}>You&apos;re hyped</span>
      </div>
    ) : (
      <button
        type="button"
        className={`${hx.pill} ${hx.pillAsk}`}
        onClick={() => vote('HYPED')}
        disabled={busy}
        aria-label={`I'm hyped for ${animeTitle}`}
      >
        <HypeFx level="HYPED" active />
        <HypeIcon size={15} aria-hidden="true" className={hx.choiceIcon} />
        <span className={hx.choiceLabel}>I&apos;m hyped</span>
      </button>
    );
  }

  return (
    <section className={hx.card} aria-label={`Are you hyped for ${animeTitle}?`}>
      {/* One option only (owner, 2026-10-24): "Are you hyped for this anime?"
          → I'm hyped. No "not interested" choice on the anime page. */}
      {data.open && !data.mine && (
        <div className={hx.ask}>
          <span className={hx.question}>Are you hyped for this anime?</span>
          <button type="button" className={`${hx.choice} ${hx.hype}`} onClick={() => vote('HYPED')} disabled={busy}>
            <HypeFx level="HYPED" active />
            <HypeIcon size={18} aria-hidden="true" className={hx.choiceIcon} />
            <span className={hx.choiceLabel}>I&apos;m hyped</span>
          </button>
        </div>
      )}

      {data.mine && (
        <div className={`${hx.answer} ${hx.answerHype} ${justVoted ? hx.answerFresh : ''}`} role="status">
          <HypeFx level={data.mine} active />
          <HypeIcon size={17} aria-hidden="true" className={hx.choiceIcon} />
          <span className={hx.choiceLabel}>{VOTED_LINE[data.mine]}</span>
        </div>
      )}

      {/* Hyped = tracked + told at the premiere (owner, 2026-10-25). */}
      {data.mine === 'HYPED' && data.open && (
        <p className={hx.tracking}>
          <BellRing size={13} aria-hidden="true" />
          {justVoted ? 'Added to your library.' : 'In your library.'} We&apos;ll notify you the moment episode 1 is live.
        </p>
      )}
    </section>
  );
}
