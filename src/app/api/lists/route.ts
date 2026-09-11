import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { getAuthUserFromRequest } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '20', 10));

    // Only the owner sees their own PRIVATE / FOLLOWERS_ONLY lists; anyone
    // else asking for a user's lists gets the public ones.
    const authUser = await getAuthUserFromRequest(request);
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
    const userId = authUser.id;
    const body = await request.json();
    const { name, description, visibility, initialAnimeIds } = body;

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'List name is required' }, { status: 400 });
    }
    if (name.trim().length > 100 || (typeof description === 'string' && description.length > 1000)) {
      return NextResponse.json({ error: 'List name or description is too long' }, { status: 400 });
    }
    if (Array.isArray(initialAnimeIds) && initialAnimeIds.length > 100) {
      return NextResponse.json({ error: 'A new list can start with at most 100 anime' }, { status: 400 });
    }

    const validVis = ['PUBLIC', 'PRIVATE', 'FOLLOWERS_ONLY'].includes(visibility) ? visibility : 'PUBLIC';

    const newList = await prisma.$transaction(async (tx) => {
      const list = await tx.userList.create({
        data: {
          userId,
          name: name.trim(),
          description: description?.trim() || null,
          visibility: validVis,
        },
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
        },
      });

      if (Array.isArray(initialAnimeIds) && initialAnimeIds.length > 0) {
        for (let i = 0; i < initialAnimeIds.length; i++) {
          const aId = initialAnimeIds[i];
          const anime = await tx.anime.findFirst({
            where: { OR: [{ id: aId }, { slug: aId }] },
          });
          if (anime) {
            await tx.userListItem.create({
              data: {
                listId: list.id,
                animeId: anime.id,
                position: i + 1,
              },
            });
          }
        }
      }

      await tx.activity.create({
        data: {
          userId,
          type: 'LIST_CREATED',
          metadata: JSON.stringify({ listId: list.id, listName: list.name }),
        },
      });

      return list;
    });

    return NextResponse.json({ list: newList });
  } catch (error: any) {
    console.error('Error creating custom list:', error);
    return NextResponse.json({ error: 'Failed to create list' }, { status: 500 });
  }
}
