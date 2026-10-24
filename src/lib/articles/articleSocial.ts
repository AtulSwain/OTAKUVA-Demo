import { prisma } from '../prisma';
import { logger } from '../logger';
import { hasMinRole } from '../roles';

/**
 * Likes and comments on member articles. Same rules as review replies
 * (src/lib/reviews/reviewSocial.ts): plain text, verified accounts only
 * (enforced in the routes), the author or a moderator can remove a comment,
 * and the article's author is notified of new comments.
 */
export const COMMENT_MAX_LENGTH = 2000;
const VISIBLE_COMMENT = { deletedAt: null, status: 'PUBLISHED' } as const;
const PUBLISHED_ARTICLE = { status: 'PUBLISHED', deletedAt: null } as const;

export class ArticleSocialError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

type Viewer = { id: string; role?: string; username?: string } | null;

async function publishedArticle(slug: string) {
  const a = await prisma.userArticle.findFirst({ where: { slug, ...PUBLISHED_ARTICLE }, select: { id: true, slug: true, authorId: true, title: true } });
  if (!a) throw new ArticleSocialError('Article not found', 404);
  return a;
}

/** Like or unlike; idempotent either way. */
export async function setArticleLike(slug: string, userId: string, like: boolean) {
  const article = await publishedArticle(slug);
  if (like) {
    await prisma.userArticleLike.upsert({
      where: { articleId_userId: { articleId: article.id, userId } },
      update: {},
      create: { articleId: article.id, userId },
    });
  } else {
    await prisma.userArticleLike.deleteMany({ where: { articleId: article.id, userId } });
  }
  const likeCount = await prisma.userArticleLike.count({ where: { articleId: article.id } });
  return { liked: like, likeCount };
}

export interface ArticleCommentItem {
  id: string;
  parentId: string | null;
  /** True for a removed comment kept only as a placeholder because it still has visible replies. */
  deleted: boolean;
  body: string;
  createdAt: string;
  user: { id: string; username: string; avatarUrl: string | null } | null;
  canDelete: boolean;
  likeCount: number;
  liked: boolean;
  replies: ArticleCommentItem[];
}

export type CommentSort = 'top' | 'newest' | 'oldest';

const COMMENT_SELECT = {
  id: true,
  parentId: true,
  body: true,
  status: true,
  deletedAt: true,
  createdAt: true,
  user: { select: { id: true, username: true, avatarUrl: true } },
  _count: { select: { likes: true } },
} as const;

type CommentRow = {
  id: string;
  parentId: string | null;
  body: string;
  status: string;
  deletedAt: Date | null;
  createdAt: Date;
  user: { id: string; username: string; avatarUrl: string | null };
  _count: { likes: number };
};

const isVisible = (c: { status: string; deletedAt: Date | null }) => c.status === 'PUBLISHED' && !c.deletedAt;

function toItem(c: CommentRow, viewer: Viewer, liked: Set<string>): ArticleCommentItem {
  const visible = isVisible(c);
  return {
    id: c.id,
    parentId: c.parentId,
    deleted: !visible,
    body: visible ? c.body : '',
    createdAt: c.createdAt.toISOString(),
    user: visible ? c.user : null,
    canDelete: visible && Boolean(viewer && (viewer.id === c.user.id || hasMinRole(viewer.role || '', 'MODERATOR'))),
    likeCount: c._count.likes,
    liked: liked.has(c.id),
    replies: [],
  };
}

/**
 * Comments as threads: top-level comments (sorted as asked) with their
 * replies oldest-first underneath. A removed top-level comment that still
 * has visible replies stays as a "removed" placeholder so the replies keep
 * their context; otherwise removed comments are left out entirely.
 */
export async function listArticleComments(slug: string, viewer: Viewer, sort: CommentSort = 'top') {
  const article = await publishedArticle(slug);
  const rows: CommentRow[] = await prisma.userArticleComment.findMany({
    where: { articleId: article.id },
    orderBy: { createdAt: 'asc' },
    take: 1000,
    select: COMMENT_SELECT,
  });
  const likedRows = viewer
    ? await prisma.userArticleCommentLike.findMany({
        where: { userId: viewer.id, commentId: { in: rows.map((r) => r.id) } },
        select: { commentId: true },
      })
    : [];
  const liked = new Set(likedRows.map((l) => l.commentId));

  const repliesByParent = new Map<string, ArticleCommentItem[]>();
  for (const r of rows) {
    if (!r.parentId || !isVisible(r)) continue;
    const list = repliesByParent.get(r.parentId) || [];
    list.push(toItem(r, viewer, liked));
    repliesByParent.set(r.parentId, list);
  }

  const threads: ArticleCommentItem[] = [];
  for (const r of rows) {
    if (r.parentId) continue;
    const replies = repliesByParent.get(r.id) || [];
    if (!isVisible(r) && replies.length === 0) continue;
    threads.push({ ...toItem(r, viewer, liked), replies });
  }

  const time = (c: ArticleCommentItem) => new Date(c.createdAt).getTime();
  if (sort === 'newest') threads.sort((a, b) => time(b) - time(a));
  else if (sort === 'top') {
    threads.sort((a, b) => b.likeCount + b.replies.length - (a.likeCount + a.replies.length) || time(b) - time(a));
  }
  return threads;
}

