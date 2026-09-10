import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { fetchDanbooruArtistAbout } from '../../../../lib/providers/danbooruProvider';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params;
    const normalizedName = decodeURIComponent(slug).replace(/-/g, ' ').trim();

    const person = await prisma.person.findFirst({
      where: {
        OR: [
          { slug },
          { id: slug },
          { name: slug },
          { name: { contains: normalizedName } },
        ],
      },
      include: {
        staffRoles: {
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
            character: true,
          },
        },
      },
    });

    if (!person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    const staffCredits = person.staffRoles.map((sr) => ({
      animeId: sr.anime.id,
      slug: sr.anime.slug,
      title: sr.anime.canonicalTitle,
      posterImage: sr.anime.posterUrl,
      score: sr.anime.score,
      year: sr.anime.year || sr.anime.startYear,
      role: sr.role,
    }));

    const voiceRoles = person.voiceRoles.map((vr) => ({
      characterId: vr.character.id,
      characterName: vr.character.name,
      characterImage: vr.character.imageUrl,
      characterSlug: vr.character.slug,
      language: vr.language,
    }));

    // Enrich biography with Danbooru Artist wiki if biography is missing
    let biography = person.about;
    let artistWiki = null;
    try {
      const booruInfo = await fetchDanbooruArtistAbout(person.name);
      if (booruInfo) {
        artistWiki = booruInfo;
        if (!biography && booruInfo.wikiBody) {
          biography = booruInfo.wikiBody;
        }
      }
    } catch (e) {
      // Non-blocking enrichment
    }

    return NextResponse.json({
      person: {
        id: person.id,
        name: person.name,
        nameKanji: person.nameKanji,
        slug: person.slug,
        biography,
        artistWiki,
        imageUrl: person.imageUrl,
        website: person.website,
        birthday: person.birthday,
        staffCredits,
        voiceRoles,
      },
    });
  } catch (error: any) {
    console.error('Error fetching person details:', error);
    return NextResponse.json({ error: 'Failed to fetch person' }, { status: 500 });
  }
}
