/**
 * Discussion comments and replies — the single implementation.
 *
 * Every read and write of DiscussionComment goes through here: the
 * /api/discussions/:id/comments routes, /api/comments/:id, and the engine
 * re-export in communityEngine. Replies are ordinary comments with a
 * parentId; images/GIFs/memes are CommentMedia rows. Identity always comes
 * from the caller's session (never the request body), and access follows the
 * same community rules as the rest of the platform.
 */

import { prisma } from '../../prisma';
import { emitEngineEvent } from '../events/eventEngine';
import { hasMinRole } from '../../roles';
import { canUserViewCommunityContent, getMemberPermission } from './communityEngine';
import { resolveGifForAttachment } from '../../media/gifProvider';
import { CommentError } from './commentError';

export const COMMENT_BODY_MAX = 5000;
export const MAX_MEDIA_PER_COMMENT = 4;
export const COMMENT_PAGE_SIZE = 20;
export const REPLY_PAGE_SIZE = 10;
const SPOILER_LEVELS = new Set(['NO_SPOILER', 'ANIME_SPOILER', 'EPISODE_SPOILER', 'MANGA_SPOILER']);

export { CommentError };

export interface CommentAuthor {
  id: string;
  username: string;
  avatarUrl: string | null;
}

export interface CommentMediaDto {
  id: string;
  type: 'IMAGE' | 'GIF';
  source: string;
  url: string;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
  isSpoiler: boolean;
}

export interface CommentDto {
  id: string;
  discussionId: string;
  parentId: string | null;
  body: string | null; // null once deleted (kept as a tombstone while it has replies)
  spoilerLevel: string;
  isDeleted: boolean;
  createdAt: string;
  author: CommentAuthor | null;
  media: CommentMediaDto[];
  likeCount: number;
  replyCount: number;
  likedByViewer: boolean;
  canDelete: boolean;
}

type DiscussionForAccess = {
  id: string;
  title: string;
  authorId: string;
  status: string;
  community: { id: string; visibility: string; ownerId: string; status: string } | null;
};

async function loadDiscussion(discussionId: string): Promise<DiscussionForAccess> {
  const discussion = await prisma.discussion.findUnique({
    where: { id: discussionId },
    select: {
      id: true,
      title: true,
      authorId: true,
      status: true,
      community: { select: { id: true, visibility: true, ownerId: true, status: true } },
    },
  });
  if (!discussion) throw new CommentError('Discussion not found', 404);
  return discussion;
}

async function assertCanRead(discussion: DiscussionForAccess, viewerId?: string | null) {
  if (discussion.status === 'HIDDEN') throw new CommentError('Discussion not found', 404);
  if (discussion.community && !(await canUserViewCommunityContent(discussion.community, viewerId))) {
    throw new CommentError('Access denied: Private community membership required', 403);
  }
}

async function assertCanPost(discussion: DiscussionForAccess, userId: string) {
  await assertCanRead(discussion, userId);
  if (discussion.status === 'LOCKED') throw new CommentError('This discussion is closed to new replies', 403);
  // Posting inside a community needs an active, unbanned, unmuted member.
  if (discussion.community) {
    const perm = await getMemberPermission(userId, discussion.community.id);
    if (!(perm.canPost || (perm.isOwner && !perm.isBanned))) {
      throw new CommentError('You must be an active member of this community to reply here', 403);
    }
  }
}

async function canModerateComment(userId: string, userRole: string | undefined, communityId: string | null) {
  if (userRole && hasMinRole(userRole, 'MODERATOR')) return true;
  if (!communityId) return false;
  return (await getMemberPermission(userId, communityId)).canModerate;
}

const commentSelect = {
  id: true,
  discussionId: true,
  parentId: true,
  body: true,
  spoilerLevel: true,
  createdAt: true,
  deletedAt: true,
  authorId: true,
  author: { select: { id: true, username: true, avatarUrl: true } },
  media: {
    orderBy: { createdAt: 'asc' as const },
    select: { id: true, type: true, source: true, url: true, thumbnailUrl: true, width: true, height: true, isSpoiler: true },
  },
  _count: {
    select: {
      reactions: { where: { type: 'LIKE' } },
      replies: { where: { deletedAt: null } },
    },
  },
};

type SelectedComment = {
  id: string;
  discussionId: string;
  parentId: string | null;
  body: string;
  spoilerLevel: string;
  createdAt: Date;
  deletedAt: Date | null;
  authorId: string;
  author: CommentAuthor;
  media: Array<Omit<CommentMediaDto, 'type'> & { type: string }>;
  _count: { reactions: number; replies: number };
};

