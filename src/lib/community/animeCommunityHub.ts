import type { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { readableDiscussionsFilter } from '../engine/community/communityEngine';
import { listArticles } from '../articles/articleService';

/**
 * Everything community-side about one anime, for the "Discussion" section at
 * the bottom of its page: threads about it, threads about other anime in the
 * same genres (when there are few about this one), communities for it or its
 * genres, and member articles about it. Visibility rules are the same as the
 * rest of the site: private-community threads only reach their members, and
 * only listed (PUBLIC / REQUEST_TO_JOIN), active communities are suggested.
 */
const DISCUSSION_INCLUDE = {
  author: { select: { username: true, avatarUrl: true } },
  community: { select: { name: true, slug: true } },
  anime: { select: { slug: true, canonicalTitle: true } },
} as const;

type DiscussionRow = Awaited<ReturnType<typeof prisma.discussion.findMany<{ include: typeof DISCUSSION_INCLUDE }>>>[number];

const toThread = (d: DiscussionRow) => ({
  id: d.id,
  title: d.title,
  type: d.type,
  spoilerLevel: d.spoilerLevel,
  replyCount: d.replyCount,
  createdAt: d.createdAt.toISOString(),
  author: d.author ? { username: d.author.username, avatarUrl: d.author.avatarUrl } : null,
  community: d.community ? { name: d.community.name, slug: d.community.slug } : null,
  anime: d.anime ? { slug: d.anime.slug, title: d.anime.canonicalTitle } : null,
});

export async function getAnimeCommunityHub(animeIdOrSlug: string, viewerId?: string | null) {
  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: animeIdOrSlug }, { slug: animeIdOrSlug }] },
    select: { id: true, slug: true, canonicalTitle: true, animeGenres: { select: { genre: { select: { id: true, name: true, slug: true } } } } },
  });
  if (!anime) return null;
  const genreRows = anime.animeGenres.map((g) => g.genre).filter((g) => !['Hentai', 'Erotica'].includes(g.name));
  const genres = genreRows.map((g) => g.name);
  const visible = { status: { not: 'HIDDEN' }, AND: [readableDiscussionsFilter(viewerId)] };

  const [discussions, discussionCount, communities, communityTotal, articles] = await Promise.all([
    prisma.discussion.findMany({
      where: { ...visible, animeId: anime.id },
      include: DISCUSSION_INCLUDE,
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      take: 5,
    }),
    prisma.discussion.count({ where: { ...visible, animeId: anime.id } }),
    findAnimeCommunities(anime.id, genreRows, viewerId),
    countAnimeCommunities(anime.id, genreRows),
    listArticles({ animeId: anime.id, limit: 6 }),
  ]);

  // Few threads about this anime: show recent ones about anime that share its main genres.
  const sameGenre =
    discussions.length < 3 && genres.length
      ? await prisma.discussion.findMany({
          where: {
            ...visible,
            animeId: { not: anime.id },
            anime: { animeGenres: { some: { genre: { name: { in: genres.slice(0, 3) } } } } },
          },
          include: DISCUSSION_INCLUDE,
          orderBy: [{ replyCount: 'desc' }, { updatedAt: 'desc' }],
          take: 4,
        })
      : [];

  return {
    anime: { id: anime.id, slug: anime.slug, title: anime.canonicalTitle, genres, genreLinks: genreRows.map((g) => ({ name: g.name, slug: g.slug })) },
    discussions: discussions.map(toThread),
    discussionCount,
    sameGenre: sameGenre.map(toThread),
    communities,
    communityTotal,
    articles: articles.articles,
    articleCount: articles.total,
  };
}

type GenreRef = { id: string; name: string; slug: string };

/** Listed, active communities only — private ones are never suggested. */
const LISTED_COMMUNITY: Prisma.CommunityWhereInput = {
  status: 'ACTIVE',
  deletedAt: null,
  visibility: { in: ['PUBLIC', 'REQUEST_TO_JOIN'] },
};

/**
 * Communities related to an anime, by how they're related:
 *   anime   — linked to this anime;
 *   genre   — tagged with one of its genres (or, for older GENRE communities
 *             made before genre tags existed, named after one);
 *   similar — about another anime that shares a genre with it.
 */
function relatedCommunityWhere(animeId: string, genres: GenreRef[]): Prisma.CommunityWhereInput {
  const genreIds = genres.map((g) => g.id);
  return {
    ...LISTED_COMMUNITY,
    OR: [
      { animeId },
      ...(genreIds.length
        ? [
            { genres: { some: { genreId: { in: genreIds } } } },
            {
              OR: [{ communityType: 'GENRE' }, { category: 'GENRE' }],
              AND: [{ OR: genres.map((g) => ({ name: { contains: g.name, mode: 'insensitive' as const } })) }],
            },
            { anime: { animeGenres: { some: { genreId: { in: genreIds } } } } },
          ]
        : []),
    ],
  };
}

async function countAnimeCommunities(animeId: string, genres: GenreRef[]) {
  return prisma.community.count({ where: relatedCommunityWhere(animeId, genres) });
}

async function findAnimeCommunities(animeId: string, genres: GenreRef[], viewerId?: string | null) {
  const rows = await prisma.community.findMany({
    where: relatedCommunityWhere(animeId, genres),
    select: {
      id: true,
      name: true,
      slug: true,
      iconUrl: true,
      bannerUrl: true,
      description: true,
      memberCount: true,
      animeId: true,
      anime: { select: { slug: true, canonicalTitle: true, animeGenres: { select: { genreId: true } } } },
      genres: { select: { genreId: true } },
    },
    orderBy: { memberCount: 'desc' },
    take: 40,
  });

  const byId = new Map(genres.map((g) => [g.id, g]));
  const ranked = rows.map((c) => {
    const tagged = c.genres.map((g) => byId.get(g.genreId)).filter((g): g is GenreRef => Boolean(g));
    const named = genres.filter((g) => c.name.toLowerCase().includes(g.name.toLowerCase()));
    const viaAnime = (c.anime?.animeGenres || []).map((g) => byId.get(g.genreId)).filter((g): g is GenreRef => Boolean(g));
    const reason: 'anime' | 'genre' | 'similar' = c.animeId === animeId ? 'anime' : tagged.length || named.length ? 'genre' : 'similar';
    const shared = Array.from(new Map([...tagged, ...named, ...viaAnime].map((g) => [g.id, g])).values());
    const rank = reason === 'anime' ? 0 : reason === 'genre' ? 1 : 2;
    return { c, reason, shared, rank };
  });
  ranked.sort((a, b) => a.rank - b.rank || b.shared.length - a.shared.length || b.c.memberCount - a.c.memberCount);
  const top = ranked.slice(0, 8);

  const memberships = viewerId && top.length
    ? await prisma.communityMember.findMany({
        where: { userId: viewerId, communityId: { in: top.map((r) => r.c.id) } },
        select: { communityId: true, status: true },
      })
    : [];
  const status = new Map(memberships.map((m) => [m.communityId, m.status]));

  return top.map(({ c, reason, shared }) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    iconUrl: c.iconUrl,
    bannerUrl: c.bannerUrl,
    description: c.description,
    memberCount: c.memberCount,
    reason,
    /** Genres it shares with this anime, for the "Action · Drama" label. */
    sharedGenres: shared.map((g) => g.name),
    /** For "similar": the anime the community is about. */
    about: reason === 'similar' && c.anime ? { slug: c.anime.slug, title: c.anime.canonicalTitle } : null,
    membershipStatus: status.get(c.id) ?? null,
  }));
}
