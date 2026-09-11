import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { getPersonalizedRecommendations } from '../../../../../lib/engine/recommendation/recommendationEngine';
import { similarAnimeEngine } from '../../../../../lib/engine/discovery/similarAnimeEngine';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const authUser = await getAuthUserFromRequest(request);

    // Resolve anime by ID or slug
    const targetAnime = await prisma.anime.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, canonicalTitle: true },
    });

    if (!targetAnime) {
      return NextResponse.json({ error: 'Target anime not found' }, { status: 404 });
    }

    // A signed-out visitor has no taste profile. This used to pass the id
    // "guest_user" to the taste engine, which tried to upsert a profile for a
    // user that doesn't exist and failed the foreign key — so every guest got
    // a 500. Guests get content-based similarity to this title instead.
    if (!authUser) {
      const similar = await similarAnimeEngine.getSimilarAnime(targetAnime.id, { userId: null, limit: 8 });
      return NextResponse.json({
        targetAnimeId: targetAnime.id,
        targetTitle: targetAnime.canonicalTitle,
        personalizationLevel: 'NONE',
        context: 'ANIME_PAGE',
        items: (similar?.similarAnime || []).map((s) => ({
          id: s.id,
          canonicalTitle: s.canonicalTitle,
          slug: s.slug,
          posterUrl: s.posterUrl,
          bannerUrl: s.bannerUrl,
          score: s.score,
          type: s.type,
          year: s.year,
          explanation: s.explanation,
          matchReasons: s.matchReasons,
          genres: s.genres,
          themes: s.themes,
          studios: s.studios,
        })),
      });
    }

    const result = await getPersonalizedRecommendations(
      authUser.id,
      8,
      'ANIME_PAGE',
      targetAnime.id
    );

    return NextResponse.json({
      targetAnimeId: targetAnime.id,
      targetTitle: targetAnime.canonicalTitle,
      ...result,
    });
  } catch (error: any) {
    console.error('Error fetching contextual recommendations:', error);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}
