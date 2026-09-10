import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../lib/auth';
import { providerMetrics } from '../../../../lib/jikanService';
import { JikanImportJobManager } from '../../../../lib/ingestion/jikanImportJob';
import { ImageHealthService } from '../../../../lib/engine/media/imageHealthService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    const importJobState = JikanImportJobManager.getStatus();
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
        importJob: importJobState,
        imageHealth,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Server error' }, { status: 500 });
  }
}
