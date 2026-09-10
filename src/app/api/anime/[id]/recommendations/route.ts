import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../../../lib/auth';
import { getPersonalizedRecommendations } from '../../../../../lib/engine/recommendation/recommendationEngine';

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

    const userId = authUser?.id || 'guest_user';
    const result = await getPersonalizedRecommendations(
      userId,
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
    return NextResponse.json({ error: error.message || 'Failed to fetch recommendations' }, { status: 500 });
  }
}
