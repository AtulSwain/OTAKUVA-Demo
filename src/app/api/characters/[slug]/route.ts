import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;

    const character = await prisma.character.findFirst({
      where: {
        OR: [{ slug }, { id: slug }, { name: slug }],
      },
      include: {
        animeRoles: {
          include: {
            anime: {
              include: {
                titles: true,
                animeGenres: { include: { genre: true } },
              },
            },
          },
        },
        voiceRoles: {
          include: {
            person: true,
          },
        },
      },
    });

    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 });
    }

    const animeAppearances = character.animeRoles.map((ac) => ({
      animeId: ac.anime.id,
      slug: ac.anime.slug,
      title: ac.anime.canonicalTitle,
      posterImage: ac.anime.posterUrl,
      score: ac.anime.score,
      year: ac.anime.year || ac.anime.startYear,
      role: ac.role,
    }));

    const voiceActors = character.voiceRoles.map((vr) => ({
      personId: vr.person.id,
      personName: vr.person.name,
      personKanji: vr.person.nameKanji,
      personImage: vr.person.imageUrl,
      personSlug: vr.person.slug,
      language: vr.language,
    }));

    return NextResponse.json({
      character: {
        id: character.id,
        name: character.name,
        nameKanji: character.nameKanji,
        slug: character.slug,
        about: character.about,
        imageUrl: character.imageUrl,
        animeAppearances,
        voiceActors,
      },
    });
  } catch (error: any) {
    console.error('Error fetching character details:', error);
    return NextResponse.json({ error: 'Failed to fetch character' }, { status: 500 });
  }
}