async function notify(userId: string, title: string, body: string, linkUrl: string, type: string) {
  try {
    await prisma.notification.create({
      data: { userId, type, title, body: body.length > 140 ? `${body.slice(0, 137)}…` : body, linkUrl },
    });
  } catch (err) {
    // A failed notification never fails the comment itself.
    logger.warn('article comment notification failed', { error: err instanceof Error ? err.message : String(err), userId, type });
  }
}

/**
 * Posts a comment, or a reply when `rawParentId` is given. Threads are one
 * level deep: replying to a reply attaches to that reply's parent.
 */
export async function createArticleComment(
  slug: string,
  author: { id: string; username: string; role?: string },
  rawBody: unknown,
  rawParentId?: unknown
) {
  const body = typeof rawBody === 'string' ? rawBody.trim() : '';
  if (!body) throw new ArticleSocialError('Comment cannot be empty', 400);
  if (body.length > COMMENT_MAX_LENGTH) throw new ArticleSocialError(`Comment cannot exceed ${COMMENT_MAX_LENGTH} characters`, 400);
  const article = await publishedArticle(slug);

  let parent: { id: string; userId: string } | null = null;
  if (rawParentId !== undefined && rawParentId !== null && rawParentId !== '') {
    if (typeof rawParentId !== 'string') throw new ArticleSocialError('Invalid reply target', 400);
    const target = await prisma.userArticleComment.findFirst({
      where: { id: rawParentId, articleId: article.id, ...VISIBLE_COMMENT },
      select: { id: true, userId: true, parentId: true },
    });
    if (!target) throw new ArticleSocialError('The comment you replied to is no longer available', 404);
    parent = target.parentId ? { id: target.parentId, userId: target.userId } : { id: target.id, userId: target.userId };
  }

  const created = await prisma.userArticleComment.create({
    data: { articleId: article.id, userId: author.id, body, parentId: parent?.id ?? null },
    select: COMMENT_SELECT,
  });
  const link = `/articles/${article.slug}#comment-${created.id}`;

  // The person replied to hears about the reply; the article's author hears
  // about every comment (once — not twice when they're also the one replied to).
  if (parent && parent.userId !== author.id) {
    await notify(parent.userId, `${author.username} replied to your comment`, body, link, 'ARTICLE_COMMENT_REPLY');
  }
  if (article.authorId !== author.id && article.authorId !== parent?.userId) {
    await notify(article.authorId, `${author.username} commented on your article`, body, link, 'ARTICLE_COMMENT');
  }
  return toItem(created, author, new Set());
}

/** Like or unlike a visible comment; idempotent either way. */
export async function setArticleCommentLike(slug: string, commentId: string, userId: string, like: boolean) {
  const article = await publishedArticle(slug);
  const comment = await prisma.userArticleComment.findFirst({
    where: { id: commentId, articleId: article.id, ...VISIBLE_COMMENT },
    select: { id: true },
  });
  if (!comment) throw new ArticleSocialError('Comment not found', 404);
  if (like) {
    await prisma.userArticleCommentLike.upsert({
      where: { commentId_userId: { commentId, userId } },
      update: {},
      create: { commentId, userId },
    });
  } else {
    await prisma.userArticleCommentLike.deleteMany({ where: { commentId, userId } });
  }
  const likeCount = await prisma.userArticleCommentLike.count({ where: { commentId } });
  return { liked: like, likeCount };
}

/** The comment's author deletes it; a moderator and above hides it. */
export async function removeArticleComment(commentId: string, viewer: { id: string; role?: string }) {
  const c = await prisma.userArticleComment.findFirst({ where: { id: commentId, ...VISIBLE_COMMENT }, select: { id: true, userId: true } });
  if (!c) throw new ArticleSocialError('Comment not found', 404);
  const isAuthor = c.userId === viewer.id;
  if (!isAuthor && !hasMinRole(viewer.role || '', 'MODERATOR')) {
    throw new ArticleSocialError('You can only delete your own comments', 403);
  }
  await prisma.userArticleComment.update({
    where: { id: commentId },
    data: isAuthor ? { deletedAt: new Date() } : { status: 'HIDDEN' },
  });
}

/** Like + visible-comment counts (and whether the viewer liked each) for a set of articles. */
export async function getArticleSocialCounts(articleIds: string[], viewerId?: string | null) {
  const map = new Map<string, { likeCount: number; commentCount: number; liked: boolean }>();
  if (articleIds.length === 0) return map;
  const [likes, comments, mine] = await Promise.all([
    prisma.userArticleLike.groupBy({ by: ['articleId'], where: { articleId: { in: articleIds } }, _count: { articleId: true } }),
    prisma.userArticleComment.groupBy({ by: ['articleId'], where: { articleId: { in: articleIds }, ...VISIBLE_COMMENT }, _count: { articleId: true } }),
    viewerId
      ? prisma.userArticleLike.findMany({ where: { articleId: { in: articleIds }, userId: viewerId }, select: { articleId: true } })
      : Promise.resolve([] as { articleId: string }[]),
  ]);
  for (const id of articleIds) map.set(id, { likeCount: 0, commentCount: 0, liked: false });
  for (const l of likes) map.get(l.articleId)!.likeCount = l._count.articleId;
  for (const c of comments) map.get(c.articleId)!.commentCount = c._count.articleId;
  for (const m of mine) map.get(m.articleId)!.liked = true;
  return map;
}
