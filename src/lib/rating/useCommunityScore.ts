'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { CommunityScore } from './communityScores';

/**
 * Client cache for members' OTAKUVA score + retention on cards (2026-10-21).
 * Every card asks for its anime id; ids requested in the same tick go out as
 * one `GET /api/anime/community-scores` call. After any rating/retention
 * change, `notifyCommunityScoresChanged()` refetches everything on screen,
 * so cards update the moment someone rates.
 */

const CHANGED_EVENT = 'otakuva:community-scores-changed';
const BATCH = 100;

const cache = new Map<string, CommunityScore | null>(); // null = loaded, nobody rated it
const inflight = new Set<string>();
const queued = new Set<string>();
const mounted = new Map<string, number>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;
let version = 0;

const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};

async function flush() {
  timer = null;
  const ids = Array.from(queued);
  queued.clear();
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    chunk.forEach((id) => inflight.add(id));
    try {
      const res = await fetch(`/api/anime/community-scores?ids=${chunk.map(encodeURIComponent).join(',')}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(String(res.status));
      const { scores } = (await res.json()) as { scores: Record<string, CommunityScore> };
      for (const id of chunk) cache.set(id, scores[id] ?? null);
    } catch {
      // Leave uncached: the card simply shows no score; a later mount retries.
    } finally {
      chunk.forEach((id) => inflight.delete(id));
    }
  }
  emit();
}

function request(id: string) {
  if (cache.has(id) || inflight.has(id) || queued.has(id)) return;
  queued.add(id);
  if (!timer) timer = setTimeout(flush, 0);
}

/** Call after a member rates/unrates an anime or sets episode retention. */
export function notifyCommunityScoresChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHANGED_EVENT));
}

if (typeof window !== 'undefined') {
  window.addEventListener(CHANGED_EVENT, () => {
    cache.clear();
    mounted.forEach((_n, id) => request(id));
    emit();
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Members' score/retention for one anime: undefined while loading, null when nobody rated it. */
export function useCommunityScore(animeId: string | null | undefined): CommunityScore | null | undefined {
  useSyncExternalStore(subscribe, () => version, () => 0);
  useEffect(() => {
    if (!animeId) return;
    mounted.set(animeId, (mounted.get(animeId) ?? 0) + 1);
    request(animeId);
    return () => {
      const n = (mounted.get(animeId) ?? 1) - 1;
      if (n <= 0) mounted.delete(animeId);
      else mounted.set(animeId, n);
    };
  }, [animeId]);
  return animeId ? cache.get(animeId) : undefined;
}
