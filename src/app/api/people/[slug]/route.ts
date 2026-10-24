import { NextRequest, NextResponse } from 'next/server';
import { getCreatorProfile } from '../../../../lib/people/creatorProfile';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const profile = await getCreatorProfile(params.slug);
    if (!profile) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    return NextResponse.json({
      person: {
        ...profile,
        // Fields the previous response shape had, kept for existing callers.
        biography: profile.about,
        artistWiki: null,
        staffCredits: profile.credits.map((c) => ({
          animeId: c.anime.id,
          slug: c.anime.slug,
          title: c.anime.title,
          posterImage: c.anime.posterUrl,
          score: c.anime.score,
          year: c.anime.year,
          role: c.roles.join(', '),
        })),
      },
    });
  } catch (error: any) {
    console.error('Error fetching person details:', error);
    return NextResponse.json({ error: 'Failed to fetch person' }, { status: 500 });
  }
}
