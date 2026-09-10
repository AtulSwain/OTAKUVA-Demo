import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { requireRole } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'DATA_EDITOR');
  if (auth instanceof NextResponse) return auth;

  try {
    const [
      totalAnime,
      totalEpisodes,
      totalCharacters,
      totalStaff,
      totalStudios,
      totalGenres,
      totalThemes,
      animeWithoutSynopsis,
      animeWithoutStudio,
      animeWithoutEpisodes,
      recentSyncJobs,
    ] = await Promise.all([
      prisma.anime.count(),
      prisma.episode.count(),
      prisma.character.count(),
      prisma.person.count(),
      prisma.studio.count(),
      prisma.genre.count(),
      prisma.theme.count(),
      prisma.anime.count({ where: { synopsis: { equals: 'No synopsis available.' } } }),
      prisma.anime.count({ where: { animeStudios: { none: {} } } }),
      prisma.anime.count({ where: { episodesList: { none: {} } } }),
      prisma.syncJob.findMany({
        take: 15,
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    // Calculate completeness score
    const completeAnime = totalAnime - Math.max(animeWithoutStudio, animeWithoutEpisodes);
    const completenessRate = totalAnime > 0 ? ((completeAnime / totalAnime) * 100).toFixed(1) : '100.0';

    return NextResponse.json({
      catalog: {
        totalAnime,
        totalEpisodes,
        totalCharacters,
        totalStaff,
        totalStudios,
        totalGenres,
        totalThemes,
      },
      dataQuality: {
        completenessScore: `${completenessRate}%`,
        completeAnimeCount: Math.max(0, completeAnime),
        missingSynopses: animeWithoutSynopsis,
        missingStudios: animeWithoutStudio,
        missingEpisodes: animeWithoutEpisodes,
      },
      synchronization: {
        recentJobs: recentSyncJobs.map((j) => ({
          id: j.id,
          source: j.provider,
          entityType: j.jobType,
          status: j.status,
          startedAt: j.startedAt.toISOString(),
          completedAt: j.completedAt ? j.completedAt.toISOString() : null,
          processed: j.processedCount,
          created: j.createdCount,
          updated: j.updatedCount,
          failed: j.failedCount,
          error: j.error,
        })),
      },
    });
  } catch (error: any) {
    console.error('Data Center API error:', error);
    return NextResponse.json({ error: 'Failed to fetch data center metrics' }, { status: 500 });
  }
}
