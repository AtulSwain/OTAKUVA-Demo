import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireControl } from '@control/lib/access';
import { refreshSite } from '@control/lib/publish';
import { controlError, NO_STORE, pageParams } from '@control/lib/http';
import { anilistProvider } from '@/lib/providers/anilistProvider';
import { syncEngine } from '@/lib/syncEngine';
import { logger } from '@/lib/logger';

const MISSING: Record<string, Prisma.AnimeWhereInput> = {
  poster: { posterUrl: '' },
  banner: { OR: [{ bannerUrl: null }, { bannerUrl: '' }] },
  trailer: { OR: [{ trailerUrl: null }, { trailerUrl: '' }] },
  synopsis: { synopsis: '' },
};

/** GET /api/control/anime?q=&missing=poster|banner|trailer|synopsis&page= — most-watched first. ADMIN+. */
export async function GET(request: NextRequest) {
  const auth = await requireControl(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const sp = request.nextUrl.searchParams;
    const { page, limit, skip } = pageParams(sp);
    const q = (sp.get('q') || '').trim().slice(0, 100);
    const where: Prisma.AnimeWhereInput = {
      status: { not: 'MERGED' },
      ...(MISSING[sp.get('missing') || ''] || {}),
      ...(q
        ? {
            OR: [
              { canonicalTitle: { contains: q, mode: 'insensitive' } },
              { slug: { contains: q.toLowerCase().replace(/\s+/g, '-') } },
              { titles: { some: { title: { contains: q, mode: 'insensitive' } } } },
              ...(/^\d+$/.test(q) ? [{ anilistId: Number(q) }, { malId: Number(q) }] : []),
            ],
          }
        : {}),
    };
    const [total, anime] = await Promise.all([
      prisma.anime.count({ where }),
      prisma.anime.findMany({
        where,
        orderBy: [{ members: { sort: 'desc', nulls: 'last' } }, { canonicalTitle: 'asc' }],
        skip,
        take: limit,
        select: {
          id: true, slug: true, canonicalTitle: true, type: true, year: true, status: true, isAdult: true,
          posterUrl: true, bannerUrl: true, trailerUrl: true, anilistId: true, malId: true, members: true,
          synopsis: true,
        },
      }),
    ]);
    const overridden = await prisma.editorialOverride.findMany({
      where: { entityType: 'ANIME', entityId: { in: anime.map((a) => a.id) } },
      select: { entityId: true, field: true },
    });
    const ov = new Map<string, string[]>();
    for (const o of overridden) ov.set(o.entityId, [...(ov.get(o.entityId) || []), o.field]);
    return NextResponse.json(
      {
        total,
        page,
        anime: anime.map(({ synopsis, ...a }) => ({ ...a, hasSynopsis: Boolean(synopsis), overrides: ov.get(a.id) || [] })),
      },
      { headers: NO_STORE },
    );
  } catch (e) {
    return controlError(e, '/api/control/anime');
  }
}

/**
 * POST /api/control/anime { anilistId } | { malId } — add (or refresh) one
 * anime from the provider, with cast/staff/relations best-effort. Adult
 * titles are refused (catalog policy). Never touches user data. ADMIN+.
 */
export async function POST(request: NextRequest) {
  const auth = await requireControl(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json().catch(() => ({}));
    const anilistId = Number.parseInt(String(body?.anilistId ?? ''), 10);
    const malId = Number.parseInt(String(body?.malId ?? ''), 10);
    if (!(anilistId > 0) && !(malId > 0)) {
      return NextResponse.json({ error: 'Enter an AniList or MyAnimeList ID.' }, { status: 400, headers: NO_STORE });
    }

    if (anilistId > 0) {
      const existing = await prisma.anime.findFirst({ where: { anilistId }, select: { id: true, slug: true } });
      const provider = await anilistProvider.getAnime(String(anilistId));
      if (!provider) return NextResponse.json({ error: 'AniList has no anime with that ID.' }, { status: 404, headers: NO_STORE });
      if (provider.isAdult) return NextResponse.json({ error: 'Adult titles are not added to the catalog.' }, { status: 400, headers: NO_STORE });
      const { animeId, isNew } = await syncEngine.ingestAnime(provider, 'anilist');
      await Promise.allSettled([
        syncEngine.syncCharacters(animeId, String(anilistId), 'anilist'),
        syncEngine.syncStaff(animeId, String(anilistId), 'anilist'),
        syncEngine.syncRelations(animeId, String(anilistId), 'anilist'),
      ]);
      const row = await prisma.anime.findUnique({ where: { id: animeId }, select: { slug: true, canonicalTitle: true } });
      logger.info('Control center added anime', { actorId: auth.id, animeId, anilistId, isNew, existed: Boolean(existing) });
      refreshSite([animeId, row?.slug ?? ''].filter(Boolean));
      return NextResponse.json({ animeId, isNew, slug: row?.slug, title: row?.canonicalTitle }, { headers: NO_STORE });
    }

    const result = await syncEngine.ingestAnimeByMalId(malId);
    if (!result) {
      return NextResponse.json({ error: 'MyAnimeList (Jikan) returned nothing for that ID — it may be down. Try the AniList ID.' }, { status: 502, headers: NO_STORE });
    }
    const row = await prisma.anime.findUnique({ where: { id: result.animeId }, select: { slug: true, canonicalTitle: true } });
    logger.info('Control center added anime', { actorId: auth.id, animeId: result.animeId, malId, isNew: result.isNew });
    refreshSite([result.animeId, row?.slug ?? ''].filter(Boolean));
    return NextResponse.json({ ...result, slug: row?.slug, title: row?.canonicalTitle }, { headers: NO_STORE });
  } catch (e) {
    return controlError(e, '/api/control/anime POST');
  }
}
