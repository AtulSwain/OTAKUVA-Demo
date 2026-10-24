import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../lib/auth';
import { addAnimeToList, createList, getMyLists, ListError } from '../../../lib/lists/listService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const requestedLimit = parseInt(searchParams.get('limit') || '20', 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(50, Math.max(1, requestedLimit)) : 20;

    // Only the owner sees their own PRIVATE / FOLLOWERS_ONLY lists; anyone
    // else asking for a user's lists gets the public ones.
    const authUser = await getAuthUserFromRequest(request);

    // ?mine=1 — the signed-in user's own lists (Library > My lists, and the
    // "add to list" picker, which passes containsAnimeId to show ticks).
    if (searchParams.get('mine') === '1') {
      if (!authUser) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      const containsAnimeId = searchParams.get('containsAnimeId') || undefined;
      const lists = await getMyLists(authUser.id, containsAnimeId);
      return NextResponse.json({ lists, total: lists.length });
    }

    const where: any = {};
    if (userId) {
      where.userId = userId;
      if (authUser?.id !== userId) where.visibility = 'PUBLIC';
    } else {
      where.visibility = 'PUBLIC';
    }

    const lists = await prisma.userList.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
        items: {
          take: 4,
          orderBy: { position: 'asc' },
          include: {
            anime: {
              select: {
                id: true,
                slug: true,
                canonicalTitle: true,
                posterUrl: true,
              },
            },
          },
        },
        _count: {
          select: { items: true },
        },
      },
    });

    const parsed = lists.map((l) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      visibility: l.visibility,
      totalItems: l._count.items,
      createdAt: l.createdAt.toISOString(),
      updatedAt: l.updatedAt.toISOString(),
      user: l.user,
      previewPosters: l.items.map((i) => i.anime.posterUrl),
      items: l.items.map((i) => ({
        animeId: i.animeId,
        slug: i.anime.slug,
        title: i.anime.canonicalTitle,
        posterImage: i.anime.posterUrl,
        notes: i.notes,
        position: i.position,
      })),
    }));

    return NextResponse.json({ lists: parsed, total: parsed.length });
  } catch (error: any) {
    console.error('Error fetching lists:', error);
    return NextResponse.json({ error: 'Failed to fetch custom lists' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUserFromRequest(request);
    if (!authUser) {
      return NextResponse.json({ error: 'Authentication required to create a list' }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const { name, description, visibility, animeId, initialAnimeIds, animeIds, bannerAssetId, bannerAnimeId } = body ?? {};
    if (Array.isArray(initialAnimeIds) && initialAnimeIds.length > 100) {
      return NextResponse.json({ error: 'A new list can start with at most 100 anime' }, { status: 400 });
    }

    // New lists are PRIVATE unless the creator chooses otherwise (they used
    // to default to PUBLIC); always owned by the session user.
    // animeIds / banner*: the collection builder (/collections/new).
    const newList = await createList(authUser.id, { name, description, visibility, animeId, animeIds, bannerAssetId, bannerAnimeId });
    if (Array.isArray(initialAnimeIds)) {
      for (const id of initialAnimeIds) {
        await addAnimeToList(authUser.id, newList.id, id).catch(() => {});
      }
    }

    // userId kept in the response for contract compatibility.
    return NextResponse.json({ list: { ...newList, userId: authUser.id } });
  } catch (error: any) {
    if (error instanceof ListError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    console.error('Error creating custom list:', error);
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
  }
}
