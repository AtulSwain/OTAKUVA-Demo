import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
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

    // Every anime page recommends from THIS anime's genres (2026-10-25,
    // owner): a horror title recommends horror, an action title action — so
    // pages no longer share one list. Signed-in members get the same
    // per-anime list with a small nudge toward genres they like (the engine's
    // taste bonus). Guests: same, without the nudge. (Signed-in members used
    // to get the general taste engine here, which was nearly the same list
    // on every page.)
    const similar = await similarAnimeEngine.getSimilarAnime(targetAnime.id, { userId: authUser?.id ?? null, limit: 8 });
    return NextResponse.json({
      targetAnimeId: targetAnime.id,
      targetTitle: targetAnime.canonicalTitle,
      personalizationLevel: similar?.isPersonalized ? 'LIGHT' : 'NONE',
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
  } catch (error: any) {
    console.error('Error fetching contextual recommendations:', error);
    return NextResponse.json({ error: 'Failed to fetch recommendations' }, { status: 500 });
  }
}
