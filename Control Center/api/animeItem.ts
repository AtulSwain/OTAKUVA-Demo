import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireControl } from '@control/lib/access';
import { editAnime } from '@control/lib/editor';
import { refreshSite } from '@control/lib/publish';
import { controlError, NO_STORE } from '@control/lib/http';

/** GET /api/control/anime/:id — the editable fields, overrides and recent edit history. ADMIN+. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireControl(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const anime = await prisma.anime.findFirst({
      where: { OR: [{ id: params.id }, { slug: params.id }] },
      select: {
        id: true,
        slug: true,
        canonicalTitle: true,
        synopsis: true,
        posterUrl: true,
        bannerUrl: true,
        trailerUrl: true,
        type: true,
        year: true,
        status: true,
        episodes: true,
        anilistId: true,
        malId: true,
        externalSource: true,
      },
    });
    if (!anime) return NextResponse.json({ error: 'Anime not found.' }, { status: 404, headers: NO_STORE });
    const [overrides, history] = await Promise.all([
      prisma.editorialOverride.findMany({ where: { entityType: 'ANIME', entityId: anime.id }, select: { field: true, createdAt: true } }),
      prisma.animeMetadataHistory.findMany({
        where: { animeId: anime.id },
        orderBy: { changedAt: 'desc' },
        take: 12,
        select: { field: true, oldValue: true, newValue: true, source: true, changedAt: true },
      }),
    ]);
    return NextResponse.json({ anime, overrides, history }, { headers: NO_STORE });
  } catch (e) {
    return controlError(e, '/api/control/anime/[id]');
  }
}

/** PATCH /api/control/anime/:id { canonicalTitle?, synopsis?, posterUrl?, bannerUrl?, trailerUrl? } — ADMIN+. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireControl(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await request.json().catch(() => ({}));
    const result = await editAnime(params.id, body ?? {}, auth.id);
    refreshSite([params.id]);
    return NextResponse.json(result, { headers: NO_STORE });
  } catch (e) {
    return controlError(e, '/api/control/anime/[id] PATCH');
  }
}
