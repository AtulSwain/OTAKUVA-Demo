import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('q') || searchParams.get('search') || '';
    const role = searchParams.get('role') || 'ALL';
    const limit = Math.min(parseInt(searchParams.get('limit') || '30', 10), 100);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q } },
        { nameKanji: { contains: q } },
      ];
    }

    if (role !== 'ALL') {
      if (role === 'VOICE_ACTOR') {
        where.voiceRoles = { some: {} };
      } else if (role === 'DIRECTOR') {
        where.staffRoles = { some: { role: { contains: 'Director' } } };
      } else if (role === 'WRITER') {
        where.staffRoles = { some: { role: { contains: 'Series Composition' } } };
      } else if (role === 'MUSIC') {
        where.staffRoles = { some: { role: { contains: 'Music' } } };
      }
    }

    const [people, totalCount] = await Promise.all([
      prisma.person.findMany({
        where,
        take: limit,
        skip,
        orderBy: { name: 'asc' },
        include: {
          staffRoles: {
            take: 3,
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