function toDto(c: SelectedComment, viewer: { id: string; canModerate: boolean } | null, likedIds: Set<string>): CommentDto {
  const isDeleted = Boolean(c.deletedAt);
  return {
    id: c.id,
    discussionId: c.discussionId,
    parentId: c.parentId,
    body: isDeleted ? null : c.body,
    spoilerLevel: c.spoilerLevel,
    isDeleted,
    createdAt: c.createdAt.toISOString(),
    author: isDeleted ? null : c.author,
    media: isDeleted ? [] : c.media.map((m) => ({ ...m, type: m.type === 'GIF' ? 'GIF' : 'IMAGE' })),
    likeCount: c._count.reactions,
    replyCount: c._count.replies,
    likedByViewer: likedIds.has(c.id),
    canDelete: !isDeleted && Boolean(viewer && (viewer.id === c.authorId || viewer.canModerate)),
  };
}

/* ------------------------------------------------------------------ */
/* Create                                                              */
/* ------------------------------------------------------------------ */

export interface CreateCommentInput {
  authorId: string;
  discussionId: string;
  parentId?: string | null;
  body?: string;
  spoilerLevel?: string;
  /** Pending uploads (POST /api/uploads/comment-media) owned by the author. */
  mediaIds?: string[];
  /** GIFs chosen from the provider picker; resolved server-side by id. */
  gifIds?: string[];
  /** Hide attached media behind a spoiler even if the text isn't one. */
  mediaIsSpoiler?: boolean;
}

export async function createDiscussionComment(input: CreateCommentInput): Promise<CommentDto> {
  const body = typeof input.body === 'string' ? input.body.trim() : '';
  const mediaIds = Array.from(new Set((input.mediaIds || []).filter((id) => typeof id === 'string')));
  const gifIds = Array.from(new Set((input.gifIds || []).filter((id) => typeof id === 'string')));
  const spoilerLevel = SPOILER_LEVELS.has(String(input.spoilerLevel || '').toUpperCase())
    ? String(input.spoilerLevel).toUpperCase()
    : 'NO_SPOILER';

  if (!body && mediaIds.length === 0 && gifIds.length === 0) {
    throw new CommentError('Write something or attach an image or GIF', 400);
  }
  if (body.length > COMMENT_BODY_MAX) throw new CommentError(`Comments are limited to ${COMMENT_BODY_MAX} characters`, 400);
  if (mediaIds.length + gifIds.length > MAX_MEDIA_PER_COMMENT) {
    throw new CommentError(`A comment can have at most ${MAX_MEDIA_PER_COMMENT} images or GIFs`, 400);
  }

  const discussion = await loadDiscussion(input.discussionId);
  await assertCanPost(discussion, input.authorId);

  // Replies live one level under a top-level comment, like most comment
  // threads: replying to a reply threads under the same root, and the person
  // replied to is still the one notified.
  let rootParentId: string | null = null;
  let repliedToAuthorId: string | null = null;
  if (input.parentId) {
    const parent = await prisma.discussionComment.findUnique({
      where: { id: String(input.parentId) },
      select: { id: true, discussionId: true, parentId: true, deletedAt: true, authorId: true },
    });
    if (!parent || parent.discussionId !== discussion.id || parent.deletedAt) {
      throw new CommentError('The comment you are replying to does not exist in this discussion', 400);
    }
    rootParentId = parent.parentId ?? parent.id;
    repliedToAuthorId = parent.authorId;
  }

  // GIFs are resolved through the provider by id, so only URLs the provider
  // itself returns are ever stored — never a URL supplied by the client.
  const gifs: Awaited<ReturnType<typeof resolveGifForAttachment>>[] = [];
  for (const gifId of gifIds) {
    gifs.push(await resolveGifForAttachment(gifId));
  }

  const created = await prisma.$transaction(async (tx) => {
    const comment = await tx.discussionComment.create({
      data: {
        discussionId: discussion.id,
        authorId: input.authorId,
        parentId: rootParentId,
        body,
        spoilerLevel,
      },
      select: { id: true },
    });

    if (mediaIds.length > 0) {
      // Only this author's own, still-unattached uploads can be attached.
      const attached = await tx.commentMedia.updateMany({
        where: { id: { in: mediaIds }, uploaderId: input.authorId, commentId: null, source: 'UPLOAD' },
        data: { commentId: comment.id, attachedAt: new Date(), isSpoiler: Boolean(input.mediaIsSpoiler) },
      });
      if (attached.count !== mediaIds.length) {
        throw new CommentError('One or more attachments are missing or not yours to attach', 400);
      }
    }

    for (const gif of gifs) {
      await tx.commentMedia.create({
        data: {
          commentId: comment.id,
          uploaderId: input.authorId,
          type: 'GIF',
          source: gif.provider,
          providerMediaId: gif.id,
          url: gif.url,
          thumbnailUrl: gif.previewUrl,
          width: gif.width,
          height: gif.height,
          mimeType: 'image/gif',
          isSpoiler: Boolean(input.mediaIsSpoiler),
          attachedAt: new Date(),
        },
      });
    }

    const replyCount = await tx.discussionComment.count({ where: { discussionId: discussion.id, deletedAt: null } });
    await tx.discussion.update({ where: { id: discussion.id }, data: { replyCount } });

    return comment;
  });

  const author = await prisma.user.findUnique({ where: { id: input.authorId }, select: { username: true } });
  const actor = author?.username ?? 'Someone';
  const linkUrl = `/discussions/${discussion.id}#comment-${created.id}`;

  // Notifications ride the existing Notification model. A failure here must
  // never undo a posted comment.
  try {
    const notified = new Set<string>([input.authorId]);
    if (repliedToAuthorId && !notified.has(repliedToAuthorId)) {
      notified.add(repliedToAuthorId);
      await prisma.notification.create({
        data: {
          userId: repliedToAuthorId,
          type: 'REPLY_COMMENT',
          title: `${actor} replied to your comment`,
          body: body ? body.slice(0, 120) : 'Sent an image',
          linkUrl,
        },
      });
    }
    if (!notified.has(discussion.authorId)) {
      notified.add(discussion.authorId);
      await prisma.notification.create({
        data: {
          userId: discussion.authorId,
          type: 'REPLY_DISCUSSION',
          title: `${actor} replied to your discussion`,
          body: `"${discussion.title.slice(0, 60)}"`,
          linkUrl,
        },
      });
    }
    await notifyMentions(body, input.authorId, actor, linkUrl, discussion.title, notified);
  } catch (err) {
    console.error('[comments] notification failed', err);
  }

  await emitEngineEvent({
    eventType: 'COMMENT_CREATED',
    userId: input.authorId,
    entityType: 'DISCUSSION',
    entityId: discussion.id,
    metadata: { commentId: created.id, parentId: rootParentId, mediaCount: mediaIds.length + gifs.length },
  }).catch(() => {});

  const full = await prisma.discussionComment.findUniqueOrThrow({ where: { id: created.id }, select: commentSelect });
  return toDto(full as unknown as SelectedComment, { id: input.authorId, canModerate: false }, new Set());
}

