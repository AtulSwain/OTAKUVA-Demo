import { prisma } from '@/lib/prisma';

const iso = (d: Date | null) => d ? new Date(d).toISOString() : null;
const n = (v: bigint | number | null | undefined) => Number(v ?? 0);
const clean = (rows: any[]) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v instanceof Date ? iso(v) : typeof v === 'bigint' ? n(v) : v])));

export async function getCommunityControlDetail(id: string) {
  const [community] = await prisma.$queryRaw<any[]>`SELECT c.id, c.name, c.slug, c.description, c."iconUrl", c."bannerUrl", c.category, c."communityType", c.visibility, c."joinPolicy", c.status, c."memberCount", c."createdAt", c."updatedAt", u.id AS "ownerId", u.username AS owner, u."displayName" AS "ownerDisplayName", a."canonicalTitle" AS anime, s.name AS studio FROM "Community" c JOIN "User" u ON u.id = c."ownerId" LEFT JOIN "Anime" a ON a.id = c."animeId" LEFT JOIN "Studio" s ON s.id = c."studioId" WHERE c.id = ${id} LIMIT 1`;
  if (!community) return null;
  const [members, discussions, channels, rules, requests, bans, reports, moderation, activity] = await Promise.all([
    prisma.$queryRaw<any[]>`SELECT cm.id, cm.role, cm.status, cm."creatorVerified", cm."joinedAt", u.username, u."displayName" FROM "CommunityMember" cm JOIN "User" u ON u.id = cm."userId" WHERE cm."communityId" = ${id} ORDER BY cm."joinedAt" DESC LIMIT 200`,
    prisma.$queryRaw<any[]>`SELECT d.id, d.title, d.type, d."spoilerLevel", d.status, d."replyCount", d."helpfulCount", d."createdAt", d."updatedAt", u.username AS author FROM "Discussion" d JOIN "User" u ON u.id = d."authorId" WHERE d."communityId" = ${id} ORDER BY d."createdAt" DESC LIMIT 200`,
    prisma.$queryRaw<any[]>`SELECT id, name, slug, type, position, "createdAt" FROM "CommunityChannel" WHERE "communityId" = ${id} ORDER BY position, name`,
    prisma.$queryRaw<any[]>`SELECT id, position, title, content FROM "CommunityRule" WHERE "communityId" = ${id} ORDER BY position`,
    prisma.$queryRaw<any[]>`SELECT r.id, r.status, r.message, r."createdAt", r."reviewedAt", u.username FROM "CommunityJoinRequest" r JOIN "User" u ON u.id = r."userId" WHERE r."communityId" = ${id} ORDER BY r."createdAt" DESC LIMIT 200`,
    prisma.$queryRaw<any[]>`SELECT b.id, b.reason, b."createdAt", b."expiresAt", u.username FROM "CommunityBan" b JOIN "User" u ON u.id = b."userId" WHERE b."communityId" = ${id} ORDER BY b."createdAt" DESC`,
    prisma.$queryRaw<any[]>`SELECT r.id, r.reason, r.description, r.status, r."actionTaken", r."createdAt", u.username AS reporter FROM "Report" r JOIN "User" u ON u.id = r."reporterId" WHERE r."targetType" = 'COMMUNITY' AND r."targetId" = ${id} ORDER BY r."createdAt" DESC`,
    prisma.$queryRaw<any[]>`SELECT m.id, m.action, m.reason, m."targetType", m."targetId", m."createdAt", u.username AS moderator FROM "ModerationAction" m JOIN "User" u ON u.id = m."moderatorId" WHERE m."communityId" = ${id} OR (m."targetType" = 'COMMUNITY' AND m."targetId" = ${id}) ORDER BY m."createdAt" DESC LIMIT 200`,
    prisma.$queryRaw<any[]>`SELECT ac.id, ac.type, ac.metadata, ac."createdAt", u.username FROM "Activity" ac JOIN "User" u ON u.id = ac."userId" WHERE ac.type IN ('JOINED_COMMUNITY','DISCUSSION_CREATED') AND (ac.metadata ILIKE ${'%' + id + '%'} OR ac."userId" IN (SELECT "userId" FROM "CommunityMember" WHERE "communityId" = ${id})) ORDER BY ac."createdAt" DESC LIMIT 200`,
  ]);
  return { community: clean([community])[0], members: clean(members), discussions: clean(discussions), channels: clean(channels), rules: clean(rules), requests: clean(requests), bans: clean(bans), reports: clean(reports), moderation: clean(moderation), activity: clean(activity) };
}

export async function getDiscussionControlDetail(id: string) {
  const [discussion] = await prisma.$queryRaw<any[]>`SELECT d.id, d.title, d.body, d.type, d."spoilerLevel", d.status, d."replyCount", d."helpfulCount", d."createdAt", d."updatedAt", u.username AS author, u."displayName" AS "authorDisplayName", c.id AS "communityId", c.name AS community, ch.name AS channel, a."canonicalTitle" AS anime, d."episodeId" FROM "Discussion" d JOIN "User" u ON u.id = d."authorId" LEFT JOIN "Community" c ON c.id = d."communityId" LEFT JOIN "CommunityChannel" ch ON ch.id = d."channelId" LEFT JOIN "Anime" a ON a.id = d."animeId" WHERE d.id = ${id} LIMIT 1`;
  if (!discussion) return null;
  const [comments, reactions, followers, reports, moderation] = await Promise.all([
    prisma.$queryRaw<any[]>`SELECT c.id, c.body, c."spoilerLevel", c."createdAt", c."updatedAt", c."deletedAt", u.username, u."displayName" FROM "DiscussionComment" c JOIN "User" u ON u.id = c."authorId" WHERE c."discussionId" = ${id} ORDER BY c."createdAt" ASC LIMIT 500`,
    prisma.$queryRaw<any[]>`SELECT dr.type, COUNT(*) AS count FROM "DiscussionReaction" dr WHERE dr."discussionId" = ${id} GROUP BY dr.type`,
    prisma.$queryRaw<any[]>`SELECT COUNT(*) AS count FROM "DiscussionFollower" WHERE "discussionId" = ${id}`,
    prisma.$queryRaw<any[]>`SELECT r.id, r.reason, r.description, r.status, r."actionTaken", r."createdAt", u.username AS reporter FROM "Report" r JOIN "User" u ON u.id = r."reporterId" WHERE r."targetType" = 'DISCUSSION' AND r."targetId" = ${id} ORDER BY r."createdAt" DESC`,
    prisma.$queryRaw<any[]>`SELECT m.id, m.action, m.reason, m."createdAt", u.username AS moderator FROM "ModerationAction" m JOIN "User" u ON u.id = m."moderatorId" WHERE m."targetType" = 'DISCUSSION' AND m."targetId" = ${id} ORDER BY m."createdAt" DESC`,
  ]);
  return { discussion: clean([discussion])[0], comments: clean(comments), reactions: clean(reactions), followers: n(followers[0]?.count), reports: clean(reports), moderation: clean(moderation) };
}
