import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { searchPersonIdsByName } from '../../../lib/fuzzySearch';

export const dynamic = 'force-dynamic';

// Same rationale as MAX_TITLE_MATCHES in src/lib/search.ts — bounds the
// fuzzy-match id list before pagination applies, generous enough that a
// real search's actual result count is never the limiting factor.
const MAX_NAME_MATCHES = 1000;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || searchParams.get('search') || '';
    const role = searchParams.get('role') || 'ALL';
    const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const skip = (page - 1) * limit;

    const where: any = {};

    // Fuzzy/typo-tolerant name matching (Postgres full-text + pg_trgm —
    // see src/lib/fuzzySearch.ts), replacing a plain `contains` with no
    // `mode: 'insensitive'` that was both case-sensitive and had zero
    // typo tolerance. nameKanji stays a plain (now case-insensitive)
    // substring match — it's a secondary field without its own trigram
    // index.
    if (search.trim()) {
      const q = search.trim();
      const nameMatches = await searchPersonIdsByName(q, MAX_NAME_MATCHES);
      where.OR = [
        { id: { in: nameMatches.map((m) => m.id) } },
        { nameKanji: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Role filters match AniList/MAL role wording ("Director", "Chief
    // Director", "Key Animation (eps 3)", …), case-insensitively.
    const staffRole = (...terms: { startsWith?: string; contains?: string }[]) => ({
      some: { OR: terms.map((t) => ({ role: { ...t, mode: 'insensitive' as const } })) },
    });
    if (role !== 'ALL') {
      if (role === 'VOICE_ACTOR') {
        where.voiceRoles = { some: {} };
      } else if (role === 'DIRECTOR') {
        where.staffRoles = staffRole({ startsWith: 'Director' }, { contains: 'Chief Director' }, { contains: 'Series Director' });
      } else if (role === 'ORIGINAL_CREATOR') {
        where.staffRoles = staffRole({ contains: 'Original Creator' }, { contains: 'Original Story' });
      } else if (role === 'WRITER') {
        where.staffRoles = staffRole({ contains: 'Series Composition' }, { startsWith: 'Script' });
      } else if (role === 'MUSIC') {
        where.staffRoles = staffRole({ startsWith: 'Music' }, { contains: 'Theme Song Composition' });
      } else if (role === 'CHARACTER_DESIGN') {
        where.staffRoles = staffRole({ contains: 'Character Design' });
      } else if (role === 'ANIMATION') {
        where.staffRoles = staffRole({ contains: 'Animation Director' }, { startsWith: 'Key Animation' });
      }
    }

    // ?sort=popular: most credited first (voice roles for the voice-actor
    // filter). Default stays alphabetical for existing callers.
    const sort = searchParams.get('sort');
    const orderBy: any =
      sort === 'popular'
        ? role === 'VOICE_ACTOR'
          ? [{ voiceRoles: { _count: 'desc' } }, { name: 'asc' }]
          : [{ staffRoles: { _count: 'desc' } }, { voiceRoles: { _count: 'desc' } }, { name: 'asc' }]
        : { name: 'asc' };

    const [people, totalCount] = await Promise.all([
      prisma.person.findMany({
        where,
        take: limit,
        skip,
        orderBy,
        include: {
          _count: { select: { staffRoles: true, voiceRoles: true } },
          staffRoles: {
            take: 3,
            orderBy: { anime: { members: { sort: 'desc', nulls: 'last' } } },
            include: {
              anime: {
                select: { id: true, canonicalTitle: true, slug: true, posterUrl: true, score: true },
              },
            },
          },
          voiceRoles: {
            take: 3,
            include: {
              character: {
                select: { id: true, name: true, slug: true, imageUrl: true },
              },
            },
          },
        },
      }),
      prisma.person.count({ where }),
    ]);

    const formatted = people.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug || p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      nativeName: p.nameKanji,
      imageUrl: p.imageUrl,
      about: p.about,
      occupations: p.occupations,
      creditCount: p._count.staffRoles,
      voiceRoleCount: p._count.voiceRoles,
      topStaffRoles: p.staffRoles.map((sr) => ({
        role: sr.role,
        anime: sr.anime,
      })),
      topVoiceRoles: p.voiceRoles.map((vr) => ({
        role: vr.language,
        character: vr.character,
      })),
    }));

    return NextResponse.json({
      people: formatted,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      hasMore: skip + limit < totalCount,
    });
  } catch (error: any) {
    console.error('Error fetching people directory:', error);
    return NextResponse.json({ error: 'Failed to retrieve people' }, { status: 500 });
  }
}
