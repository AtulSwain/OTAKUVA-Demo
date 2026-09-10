import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    const anime = await prisma.anime.findFirst({
      where: { OR: [{ id }, { slug: id }] },
      select: { id: true, canonicalTitle: true },
    });

    if (!anime) {
      return NextResponse.json({ error: 'Anime not found' }, { status: 404 });
    }

    const opinion = await prisma.animeCommunityOpinion.findUnique({
      where: { animeId: anime.id },
    });

    if (!opinion) {
      return NextResponse.json({
        opinion: {
          animeId: anime.id,
          overallSentiment: 'POSITIVE',
          storyScore: null,
          animationScore: null,
          charactersScore: null,
          musicScore: null,
          directionScore: null,
          pacingScore: null,
          worldBuildingScore: null,
          enjoymentScore: null,
          positivePercentage: 0,
          mixedPercentage: 0,
          negativePercentage: 0,
          frequentlyPraised: [],
          frequentlyCriticized: [],
          analyzedReviewCount: 0,
          confidence: 'NO_DATA',
        },
      });
    }

    return NextResponse.json({
      opinion: {
        ...opinion,
        frequentlyPraised: opinion.frequentlyPraisedJson ? JSON.parse(opinion.frequentlyPraisedJson) : [],
        frequentlyCriticized: opinion.frequentlyCriticizedJson ? JSON.parse(opinion.frequentlyCriticizedJson) : [],
      },
    });
  } catch (error: any) {
    console.error('Error fetching community opinion:', error);
    return NextResponse.json({ error: 'Failed to fetch community opinion' }, { status: 500 });
  }
}
