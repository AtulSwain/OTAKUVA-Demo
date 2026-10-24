'use client';

import { useCallback, useState } from 'react';
import { useToast } from '../../context/ToastContext';

export interface AnimeListOption {
  id: string;
  name: string;
  count: number;
  visibility: 'PRIVATE' | 'LINK' | 'PUBLIC';
  covers: string[];
  containsAnime?: boolean;
}

/**
 * The signed-in user's lists, as seen from one anime: which ones contain it,
 * toggling it in/out, and creating a new list that starts with it. Shared by
 * the anime page's Add to Library menu and the AddToListModal picker so both
 * behave the same. Every change is optimistic and rolls back on failure.
 */
export function useAnimeLists(animeId: string, animeTitle: string) {
  const { showToast } = useToast();
  const [lists, setLists] = useState<AnimeListOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/lists?mine=1&containsAnimeId=${encodeURIComponent(animeId)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
      setLists(data.lists || []);
    } catch (e: any) {
      setError(e?.message ? `Couldn't load your lists: ${e.message}` : "Couldn't load your lists.");
      setLists([]);
    }
  }, [animeId]);

  const toggle = useCallback(
    async (list: AnimeListOption) => {
      if (busyId) return;
      const adding = !list.containsAnime;
      setBusyId(list.id);
      setLists((prev) => prev?.map((l) => (l.id === list.id ? { ...l, containsAnime: adding, count: l.count + (adding ? 1 : -1) } : l)) ?? prev);
      try {
        const res = adding
          ? await fetch(`/api/lists/${list.id}/items`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ animeId }),
            })
          : await fetch(`/api/lists/${list.id}/items/${encodeURIComponent(animeId)}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error);
        setLists((prev) => prev?.map((l) => (l.id === list.id ? { ...l, count: data.count ?? l.count } : l)) ?? prev);
        showToast(adding ? `Added to ${list.name}` : `Removed from ${list.name}`, 'success');
      } catch (e: any) {
        setLists((prev) => prev?.map((l) => (l.id === list.id ? { ...l, containsAnime: !adding, count: list.count } : l)) ?? prev);
        showToast(e?.message || "Couldn't update the list", 'error');
      } finally {
        setBusyId(null);
      }
    },
    [animeId, busyId, showToast]
  );

  /** Creates a list that already contains this anime. Resolves true on success. */
  const create = useCallback(
    async (rawName: string): Promise<boolean> => {
      const name = rawName.trim();
      if (!name || creating) return false;
      setCreating(true);
      try {
        const res = await fetch('/api/lists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, animeId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        setLists((prev) => [{ ...data.list, containsAnime: true }, ...(prev ?? [])]);
        showToast(`Created “${data.list.name}” with ${animeTitle}`, 'success');
        return true;
      } catch (e: any) {
        showToast(e?.message ? `Couldn't create the list: ${e.message}` : "Couldn't create the list", 'error');
        return false;
      } finally {
        setCreating(false);
      }
    },
    [animeId, animeTitle, creating, showToast]
  );

  return { lists, error, busyId, creating, load, toggle, create };
}
