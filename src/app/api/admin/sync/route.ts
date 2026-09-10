import { NextRequest, NextResponse } from 'next/server';
import { syncEngine } from '../../../../lib/syncEngine';
import { anilistProvider, jikanProvider } from '../../../../lib/providers';
import { requireRole } from '../../../../lib/auth';
import { ScheduleEngine } from '../../../../lib/engine/schedule/scheduleEngine';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'DATA_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const { action, externalId, provider = 'anilist', maxPages = 2 } = body;

    if (action === 'SYNC_ANIME') {
      if (!externalId) {
        return NextResponse.json({ error: 'externalId is required for SYNC_ANIME' }, { status: 400 });
      }
      const p = provider === 'jikan' ? jikanProvider : anilistProvider;
      const rawAnime = await p.getAnime(String(externalId));
      if (!rawAnime) {
        return NextResponse.json({ error: 'Anime not found on provider' }, { status: 404 });
      }
      const res = await syncEngine.ingestAnime(rawAnime, provider);
      await Promise.allSettled([
        syncEngine.syncEpisodes(res.animeId, String(externalId), 'jikan'),
        syncEngine.syncCharacters(res.animeId, String(externalId), 'anilist'),
        syncEngine.syncStaff(res.animeId, String(externalId), 'anilist'),
        syncEngine.syncRelations(res.animeId, String(externalId), 'anilist'),
      ]);
      return NextResponse.json({ success: true, ...res });
    }

    if (action === 'SYNC_CATALOG') {
      const res = await syncEngine.syncCatalog(provider, maxPages, 'FULL_CATALOG');
      return NextResponse.json(res);
    }

    if (action === 'SYNC_AIRING') {
      const res = await syncEngine.syncWeeklySchedule();
      return NextResponse.json(res);
    }

    // Real-world weekly broadcast slots, computed from Jikan-sourced
    // `broadcastDay`/`broadcastTime` already on each Anime record — see
    // ScheduleEngine.syncFromBroadcastMetadata for why this is separate
    // from SYNC_AIRING (which needs AniList-specific per-episode data most
    // of this Jikan-sourced catalog doesn't have).
    if (action === 'SYNC_BROADCAST_SCHEDULE') {
      const res = await ScheduleEngine.syncFromBroadcastMetadata();
      return NextResponse.json({ success: true, ...res });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    console.error('Admin sync error:', error);
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
