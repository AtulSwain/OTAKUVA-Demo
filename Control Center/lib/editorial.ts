/**
 * Control center editorial content (2026-10-28): OTAKUVA news stories,
 * articles and official collections, written by the owner. Reuses the
 * site's own services/rules (newsAdminService, article validation, the list
 * service) so these behave exactly like the rest of the site.
 */
import { prisma } from '@/lib/prisma';
import { newsAdminService } from '@/lib/engine/news/newsAdminService';
import { validateArticleInput } from '@/lib/articles/articleService';
import { createList, deleteList, getListForOwner, getMyLists, updateList } from '@/lib/lists/listService';
import { generateSlug } from '@/lib/normalizers';
import { cleanImageUrl } from './access';
import { ControlEditError } from './editor';

// ── News ────────────────────────────────────────────────────────────────
export const NEWS_CATEGORIES = ['ANIME', 'ANNOUNCEMENTS', 'TRAILERS', 'CASTING', 'PRODUCTION', 'STUDIOS', 'INDUSTRY', 'MANGA'];

export interface NewsFormValues {
  title: string;
  subtitle: string;
  summary: string;
  content: string;
  imageUrl: string;
  category: string;
  status: 'DRAFT' | 'PUBLISHED';
  isFeatured: boolean;
  animeIds: string[];
}

const s = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim().slice(0, max) : '');

function validateNews(raw: Partial<Record<keyof NewsFormValues, unknown>>) {
  const title = s(raw.title, 200).replace(/\s+/g, ' ');
  if (title.length < 5) throw new ControlEditError(400, 'Headline must be at least 5 characters.');
  const content = s(raw.content, 30000);
  if (content.length < 40) throw new ControlEditError(400, 'Write the story (at least 40 characters).');
  const image = cleanImageUrl(raw.imageUrl ?? '');
  if (image === undefined) throw new ControlEditError(400, 'Image must be an https:// link or an uploaded file.');
  const category = s(raw.category, 30).toUpperCase() || 'ANIME';
  if (!NEWS_CATEGORIES.includes(category)) throw new ControlEditError(400, 'Choose a category.');
  const status = raw.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
  const animeIds = Array.isArray(raw.animeIds) ? [...new Set(raw.animeIds.filter((x): x is string => typeof x === 'string'))].slice(0, 10) : [];
  return {
    title,
    subtitle: s(raw.subtitle, 240),
    summary: s(raw.summary, 600),
    content,
    imageUrl: image ?? '',
    category,
    status: status as 'DRAFT' | 'PUBLISHED',
    isFeatured: raw.isFeatured === true,
    animeIds,
  };
}

export async function listOwnNews(q = '', page = 1) {
  const where = {
    provider: 'INTERNAL',
    deletedAt: null,
    ...(q ? { title: { contains: q, mode: 'insensitive' as const } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.newsArticle.count({ where }),
    prisma.newsArticle.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * 30,
      take: 30,
      select: { id: true, slug: true, title: true, adminOverrideTitle: true, status: true, imageUrl: true, category: true, isFeatured: true, publishedAt: true },
    }),
  ]);
  return { total, news: rows.map((r) => ({ ...r, title: r.adminOverrideTitle || r.title, publishedAt: r.publishedAt.toISOString() })) };
}

export async function getNewsForm(id: string) {
  const a = await prisma.newsArticle.findUnique({
    where: { id },
    include: { animeRelations: { select: { anime: { select: { id: true, canonicalTitle: true, posterUrl: true } } } } },
  });
  if (!a || a.deletedAt) return null;
  return {
    id: a.id,
    slug: a.slug,
    values: {
      title: a.adminOverrideTitle || a.title,
      subtitle: a.subtitle || '',
      summary: a.adminOverrideSummary || a.summary || '',
      content: a.content || '',
      imageUrl: a.imageUrl || '',
      category: a.adminOverrideCategory || a.category,
      status: a.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT',
      isFeatured: a.isFeatured,
      animeIds: a.animeRelations.map((r) => r.anime.id),
    } as NewsFormValues,
    anime: a.animeRelations.map((r) => ({ id: r.anime.id, title: r.anime.canonicalTitle, posterUrl: r.anime.posterUrl })),
  };
}