async function notifyMentions(
  body: string,
  authorId: string,
  actor: string,
  linkUrl: string,
  contextTitle: string,
  alreadyNotified: Set<string>
) {
  const usernames = Array.from(new Set((body.match(/@([a-zA-Z0-9_-]+)/g) || []).map((m) => m.slice(1)))).slice(0, 10);
  if (usernames.length === 0) return;
  const users = await prisma.user.findMany({
    where: { username: { in: usernames }, id: { not: authorId } },
    select: { id: true },
  });
  for (const u of users) {
    if (alreadyNotified.has(u.id)) continue;
    alreadyNotified.add(u.id);
    await prisma.notification.create({
      data: {
        userId: u.id,
        type: 'MENTION',
        title: `${actor} mentioned you`,
        body: `In "${contextTitle.slice(0, 60)}"`,
        linkUrl,
      },
    });
  }
}

/* ------------------------------------------------------------------ */
/* Read                                                                */
/* ------------------------------------------------------------------ */

export interface ListCommentsOptions {
  discussionId: string;
  viewer?: { id: string; role?: string } | null;
  /** Omit for top-level comments; pass a comment id for its replies. */
  parentId?: string | null;
  cursor?: string | null;
  limit?: number;
  sort?: 'top' | 'newest';
}

export async function listComments(opts: ListCommentsOptions) {
  const discussion = await loadDiscussion(opts.discussionId);
  await assertCanRead(discussion, opts.viewer?.id);

  const isReplies = Boolean(opts.parentId);
  const defaultLimit = isReplies ? REPLY_PAGE_SIZE : COMMENT_PAGE_SIZE;
  const limit = Math.min(50, Math.max(1, Number(opts.limit) || defaultLimit));

  // Deleted comments stay only as tombstones that hold a thread together.
  const where = {
    discussionId: discussion.id,
    parentId: isReplies ? String(opts.parentId) : null,
    OR: [{ deletedAt: null }, { replies: { some: { deletedAt: null } } }],
  };

  const orderBy = isReplies
    ? [{ createdAt: 'asc' as const }, { id: 'asc' as const }]
    : opts.sort === 'newest'
      ? [{ createdAt: 'desc' as const }, { id: 'desc' as const }]
      : [{ reactions: { _count: 'desc' as const } }, { createdAt: 'desc' as const }, { id: 'desc' as const }];

  const rows = await prisma.discussionComment.findMany({
    where,
    orderBy,
    take: limit + 1,
    ...(opts.cursor ? { cursor: { id: String(opts.cursor) }, skip: 1 } : {}),
    select: commentSelect,
  });

  const page = rows.slice(0, limit) as unknown as SelectedComment[];
  const nextCursor = rows.length > limit ? page[page.length - 1].id : null;

  let likedIds = new Set<string>();
  let viewer: { id: string; canModerate: boolean } | null = null;
  if (opts.viewer) {
    const [liked, canModerate] = await Promise.all([
      prisma.commentReaction.findMany({
        where: { userId: opts.viewer.id, type: 'LIKE', commentId: { in: page.map((c) => c.id) } },
        select: { commentId: true },
      }),
      canModerateComment(opts.viewer.id, opts.viewer.role, discussion.community?.id ?? null),
    ]);
    likedIds = new Set(liked.map((l) => l.commentId));
    viewer = { id: opts.viewer.id, canModerate };
  }

  const total = await prisma.discussionComment.count({ where: { discussionId: discussion.id, deletedAt: null } });

  return {
    comments: page.map((c) => toDto(c, viewer, likedIds)),
    nextCursor,
    totalComments: total,
  };
}

