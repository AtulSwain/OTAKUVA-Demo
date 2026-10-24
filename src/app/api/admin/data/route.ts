import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireRole } from '../../../../lib/auth';
import { providerMetrics } from '../../../../lib/jikanService';
import { getLatestSyncJob } from '../../../../lib/queue/syncJob';
import { syncJobToImportJobState } from '../../../../lib/queue/importJobState';
import { JOB_TYPES } from '../../../../lib/queue/jobTypes';
import { ImageHealthService } from '../../../../lib/engine/media/imageHealthService';
import { getProviderHealthSnapshot } from '../../../../lib/providers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'DATA_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const [
      animeCount,
      studioCount,
      creatorCount,
      characterCount,
      episodeCount,
      newsCount,
    ] = await Promise.all([
      prisma.anime.count({ where: { status: { not: 'MERGED' } } }),
      prisma.studio.count({ where: { status: { not: 'MERGED' } } }),
      prisma.person.count(),
      prisma.character.count(),
      prisma.episode.count(),
      prisma.newsArticle.count({ where: { deletedAt: null } }),
    ]);

    // Import work now runs in the queue worker (scripts/worker.ts), not
    // in-process — this reads the same SyncJob row GET
    // /api/admin/anime/import reconstructs its status from.
    const latestImportJob = await getLatestSyncJob(JOB_TYPES.JIKAN_IMPORT);
    const importJobState = syncJobToImportJobState(latestImportJob);
    const imageHealth = ImageHealthService.getHealthSummary();

    return NextResponse.json({
      success: true,
      data: {
        catalog: {
          anime: animeCount,
          studios: studioCount,
          creators: creatorCount,
          characters: characterCount,
          episodes: episodeCount,
          news: newsCount,
        },
        provider: {
          name: 'jikan_v4',
          metrics: providerMetrics,
        },
        // Per-adapter health + recent failover events for the
        // getFailoverProvider() chain (src/lib/providers/index.ts) — every
        // anime/episode/character/staff fetch that goes through
        // syncEngine.ts now runs through this, so a degraded/down adapter
        // and every automatic failover shows up here.
        providerFailover: getProviderHealthSnapshot(),
        importJob: importJobState,
        imageHealth,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
