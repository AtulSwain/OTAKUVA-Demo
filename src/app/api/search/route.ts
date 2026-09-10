import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { sanitizePublicEntityName } from '../../../lib/normalizers';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('q')?.trim() || '';

    if (!rawQuery) {
      // Default top suggestions
      const [topAnime, topStudios, recentNews] = await Promise.all([
        prisma.anime.findMany({
          where: { status: { not: 'MERGED' } },
          orderBy: { score: 'desc' },
          take: 5,
          select: {
            id: true,
            slug: true,
            canonicalTitle: true,
            posterUrl: true,
            year: true,
            type: true,
            score: true,
          },
        }),
        prisma.studio.findMany({
          take: 4,
          select: { id: true, slug: true, name: true, imageUrl: true },
        }),
        prisma.newsArticle.findMany({
          take: 3,
          orderBy: { publishedAt: 'desc' },
          select: { id: true, slug: true, title: true, imageUrl: true, category: true },
        }),
      ]);

      return NextResponse.json({
        anime: topAnime.map((a) => ({
          id: a.id,
          slug: a.slug,
          title: sanitizePublicEntityName(a.canonicalTitle),
          posterUrl: a.posterUrl,
          year: a.year,
          type: a.type,
          score: a.score,
        })),
        studios: topStudios.map((s) => ({
          id: s.id,
          slug: s.slug,
          name: sanitizePublicEntityName(s.name),
          logoUrl: s.imageUrl,
        })),
        people: [],
        news: recentNews.map((n) => ({
          id: n.id,
          slug: n.slug,
          title: sanitizePublicEntityName(n.title),
          imageUrl: n.imageUrl,
          category: n.category,
        })),
        communities: [],
      });
    }

    const cleanQuery = sanitizePublicEntityName(rawQuery) || rawQuery;

    // Search across 5 distinct canonical entity domains concurrently
    const [animeResults, studioResults, peopleResults, newsResults, communityResults] = await Promise.all([
      prisma.anime.findMany({
        where: {
          status: { not: 'MERGED' },
          OR: [
            { canonicalTitle: { contains: cleanQuery } },
            { slug: { contains: cleanQuery.toLowerCase() } },
            { titles: { some: { title: { contains: cleanQuery } } } },
          ],
        },
        take: 6,
        orderBy: { score: 'desc' },
        select: {
          id: true,
          slug: true,
          canonicalTitle: true,
          posterUrl: true,
          year: true,
          type: true,
          score: true,
        },
      }),

      prisma.studio.findMany({
        where: {
          OR: [
            { name: { contains: cleanQuery } },
            { slug: { contains: cleanQuery.toLowerCase() } },
          ],
        },
        take: 4,
        select: {
          id: true,
          slug: true,
          name: true,
          imageUrl: true,
        },
      }),

      prisma.person.findMany({
        where: {
          OR: [
            { name: { contains: cleanQuery } },
            { slug: { contains: cleanQuery.toLowerCase() } },
          ],
        },
        take: 4,
        select: {
          id: true,
          slug: true,
          name: true,
          imageUrl: true,
          nameKanji: true,
        },
      }),

      prisma.newsArticle.findMany({
        where: {
          OR: [
            { title: { contains: cleanQuery } },
            { slug: { contains: cleanQuery.toLowerCase() } },
          ],
        },
        take: 4,
        select: {
          id: true,
          slug: true,
          title: true,
          imageUrl: true,
          category: true,
          publishedAt: true,
        },
      }),

      prisma.community.findMany({
        where: {
          status: 'ACTIVE',
          visibility: 'PUBLIC',
          OR: [
            { name: { contains: cleanQuery } },
            { slug: { contains: cleanQuery.toLowerCase() } },
          ],
        },
        take: 4,
        select: {
          id: true,
          slug: true,
          name: true,
          iconUrl: true,
          memberCount: true,
          category: true,
        },
      }),
    ]);

    return NextResponse.json({
      anime: animeResults.map((a) => ({
        id: a.id,
        slug: a.slug,
        title: sanitizePublicEntityName(a.canonicalTitle),
        posterUrl: a.posterUrl,
        year: a.year,
        type: a.type,
        score: a.score,
      })),
      studios: studioResults.map((s) => ({
        id: s.id,
        slug: s.slug,
        name: sanitizePublicEntityName(s.name),
        logoUrl: s.imageUrl,
      })),
      people: peopleResults.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: sanitizePublicEntityName(p.name),
        imageUrl: p.imageUrl,
        primaryRole: p.nameKanji || 'Staff & Cast',
      })),
      news: newsResults.map((n) => ({
        id: n.id,
        slug: n.slug,
        title: sanitizePublicEntityName(n.title),
        imageUrl: n.imageUrl,
        category: n.category,
        publishedAt: n.publishedAt,
      })),
      communities: communityResults.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: sanitizePublicEntityName(c.name),
        iconUrl: c.iconUrl,
        memberCount: c.memberCount,
        category: c.category,
      })),
    });
  } catch (error: any) {
    console.error('Error in multi-entity search API:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