/* ------------------------------------------------------------------ */
/* Like / delete                                                       */
/* ------------------------------------------------------------------ */

async function loadCommentForAction(commentId: string) {
  const comment = await prisma.discussionComment.findUnique({
    where: { id: commentId },
    select: { id: true, authorId: true, deletedAt: true, discussionId: true },
  });
  if (!comment || comment.deletedAt) throw new CommentError('Comment not found', 404);
  const discussion = await loadDiscussion(comment.discussionId);
  return { comment, discussion };
}

export async function toggleCommentLike(userId: string, commentId: string) {
  const { comment, discussion } = await loadCommentForAction(commentId);
  await assertCanRead(discussion, userId);

  const existing = await prisma.commentReaction.findUnique({
    where: { commentId_userId_type: { commentId: comment.id, userId, type: 'LIKE' } },
  });
  if (existing) {
    await prisma.commentReaction.delete({ where: { id: existing.id } });
  } else {
    await prisma.commentReaction.create({ data: { commentId: comment.id, userId, type: 'LIKE' } });
  }
  const likeCount = await prisma.commentReaction.count({ where: { commentId: comment.id, type: 'LIKE' } });
  return { liked: !existing, likeCount };
}

/**
 * The author may delete their own comment; community moderators and
 * platform moderators may remove anyone's (recorded as a ModerationAction).
 * Deletion is soft: the row stays as a tombstone if it has replies, and its
 * media stops being served.
 */
export async function deleteComment(user: { id: string; role?: string }, commentId: string, reason?: string) {
  const { comment, discussion } = await loadCommentForAction(commentId);
  const isAuthor = comment.authorId === user.id;
  const isModerator = !isAuthor && (await canModerateComment(user.id, user.role, discussion.community?.id ?? null));
  if (!isAuthor && !isModerator) throw new CommentError('You can only delete your own comments', 403);

  await prisma.$transaction(async (tx) => {
    await tx.discussionComment.update({ where: { id: comment.id }, data: { deletedAt: new Date() } });
    const replyCount = await tx.discussionComment.count({ where: { discussionId: discussion.id, deletedAt: null } });
    await tx.discussion.update({ where: { id: discussion.id }, data: { replyCount } });
    if (isModerator) {
      await tx.moderationAction.create({
        data: {
          moderatorId: user.id,
          targetUserId: comment.authorId,
          communityId: discussion.community?.id ?? null,
          targetType: 'COMMENT',
          targetId: comment.id,
          action: 'DELETE',
          reason: reason?.slice(0, 500) || null,
        },
      });
    }
  });

  return { deleted: true, byModerator: isModerator };
}
