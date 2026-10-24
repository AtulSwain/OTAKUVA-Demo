import { prisma } from '../prisma';
import { logger } from '../logger';
import { hasMinRole } from '../roles';
import { REVIEW_TAGS, reviewTagLabel } from './reviewTags';

/** Visible-review filter shared by every count below. */
const PUBLISHED_REVIEW = { deletedAt: null, status: 'PUBLISHED' } as const;

export const REPLY_MAX_LENGTH = 1000;
/** Replies returned inline with a review list; more load on demand. */
export const INLINE_REPLY_LIMIT = 3;

/** Replace a review's tags with `tags` (already sanitized against the vocabulary). */
export async function setReviewTags(reviewId: string, animeId: string, tags: string[]) {
  await prisma.$transaction([
    prisma.reviewTag.deleteMany({ where: { reviewId } }),
    ...(tags.length > 0
      ? [prisma.reviewTag.createMany({ data: tags.map((tag) => ({ reviewId, animeId, tag })), skipDuplicates: true })]
      : []),
  ]);
}

export async function getTagsForReviews(reviewIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (reviewIds.length === 0) return map;
  const rows = await prisma.reviewTag.findMany({
    where: { reviewId: { in: reviewIds } },
    select: { reviewId: true, tag: true },
    orderBy: { createdAt: 'asc' },
  });
  for (const r of rows) map.set(r.reviewId, [...(map.get(r.reviewId) ?? []), r.tag]);
  return map;
}

export interface CommunityTag {
  tag: string;
  label: string;
  count: number;
}

/**
 * The anime's community tags: how many visible reviews picked each tag,
 * most-picked first. Recomputed from rows on read, so editing or deleting a
 * review (or a moderator hiding one) is reflected immediately.
 */
export async function getCommunityTags(animeId: string): Promise<CommunityTag[]> {
  const groups = await prisma.reviewTag.groupBy({
    by: ['tag'],
    where: { animeId, review: PUBLISHED_REVIEW },
    _count: { tag: true },
  });
  const order = new Map(REVIEW_TAGS.map((t, i) => [t.key, i]));
  return groups
    .map((g) => ({ tag: g.tag, label: reviewTagLabel(g.tag), count: g._count.tag }))
    .sort((a, b) => b.count - a.count || (order.get(a.tag) ?? 99) - (order.get(b.tag) ?? 99));
}

export interface ReplyItem {
  id: string;
  reviewId: string;
  body: string;
  createdAt: string;
  user: { id: string; username: string; avatarUrl: string | null };
  canDelete: boolean;
}

const replyWhere = (reviewId: string) => ({ reviewId, deletedAt: null, status: 'PUBLISHED' });

function toReplyItem(
  r: { id: string; reviewId: string; body: string; createdAt: Date; user: { id: string; username: string; avatarUrl: string | null } },
  viewer: { id: string; role?: string } | null
): ReplyItem {
  return {
    id: r.id,
    reviewId: r.reviewId,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    user: r.user,
    canDelete: Boolean(viewer && (viewer.id === r.user.id || hasMinRole(viewer.role || '', 'MODERATOR'))),
  };
}

/** Reply count + the first few replies (oldest first) for each review. */
export async function getRepliesForReviews(
  reviewIds: string[],
  viewer: { id: string; role?: string } | null
): Promise<Map<string, { count: number; replies: ReplyItem[] }>> {
  const map = new Map<string, { count: number; replies: ReplyItem[] }>();
  if (reviewIds.length === 0) return map;

  const counts = await prisma.reviewReply.groupBy({
    by: ['reviewId'],
    where: { reviewId: { in: reviewIds }, deletedAt: null, status: 'PUBLISHED' },
    _count: { reviewId: true },
  });
  const withReplies = counts.filter((c) => c._count.reviewId > 0).map((c) => c.reviewId);
  const firstPages = await Promise.all(
    withReplies.map((reviewId) =>
      prisma.reviewReply.findMany({
        where: replyWhere(reviewId),
        orderBy: { createdAt: 'asc' },
        take: INLINE_REPLY_LIMIT,
        select: { id: true, reviewId: true, body: true, createdAt: true, user: { select: { id: true, username: true, avatarUrl: true } } },
      })
    )
  );
  for (const c of counts) map.set(c.reviewId, { count: c._count.reviewId, replies: [] });
  firstPages.forEach((rows, i) => {
    map.get(withReplies[i])!.replies = rows.map((r) => toReplyItem(r, viewer));
  });
  return map;
}

export async function listReplies(reviewId: string, viewer: { id: string; role?: string } | null) {
  const rows = await prisma.reviewReply.findMany({
    where: replyWhere(reviewId),
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: { id: true, reviewId: true, body: true, createdAt: true, user: { select: { id: true, username: true, avatarUrl: true } } },
  });
  return rows.map((r) => toReplyItem(r, viewer));
}

export class ReplyError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function createReply(reviewId: string, author: { id: string; username: string; role?: string }, rawBody: unknown) {
  const body = typeof rawBody === 'string' ? rawBody.trim() : '';
  if (!body) throw new ReplyError('Reply cannot be empty', 400);
  if (body.length > REPLY_MAX_LENGTH) throw new ReplyError(`Reply cannot exceed ${REPLY_MAX_LENGTH} characters`, 400);

  const review = await prisma.review.findFirst({
    where: { id: reviewId, ...PUBLISHED_REVIEW },
    select: { id: true, userId: true, anime: { select: { slug: true, id: true } } },
  });
  if (!review) throw new ReplyError('Review not found', 404);

  const created = await prisma.reviewReply.create({
    data: { reviewId, userId: author.id, body },
    select: { id: true, reviewId: true, body: true, createdAt: true, user: { select: { id: true, username: true, avatarUrl: true } } },
  });

  if (review.userId !== author.id) {
    try {
      await prisma.notification.create({
        data: {
          userId: review.userId,
          type: 'REPLY_REVIEW',
          title: `${author.username} replied to your review`,
          body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
          linkUrl: `/anime/${review.anime.slug || review.anime.id}#review-${reviewId}`,
        },
      });
    } catch (err) {
      // A failed notification never fails the reply itself.
      logger.warn('review reply notification failed', { error: err instanceof Error ? err.message : String(err), reviewId });
    }
  }
  return toReplyItem(created, author);
}

/** Soft delete: the author, or a moderator and above. */
export async function deleteReply(replyId: string, viewer: { id: string; role?: string }) {
  const reply = await prisma.reviewReply.findFirst({ where: { id: replyId, deletedAt: null }, select: { id: true, userId: true } });
  if (!reply) throw new ReplyError('Reply not found', 404);
  if (reply.userId !== viewer.id && !hasMinRole(viewer.role || '', 'MODERATOR')) {
    throw new ReplyError('You can only delete your own replies', 403);
  }
  await prisma.reviewReply.update({ where: { id: replyId }, data: { deletedAt: new Date() } });
}
