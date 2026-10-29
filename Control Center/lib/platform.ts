/**
 * The owner's "main desk" (2026-10-28): every creator, community and
 * discussion on the platform, a live activity feed across all accounts, and
 * the admin alerts. Read-only, plain SQL, nothing estimated.
 */
import { prisma } from '@/lib/prisma';

const n = (v: unknown) => Number(v ?? 0);
const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

export async function listCreators() {
  const rows = await prisma.$queryRaw<
    { id: string; username: string; displayName: string | null; avatarUrl: string | null; channel: string | null; channelUrl: string | null; since: Date | null; createdAt: Date; lastSeenAt: Date | null; followers: bigint; reviews: bigint; creatorReviews: bigint; rated: bigint; hyped: bigint; communities: bigint; articles: bigint }[]
  >`
    SELECT u.id, u.username, u."displayName", u."avatarUrl", u."creatorChannelName" AS channel, u."creatorChannelUrl" AS "channelUrl",
           u."creatorSince" AS since, u."createdAt", u."lastSeenAt",
           (SELECT COUNT(*) FROM "Follow" f WHERE f."followingId" = u.id) AS followers,
           (SELECT COUNT(*) FROM "Review" r WHERE r."userId" = u.id AND r.status = 'PUBLISHED' AND r."deletedAt" IS NULL) AS reviews,
           (SELECT COUNT(*) FROM "Review" r WHERE r."userId" = u.id AND r."isCreatorReview" AND r.status = 'PUBLISHED' AND r."deletedAt" IS NULL) AS "creatorReviews",
           (SELECT COUNT(DISTINCT e."animeId") FROM "EpisodeRating" e WHERE e."userId" = u.id) AS rated,
           (SELECT COUNT(*) FROM "AnimeHype" h WHERE h."userId" = u.id AND h.level = 'HYPED') AS hyped,
           (SELECT COUNT(*) FROM "Community" c WHERE c."ownerId" = u.id AND c."deletedAt" IS NULL) AS communities,
           (SELECT COUNT(*) FROM "UserArticle" a WHERE a."authorId" = u.id AND a."deletedAt" IS NULL) AS articles
    FROM "User" u WHERE u.role = 'CREATOR'
    ORDER BY followers DESC, u."creatorSince" DESC NULLS LAST`;
  return rows.map((r) => ({
    ...r,
    since: iso(r.since),
    createdAt: iso(r.createdAt),
    lastSeenAt: iso(r.lastSeenAt),
    followers: n(r.followers),
    reviews: n(r.reviews),
    creatorReviews: n(r.creatorReviews),
    rated: n(r.rated),
    hyped: n(r.hyped),
    communities: n(r.communities),
    articles: n(r.articles),
  }));
}

export async function listCommunities() {
  const rows = await prisma.$queryRaw<
    { id: string; name: string; slug: string; owner: string; visibility: string; type: string; status: string; members: number; discussions: bigint; createdAt: Date; anime: string | null }[]
  >`
    SELECT c.id, c.name, c.slug, u.username AS owner, c.visibility, c."communityType" AS type, c.status, c."memberCount" AS members,
           (SELECT COUNT(*) FROM "Discussion" d WHERE d."communityId" = c.id) AS discussions, c."createdAt", a."canonicalTitle" AS anime
    FROM "Community" c JOIN "User" u ON u.id = c."ownerId" LEFT JOIN "Anime" a ON a.id = c."animeId"
    WHERE c."deletedAt" IS NULL
    ORDER BY c."memberCount" DESC, c."createdAt" DESC`;
  return rows.map((r) => ({ ...r, discussions: n(r.discussions), createdAt: iso(r.createdAt) }));
}

export async function listDiscussions(q = '', limit = 150) {
  const term = `%${q.trim().slice(0, 60)}%`;
  const rows = await prisma.$queryRaw<
    { id: string; title: string; author: string; community: string | null; communitySlug: string | null; anime: string | null; replies: number; status: string; createdAt: Date }[]
  >`
    SELECT d.id, d.title, u.username AS author, c.name AS community, c.slug AS "communitySlug", a."canonicalTitle" AS anime,
           d."replyCount" AS replies, d.status, d."createdAt"
    FROM "Discussion" d JOIN "User" u ON u.id = d."authorId"
    LEFT JOIN "Community" c ON c.id = d."communityId" LEFT JOIN "Anime" a ON a.id = d."animeId"
    WHERE (${q.trim()} = '' OR d.title ILIKE ${term})
    ORDER BY d."createdAt" DESC LIMIT ${limit}`;
  return rows.map((r) => ({ ...r, createdAt: iso(r.createdAt) }));
}

export type FeedItem = { at: string; kind: string; who: string; text: string; href: string | null };