export async function saveNews(id: string | null, raw: Partial<Record<keyof NewsFormValues, unknown>>, actorId: string) {
  const v = validateNews(raw);
  if (v.animeIds.length && (await prisma.anime.count({ where: { id: { in: v.animeIds } } })) !== v.animeIds.length) {
    throw new ControlEditError(400, 'One of the linked anime no longer exists.');
  }
  const animeIds = v.animeIds.map((animeId) => ({ animeId, relationType: 'PRIMARY' }));
  if (!id) {
    const created = await newsAdminService.createArticle(
      {
        title: v.title,
        subtitle: v.subtitle || undefined,
        summary: v.summary || undefined,
        content: v.content,
        imageUrl: v.imageUrl || undefined,
        category: v.category,
        status: v.status,
        isFeatured: v.isFeatured,
        contentType: 'OTAKUVA_EDITORIAL',
        sourceName: 'OTAKUVA',
        author: 'OTAKUVA',
        animeIds,
      },
      actorId,
    );
    return { id: created.id, slug: created.slug };
  }
  const existing = await prisma.newsArticle.findUnique({ where: { id }, select: { id: true, slug: true, provider: true } });
  if (!existing) throw new ControlEditError(404, 'Story not found.');
  await newsAdminService.updateArticle(
    id,
    {
      title: v.title,
      subtitle: v.subtitle,
      summary: v.summary,
      content: v.content,
      imageUrl: v.imageUrl,
      category: v.category,
      status: v.status,
      isFeatured: v.isFeatured,
      animeIds,
    },
    actorId,
  );
  // OTAKUVA's own stories keep their real title (not just an override).
  if (existing.provider === 'INTERNAL') {
    await prisma.newsArticle.update({ where: { id }, data: { title: v.title, summary: v.summary || null, category: v.category } });
  }
  return { id, slug: existing.slug };
}

export async function deleteNews(id: string) {
  const n = await prisma.newsArticle.updateMany({ where: { id, provider: 'INTERNAL' }, data: { deletedAt: new Date(), status: 'REMOVED' } });
  if (!n.count) throw new ControlEditError(404, 'Only OTAKUVA stories can be deleted here.');
}

