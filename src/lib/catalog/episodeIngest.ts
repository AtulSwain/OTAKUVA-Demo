/**
 * OTAKUVA — single-episode upsert, shared between src/lib/syncEngine.ts's
 * syncEpisodes() (fetches every page up front, one anime at a time) and
 * src/lib/catalog/episodeBackfillEngine.ts (writes each page as it's
 * fetched, resumable across many anime via SyncCheckpoint) — both need the
 * exact same episode field mapping; one implementation instead of two
 * that could quietly diverge.
 */

import { prisma } from '../prisma';
import { validateAndNormalizeEpisode } from '../normalizers';
import type { ProviderEpisode } from '../providers/animeProvider.interface';

export interface EpisodeUpsertResult {
  success: boolean;
  /** True when this write is the reason the episode counts as "aired" —
   * either it didn't exist before and was created with an airedAt in the
   * past/now, or it existed but its airedAt just transitioned from
   * null/future to past/now. False on every subsequent sync of an
   * already-aired episode, so callers can fire a "new episode" library
   * notification exactly once per episode instead of on every re-sync. */
  isNewlyAired: boolean;
}

/** Upserts one episode. Returns whether it succeeded — invalid episodes (see validateAndNormalizeEpisode) are skipped, not thrown, same as the pre-extraction behavior — plus whether this write just made the episode newly "aired" (see EpisodeUpsertResult). */
export async function upsertEpisodeFromProvider(animeId: string, ep: ProviderEpisode): Promise<EpisodeUpsertResult> {
  try {
    const norm = validateAndNormalizeEpisode(ep, animeId);
    const now = new Date();

    const existing = await prisma.episode.findUnique({
      where: { animeId_number: { animeId, number: norm.number } },
      select: { airedAt: true },
    });

    const wasAlreadyAired = Boolean(existing?.airedAt && existing.airedAt <= now);
    const isNowAired = Boolean(norm.airedAt && norm.airedAt <= now);
    const isNewlyAired = isNowAired && !wasAlreadyAired;

    await prisma.episode.upsert({
      where: { animeId_number: { animeId, number: norm.number } },
      update: {
        title: norm.title,
        titleJapanese: norm.titleJapanese,
        synopsis: norm.synopsis,
        airedAt: norm.airedAt,
        filler: norm.filler,
        recap: norm.recap,
        externalUrl: norm.externalUrl,
        imageUrl: norm.imageUrl,
        updatedAt: new Date(),
      },
      create: {
        animeId,
        externalId: norm.externalId,
        number: norm.number,
        title: norm.title,
        titleJapanese: norm.titleJapanese,
        synopsis: norm.synopsis,
        airedAt: norm.airedAt,
        filler: norm.filler,
        recap: norm.recap,
        externalUrl: norm.externalUrl,
        imageUrl: norm.imageUrl,
      },
    });
    return { success: true, isNewlyAired };
  } catch {
    return { success: false, isNewlyAired: false };
  }
}

/**
 * Notifies every user tracking `animeId` as WATCHING or PLAN_TO_WATCH
 * that new episode(s) have aired. Called once per anime per sync/backfill
 * batch (not once per episode) by both callers of
 * upsertEpisodeFromProvider above, so catching up a show that was behind
 * by several episodes produces one notification, not a flood. Best-effort
 * — mirrors every other notification call site in this codebase (e.g.
 * communityEngine.ts's join-request/new-discussion notifiers): a
 * notification failure must never fail the sync/backfill job itself.
 */
export async function notifyLibraryUsersOfNewEpisodes(animeId: string, newEpisodeCount: number): Promise<void> {
  if (newEpisodeCount <= 0) return;
  try {
    const [anime, trackers] = await Promise.all([
      prisma.anime.findUnique({ where: { id: animeId }, select: { canonicalTitle: true, slug: true } }),
      prisma.userAnime.findMany({
        where: { animeId, status: { in: ['WATCHING', 'PLAN_TO_WATCH'] } },
        select: { userId: true },
      }),
    ]);

    if (!anime || trackers.length === 0) return;

    const body =
      newEpisodeCount === 1
        ? `A new episode of ${anime.canonicalTitle} just aired.`
        : `${newEpisodeCount} new episodes of ${anime.canonicalTitle} just aired.`;

    await prisma.notification.createMany({
      data: trackers.map((t) => ({
        userId: t.userId,
        type: 'NEW_EPISODE',
        title: 'New episode',
        body,
        linkUrl: `/anime/${anime.slug}`,
      })),
    });
  } catch (err) {
    console.error('[episodeIngest] Failed to notify library users of new episode(s)', {
      animeId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
