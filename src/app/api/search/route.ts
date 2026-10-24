import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { sanitizePublicEntityName } from '../../../lib/normalizers';
import { searchAnimeIdsByTitle, searchPersonIdsByName } from '../../../lib/fuzzySearch';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const rawQuery = searchParams.get('q')?.trim() || '';

    if (!rawQuery) {
      // Default top suggestions
      const [topAnime, topStudios, recentNews, topFranchises] = await Promise.all([
        prisma.anime.findMany({
          where: { status: { not: 'MERGED' } },
          orderBy: { score: { sort: 'desc', nulls: 'last' } },
          take: 5,
          select: {
            id: true,
            slug: true,
            canonicalTitle: true,
            posterUrl: true,
            bannerUrl: true,
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
        prisma.franchise.findMany({
          take: 3,
          select: { id: true, slug: true, name: true },
        }),
      ]);

      return NextResponse.json({
        anime: topAnime.map((a) => ({
          id: a.id,
          slug: a.slug,
          title: sanitizePublicEntityName(a.canonicalTitle),
          posterUrl: a.posterUrl,
          bannerUrl: a.bannerUrl ?? null,
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
        franchises: topFranchises.map((f) => ({
          id: f.id,
          slug: f.slug,
          name: sanitizePublicEntityName(f.name),
        })),
      });
    }

    const cleanQuery = sanitizePublicEntityName(rawQuery) || rawQuery;

    // Anime/person matching is now fuzzy/typo-tolerant (Postgres full-text
    // + pg_trgm — see src/lib/fuzzySearch.ts), replacing a plain `contains`
    // that missed anything misspelled. These need to resolve before the
    // anime/person findMany calls below (which just fetch the already-
    // ranked ids), so they run ahead of the rest of the Promise.all.
    const [animeMatches, personMatches] = await Promise.all([
      searchAnimeIdsByTitle(cleanQuery, 6),
      searchPersonIdsByName(cleanQuery, 4),
    ]);

    // Search across 5 distinct canonical entity domains concurrently
    const [animeResults, studioResults, peopleResults, newsResults, communityResults, franchiseResults] = await Promise.all([
      prisma.anime.findMany({
        where: { id: { in: animeMatches.map((m) => m.id) } },
        orderBy: { score: { sort: 'desc', nulls: 'last' } },
        select: {
          id: true,
          slug: true,
          canonicalTitle: true,
          posterUrl: true,
          bannerUrl: true,
          year: true,
          type: true,
          score: true,
        },
      }),

      prisma.studio.findMany({
        where: {
          OR: [
            { name: { contains: cleanQuery, mode: 'insensitive' } },
            { slug: { contains: cleanQuery.toLowerCase(), mode: 'insensitive' } },
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
        where: { id: { in: personMatches.map((m) => m.id) } },
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
            { title: { contains: cleanQuery, mode: 'insensitive' } },
            { slug: { contains: cleanQuery.toLowerCase(), mode: 'insensitive' } },
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
            { name: { contains: cleanQuery, mode: 'insensitive' } },
            { slug: { contains: cleanQuery.toLowerCase(), mode: 'insensitive' } },
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

      prisma.franchise.findMany({
        where: {
          OR: [
            { name: { contains: cleanQuery, mode: 'insensitive' } },
            { slug: { contains: cleanQuery.toLowerCase(), mode: 'insensitive' } },
          ],
        },
        take: 4,
        select: { id: true, slug: true, name: true },
      }),
    ]);

    // Prisma's `id: { in: [...] }` doesn't preserve the ids' input order,
    // so re-sort people by fuzzy-match rank (best match first) — anime
    // deliberately keeps its own `orderBy: score desc` above instead,
    // matching this endpoint's prior behavior of ranking anime results by
    // popularity/score rather than match strength.
    const personRankById = new Map(personMatches.map((m) => [m.id, m.rank]));
    const rankedPeopleResults = [...peopleResults].sort(
      (a, b) => (personRankById.get(b.id) ?? 0) - (personRankById.get(a.id) ?? 0)
    );

    return NextResponse.json({
      anime: animeResults.map((a) => ({
        id: a.id,
        slug: a.slug,
        title: sanitizePublicEntityName(a.canonicalTitle),
        posterUrl: a.posterUrl,
        bannerUrl: a.bannerUrl ?? null,
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
      people: rankedPeopleResults.map((p) => ({
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
      franchises: franchiseResults.map((f) => ({
        id: f.id,
        slug: f.slug,
        name: sanitizePublicEntityName(f.name),
      })),
    });
  } catch (error: any) {
    console.error('Error in multi-entity search API:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