// ── Articles ────────────────────────────────────────────────────────────
export async function listOwnArticles(actorId: string) {
  const rows = await prisma.userArticle.findMany({
    where: { authorId: actorId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, slug: true, title: true, status: true, coverImageUrl: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
}

export async function getArticleForm(id: string, actorId: string) {
  const a = await prisma.userArticle.findFirst({
    where: { id, authorId: actorId, deletedAt: null },
    include: { anime: { select: { id: true, canonicalTitle: true, posterUrl: true } } },
  });
  if (!a) return null;
  return {
    id: a.id,
    slug: a.slug,
    values: {
      title: a.title,
      summary: a.summary || '',
      body: a.body,
      coverImageUrl: a.coverImageUrl || '',
      links: (Array.isArray(a.links) ? a.links : []) as { label: string; url: string }[],
      animeId: a.animeId,
      status: a.status === 'PUBLISHED' ? 'PUBLISHED' : 'HIDDEN',
    },
    anime: a.anime ? { id: a.anime.id, title: a.anime.canonicalTitle, posterUrl: a.anime.posterUrl } : null,
  };
}

export async function saveArticle(
  id: string | null,
  raw: { title?: unknown; summary?: unknown; body?: unknown; coverImageUrl?: unknown; links?: unknown; animeId?: unknown; status?: unknown },
  actorId: string,
) {
  const checked = validateArticleInput({ title: raw.title, summary: raw.summary, body: raw.body, links: raw.links, animeId: raw.animeId } as never);
  if (!checked.ok) throw new ControlEditError(400, checked.error);
  const v = checked.value;
  const cover = cleanImageUrl(raw.coverImageUrl ?? '');
  if (cover === undefined) throw new ControlEditError(400, 'Cover must be an https:// image link or an uploaded file.');
  let animeId: string | null = null;
  if (v.animeId) {
    const a = await prisma.anime.findFirst({ where: { OR: [{ id: v.animeId }, { slug: v.animeId }] }, select: { id: true } });
    if (!a) throw new ControlEditError(400, 'The related anime could not be found.');
    animeId = a.id;
  }
  const status = raw.status === 'HIDDEN' ? 'HIDDEN' : 'PUBLISHED';
  const data = { title: v.title, summary: v.summary, body: v.body, coverImageUrl: cover ?? null, links: v.links as unknown as object, animeId, status };
  if (!id) {
    const base = generateSlug(v.title) || 'article';
    const created = await prisma.userArticle.create({
      data: { ...data, authorId: actorId, slug: `${base}-${Date.now().toString(36)}` },
      select: { id: true, slug: true },
    });
    return created;
  }
  const owned = await prisma.userArticle.findFirst({ where: { id, authorId: actorId, deletedAt: null }, select: { id: true, slug: true } });
  if (!owned) throw new ControlEditError(404, 'Article not found.');
  await prisma.userArticle.update({ where: { id }, data });
  return owned;
}

export async function deleteArticle(id: string, actorId: string) {
  const n = await prisma.userArticle.updateMany({ where: { id, authorId: actorId, deletedAt: null }, data: { deletedAt: new Date(), status: 'REMOVED' } });
  if (!n.count) throw new ControlEditError(404, 'Article not found.');
}

// ── Collections (official = public lists owned by the owner's account) ──
export async function listOwnCollections(actorId: string) {
  return getMyLists(actorId);
}

export async function getCollectionForm(id: string, actorId: string) {
  const list = await getListForOwner(actorId, id);
  if (!list) return null;
  const items = await prisma.userListItem.findMany({
    where: { listId: id },
    orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
    select: { animeId: true, anime: { select: { canonicalTitle: true, posterUrl: true, slug: true } } },
  });
  return {
    id,
    shareToken: list.shareToken,
    values: {
      name: list.name,
      description: list.description || '',
      visibility: list.visibility,
      // Only a banner the owner chose; otherwise it's derived from the anime.
      bannerUrl: list.bannerChosen ? list.bannerUrl || '' : '',
    },
    items: items.map((i) => ({ id: i.animeId, title: i.anime.canonicalTitle, posterUrl: i.anime.posterUrl, slug: i.anime.slug })),
  };
}

export async function saveCollection(
  id: string | null,
  raw: { name?: unknown; description?: unknown; visibility?: unknown; bannerUrl?: unknown; animeIds?: unknown },
  actorId: string,
) {
  const animeIds = Array.isArray(raw.animeIds) ? [...new Set(raw.animeIds.filter((x): x is string => typeof x === 'string'))] : [];
  if (animeIds.length > 500) throw new ControlEditError(400, 'A collection holds at most 500 anime.');
  if (animeIds.length && (await prisma.anime.count({ where: { id: { in: animeIds } } })) !== animeIds.length) {
    throw new ControlEditError(400, 'One of those anime no longer exists.');
  }
  const banner = cleanImageUrl(raw.bannerUrl ?? '');
  if (banner === undefined) throw new ControlEditError(400, 'Banner must be an https:// image link or an uploaded file.');

  let listId = id;
  try {
    if (!listId) {
      const created = await createList(actorId, { name: raw.name, description: raw.description, visibility: raw.visibility ?? 'PUBLIC' });
      listId = created.id;
    } else {
      await updateList(actorId, listId, { name: raw.name, description: raw.description, visibility: raw.visibility });
    }
  } catch (e) {
    const err = e as { status?: number; message?: string };
    throw new ControlEditError(err.status ?? 400, err.message || 'Could not save the collection.');
  }
  // Order + banner are set directly (the member builder only allows its own uploads/anime banners).
  await prisma.$transaction(async (tx) => {
    await tx.userListItem.deleteMany({ where: { listId: listId! } });
    if (animeIds.length) await tx.userListItem.createMany({ data: animeIds.map((animeId, i) => ({ listId: listId!, animeId, position: i + 1 })) });
    await tx.userList.update({ where: { id: listId! }, data: { bannerUrl: banner ?? null } });
  });
  return { id: listId! };
}

export async function deleteCollection(id: string, actorId: string) {
  try {
    await deleteList(actorId, id);
  } catch (e) {
    const err = e as { status?: number; message?: string };
    throw new ControlEditError(err.status ?? 404, err.message || 'Collection not found.');
  }
}