/** Everything members did, newest first (sign-ups, creators, reviews, ratings, hype, library, lists, articles, discussions, follows, joins). */
export async function activityFeed(limit = 120, kind = ''): Promise<FeedItem[]> {
  const rows = await prisma.$queryRaw<{ at: Date; kind: string; who: string; text: string | null; href: string | null }[]>`
    SELECT * FROM (
      SELECT u."createdAt" AS at, 'signup' AS kind, u.username AS who, 'created an account' AS text, '/profile/' || u.username AS href FROM "User" u
      UNION ALL SELECT u."creatorSince", 'creator', u.username, 'became a creator — ' || COALESCE(u."creatorChannelName", ''), '/profile/' || u.username FROM "User" u WHERE u."creatorSince" IS NOT NULL
      UNION ALL SELECT r."createdAt", 'review', u.username, 'reviewed ' || a."canonicalTitle", '/anime/' || a.slug || '#reviews' FROM "Review" r JOIN "User" u ON u.id = r."userId" JOIN "Anime" a ON a.id = r."animeId" WHERE r."deletedAt" IS NULL
      UNION ALL SELECT e."createdAt", 'rating', u.username, 'rated episode ' || e."episodeNumber" || ' of ' || a."canonicalTitle" || COALESCE(' (' || e.retention || '%)', ''), '/anime/' || a.slug FROM "EpisodeRating" e JOIN "User" u ON u.id = e."userId" JOIN "Anime" a ON a.id = e."animeId"
      UNION ALL SELECT h."createdAt", 'hype', u.username, 'is hyped for ' || a."canonicalTitle", '/anime/' || a.slug FROM "AnimeHype" h JOIN "User" u ON u.id = h."userId" JOIN "Anime" a ON a.id = h."animeId" WHERE h.level = 'HYPED'
      UNION ALL SELECT x."updatedAt", 'library', u.username, 'set ' || a."canonicalTitle" || ' to ' || replace(lower(x.status), '_', ' '), '/anime/' || a.slug FROM "UserAnime" x JOIN "User" u ON u.id = x."userId" JOIN "Anime" a ON a.id = x."animeId"
      UNION ALL SELECT l."createdAt", 'collection', u.username, 'made a collection: ' || l.name, NULL FROM "UserList" l JOIN "User" u ON u.id = l."userId"
      UNION ALL SELECT ar."createdAt", 'article', u.username, 'published an article: ' || ar.title, '/articles/' || ar.slug FROM "UserArticle" ar JOIN "User" u ON u.id = ar."authorId" WHERE ar."deletedAt" IS NULL
      UNION ALL SELECT d."createdAt", 'discussion', u.username, 'started a discussion: ' || d.title, '/discussions/' || d.id FROM "Discussion" d JOIN "User" u ON u.id = d."authorId"
      UNION ALL SELECT f."createdAt", 'follow', u.username, 'followed @' || t.username, '/profile/' || t.username FROM "Follow" f JOIN "User" u ON u.id = f."followerId" JOIN "User" t ON t.id = f."followingId"
      UNION ALL SELECT m."joinedAt", 'community', u.username, 'joined ' || c.name, '/community/' || c.slug FROM "CommunityMember" m JOIN "User" u ON u.id = m."userId" JOIN "Community" c ON c.id = m."communityId"
    ) feed
    WHERE at IS NOT NULL AND (${kind} = '' OR kind = ${kind})
    ORDER BY at DESC LIMIT ${limit}`;
  return rows.map((r) => ({ at: new Date(r.at).toISOString(), kind: r.kind, who: r.who, text: r.text ?? '', href: r.href }));
}

/** Platform-wide totals for the main desk header. */
export async function platformTotals() {
  const [r] = await prisma.$queryRaw<Record<string, bigint>[]>`
    SELECT (SELECT COUNT(*) FROM "User") AS members,
           (SELECT COUNT(*) FROM "User" WHERE role = 'CREATOR') AS creators,
           (SELECT COUNT(*) FROM "Community" WHERE "deletedAt" IS NULL) AS communities,
           (SELECT COUNT(*) FROM "Discussion") AS discussions,
           (SELECT COALESCE(SUM("replyCount"), 0) FROM "Discussion") AS replies,
           (SELECT COUNT(*) FROM "Review" WHERE "deletedAt" IS NULL) AS reviews,
           (SELECT COUNT(*) FROM "EpisodeRating") AS ratings,
           (SELECT COUNT(*) FROM "UserAnime") AS library,
           (SELECT COUNT(*) FROM "UserList") AS collections,
           (SELECT COUNT(*) FROM "UserArticle" WHERE "deletedAt" IS NULL) AS articles,
           (SELECT COUNT(*) FROM "Follow") AS follows,
           (SELECT COUNT(*) FROM "AnimeHype" WHERE level = 'HYPED') AS hype,
           (SELECT COUNT(*) FROM "Anime" WHERE "isAdult" = false AND status <> 'MERGED') AS anime`;
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, n(v)])) as Record<string, number>;
}

/** Recent admin alerts (new members, new creators) for this admin. */
export async function adminAlerts(userId: string, limit = 12) {
  return prisma.notification.findMany({
    where: { userId, type: { in: ['ADMIN_NEW_MEMBER', 'ADMIN_NEW_CREATOR'] } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, type: true, title: true, body: true, linkUrl: true, isRead: true, createdAt: true },
  });
}
