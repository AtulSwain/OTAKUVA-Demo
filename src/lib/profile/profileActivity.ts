/**
 * A member's real activity, read straight from the tables where each action
 * lives (2026-10-20) — not only the generic Activity log, which most features
 * never wrote to. Covers everything a member can do: rate, review, reply,
 * rate an episode's retention, hype an upcoming show, track (library), favourite,
 * write articles, comment, start discussions, make lists, join communities,
 * follow people.
 *
 * Privacy: the owner sees everything. Visitors see public actions only —
 * library changes, favourites, hype votes and episode retention stay
 * owner-only; private-community discussions follow readableDiscussionsFilter;
 * only PUBLIC lists and non-private communities are shown.
 */
import { prisma } from '../prisma';
import { getAnimeDisplayTitle } from '../animeTitleResolver';
import { readableDiscussionsFilter } from '../engine/community/communityEngine';
import { HYPE_LEVEL_INFO, RETIRED_HYPE_LABELS, isHypeLevel, isRetiredHypeLevel } from '../hype/hypeLevels';

export const PROFILE_ACTIVITY_KINDS = [
  'RATED',
  'REVIEWED',
  'REVIEW_REPLY',
  'RETENTION',
  'HYPE',
  'LIBRARY',
  'FAVORITE',
  'ARTICLE',
  'ARTICLE_COMMENT',
  'DISCUSSION',
  'DISCUSSION_COMMENT',
  'LIST',
  'COMMUNITY',
  'FOLLOW',
] as const;
export type ProfileActivityKind = (typeof PROFILE_ACTIVITY_KINDS)[number];

/** Owner-only kinds (never shown to visitors). */
const PRIVATE_KINDS: ReadonlySet<ProfileActivityKind> = new Set(['RETENTION', 'HYPE', 'LIBRARY', 'FAVORITE']);

export interface ProfileActivityItem {
  id: string;
  kind: ProfileActivityKind;
  at: string;
  anime: { id: string; slug: string; title: string; posterUrl: string | null } | null;
  /** What it's about when it isn't an anime (article, list, community, person…). */
  title: string | null;
  href: string | null;
  /** The number or word that matters: score, retention %, hype level, status. */
  value: string | number | null;
  /** A short excerpt of what was written (reviews, comments). */
  excerpt: string | null;
  /** Only the owner can see this one. */
  private: boolean;
}

const ANIME_SELECT = { id: true, slug: true, canonicalTitle: true, posterUrl: true } as const;
type AnimeRow = { id: string; slug: string; canonicalTitle: string; posterUrl: string | null };
const anime = (a: AnimeRow | null | undefined) =>
  a ? { id: a.id, slug: a.slug, title: getAnimeDisplayTitle(a), posterUrl: a.posterUrl || null } : null;
const excerpt = (s: string | null | undefined, n = 160) => {
  if (!s) return null;
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
const LIBRARY_LABEL: Record<string, string> = {
  WATCHING: 'Watching',
  COMPLETED: 'Completed',
  PLAN_TO_WATCH: 'Plan to watch',
  ON_HOLD: 'On hold',
  DROPPED: 'Dropped',
};

interface Options {
  /** The profile owner is looking. */
  isOwner: boolean;
  /** Who is looking (for private-community discussions). */
  viewerId: string | null;
  /** Only items strictly before this time (cursor). */
  before?: Date | null;
  limit?: number;
  /** Only these kinds. */
  kinds?: ProfileActivityKind[] | null;
}

function wants(kind: ProfileActivityKind, o: Options) {
  if (!o.isOwner && PRIVATE_KINDS.has(kind)) return false;
  return !o.kinds || o.kinds.length === 0 || o.kinds.includes(kind);
}

/** One page of a member's activity, newest first, plus the cursor for the next page. */
export async function getProfileActivity(userId: string, o: Options) {
  const limit = Math.min(60, Math.max(1, o.limit ?? 30));
  const t = (field: string) => (o.before ? { [field]: { lt: o.before } } : {});
  const discussionFilter = readableDiscussionsFilter(o.viewerId);
  const jobs: Promise<ProfileActivityItem[]>[] = [];

  if (wants('RATED', o)) {
    jobs.push(
      prisma.animeRating
        .findMany({ where: { userId, deletedAt: null, ...t('updatedAt') }, orderBy: { updatedAt: 'desc' }, take: limit, select: { id: true, rating: true, updatedAt: true, anime: { select: ANIME_SELECT } } })
        .then((rows) => rows.map((r) => ({ id: `RATED:${r.id}`, kind: 'RATED' as const, at: r.updatedAt.toISOString(), anime: anime(r.anime), title: null, href: `/anime/${r.anime.slug}`, value: r.rating, excerpt: null, private: false })))
    );
  }
  if (wants('REVIEWED', o)) {
    jobs.push(
      prisma.review
        .findMany({ where: { userId, deletedAt: null, status: 'PUBLISHED', ...t('createdAt') }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, body: true, spoilerLevel: true, createdAt: true, anime: { select: ANIME_SELECT } } })
        .then((rows) =>
          rows.map((r) => ({
            id: `REVIEWED:${r.id}`,
            kind: 'REVIEWED' as const,
            at: r.createdAt.toISOString(),
            anime: anime(r.anime),
            title: null,
            href: `/anime/${r.anime.slug}#review-${r.id}`,
            value: null,
            // Never show spoiler text in a feed.
            excerpt: r.spoilerLevel && r.spoilerLevel !== 'SPOILER_FREE' ? 'Contains spoilers' : excerpt(r.body),
            private: false,
          }))
        )
    );
  }
  if (wants('REVIEW_REPLY', o)) {
    jobs.push(
      prisma.reviewReply
        .findMany({ where: { userId, deletedAt: null, status: 'PUBLISHED', ...t('createdAt') }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, body: true, createdAt: true, review: { select: { id: true, anime: { select: ANIME_SELECT } } } } })
        .then((rows) => rows.map((r) => ({ id: `REVIEW_REPLY:${r.id}`, kind: 'REVIEW_REPLY' as const, at: r.createdAt.toISOString(), anime: anime(r.review.anime), title: null, href: `/anime/${r.review.anime.slug}#review-${r.review.id}`, value: null, excerpt: excerpt(r.body), private: false })))
    );
  }
  if (wants('RETENTION', o)) {
    jobs.push(
      prisma.episodeRating
        .findMany({ where: { userId, retention: { not: null }, animeId: { not: null }, ...t('updatedAt') }, orderBy: { updatedAt: 'desc' }, take: limit, select: { id: true, retention: true, episodeNumber: true, updatedAt: true, anime: { select: ANIME_SELECT } } })
        .then((rows) =>
          rows.filter((r) => r.anime).map((r) => ({ id: `RETENTION:${r.id}`, kind: 'RETENTION' as const, at: r.updatedAt.toISOString(), anime: anime(r.anime), title: r.episodeNumber ? `Episode ${r.episodeNumber}` : null, href: `/anime/${r.anime!.slug}`, value: r.retention, excerpt: null, private: true }))
        )
    );
  }
  if (wants('HYPE', o)) {
    jobs.push(
      prisma.animeHype
        .findMany({ where: { userId, ...t('updatedAt') }, orderBy: { updatedAt: 'desc' }, take: limit, select: { id: true, level: true, updatedAt: true, anime: { select: ANIME_SELECT } } })
        .then((rows) => rows.map((r) => ({ id: `HYPE:${r.id}`, kind: 'HYPE' as const, at: r.updatedAt.toISOString(), anime: anime(r.anime), title: null, href: `/anime/${r.anime.slug}`, value: isHypeLevel(r.level) ? HYPE_LEVEL_INFO[r.level].label : isRetiredHypeLevel(r.level) ? RETIRED_HYPE_LABELS[r.level] : r.level, excerpt: null, private: true })))
    );
  }
  if (wants('LIBRARY', o)) {
    jobs.push(
      prisma.activity
        .findMany({ where: { userId, type: 'STATUS_CHANGED', animeId: { not: null }, ...t('createdAt') }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, animeId: true, metadata: true, createdAt: true } })
        .then(async (rows) => {
          const ids = Array.from(new Set(rows.map((r) => r.animeId!)));
          const animes = ids.length ? await prisma.anime.findMany({ where: { id: { in: ids } }, select: ANIME_SELECT }) : [];
          const map = new Map(animes.map((a) => [a.id, a]));
          return rows
            .filter((r) => map.has(r.animeId!))
            .map((r) => {
              let status = '';
              try {
                status = String(JSON.parse(r.metadata || '{}').status || '');
              } catch {
                /* unreadable metadata: no label */
              }
              const a = map.get(r.animeId!)!;
              return { id: `LIBRARY:${r.id}`, kind: 'LIBRARY' as const, at: r.createdAt.toISOString(), anime: anime(a), title: null, href: `/anime/${a.slug}`, value: LIBRARY_LABEL[status.toUpperCase()] ?? (status || null), excerpt: null, private: true };
            });
        })
    );
  }
  if (wants('FAVORITE', o)) {
    jobs.push(
      prisma.favorite
        .findMany({ where: { userId, ...t('createdAt') }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, createdAt: true, anime: { select: ANIME_SELECT } } })
        .then((rows) => rows.map((r) => ({ id: `FAVORITE:${r.id}`, kind: 'FAVORITE' as const, at: r.createdAt.toISOString(), anime: anime(r.anime), title: null, href: `/anime/${r.anime.slug}`, value: null, excerpt: null, private: true })))
    );
  }
  if (wants('ARTICLE', o)) {
    jobs.push(
      prisma.userArticle
        .findMany({ where: { authorId: userId, status: 'PUBLISHED', deletedAt: null, ...t('createdAt') }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, slug: true, title: true, summary: true, createdAt: true } })
        .then((rows) => rows.map((r) => ({ id: `ARTICLE:${r.id}`, kind: 'ARTICLE' as const, at: r.createdAt.toISOString(), anime: null, title: r.title, href: `/articles/${r.slug}`, value: null, excerpt: excerpt(r.summary), private: false })))
    );
  }
  if (wants('ARTICLE_COMMENT', o)) {
    jobs.push(
      prisma.userArticleComment
        .findMany({ where: { userId, status: 'PUBLISHED', deletedAt: null, article: { status: 'PUBLISHED', deletedAt: null }, ...t('createdAt') }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, body: true, createdAt: true, article: { select: { slug: true, title: true } } } })
        .then((rows) => rows.map((r) => ({ id: `ARTICLE_COMMENT:${r.id}`, kind: 'ARTICLE_COMMENT' as const, at: r.createdAt.toISOString(), anime: null, title: r.article.title, href: `/articles/${r.article.slug}#comment-${r.id}`, value: null, excerpt: excerpt(r.body), private: false })))
    );
  }
  if (wants('DISCUSSION', o)) {
    jobs.push(
      prisma.discussion
        .findMany({ where: { authorId: userId, status: { not: 'HIDDEN' }, AND: [discussionFilter], ...t('createdAt') }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, title: true, body: true, createdAt: true } })
        .then((rows) => rows.map((r) => ({ id: `DISCUSSION:${r.id}`, kind: 'DISCUSSION' as const, at: r.createdAt.toISOString(), anime: null, title: r.title, href: `/discussions/${r.id}`, value: null, excerpt: excerpt(r.body), private: false })))
    );
  }
  if (wants('DISCUSSION_COMMENT', o)) {
    jobs.push(
      prisma.discussionComment
        .findMany({ where: { authorId: userId, deletedAt: null, discussion: { status: { not: 'HIDDEN' }, AND: [discussionFilter] }, ...t('createdAt') }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, body: true, createdAt: true, discussion: { select: { id: true, title: true } } } })
        .then((rows) => rows.map((r) => ({ id: `DISCUSSION_COMMENT:${r.id}`, kind: 'DISCUSSION_COMMENT' as const, at: r.createdAt.toISOString(), anime: null, title: r.discussion.title, href: `/discussions/${r.discussion.id}`, value: null, excerpt: excerpt(r.body), private: false })))
    );
  }
  if (wants('LIST', o)) {
    jobs.push(
      prisma.userList
        .findMany({ where: { userId, ...(o.isOwner ? {} : { visibility: 'PUBLIC' }), ...t('createdAt') }, orderBy: { createdAt: 'desc' }, take: limit, select: { id: true, name: true, visibility: true, createdAt: true, _count: { select: { items: true } } } })
        .then((rows) => rows.map((r) => ({ id: `LIST:${r.id}`, kind: 'LIST' as const, at: r.createdAt.toISOString(), anime: null, title: r.name, href: o.isOwner ? `/library/lists/${r.id}` : null, value: r._count.items, excerpt: null, private: r.visibility !== 'PUBLIC' })))
    );
  }
  if (wants('COMMUNITY', o)) {
    jobs.push(
      prisma.communityMember
        .findMany({ where: { userId, status: 'ACTIVE', community: { status: { not: 'DELETED' }, ...(o.isOwner ? {} : { visibility: { not: 'PRIVATE' } }) }, ...t('joinedAt') }, orderBy: { joinedAt: 'desc' }, take: limit, select: { id: true, role: true, joinedAt: true, community: { select: { name: true, slug: true, visibility: true } } } })
        .then((rows) => rows.map((r) => ({ id: `COMMUNITY:${r.id}`, kind: 'COMMUNITY' as const, at: r.joinedAt.toISOString(), anime: null, title: r.community.name, href: `/community/${r.community.slug}`, value: r.role === 'OWNER' ? 'Founded' : 'Joined', excerpt: null, private: r.community.visibility === 'PRIVATE' })))
    );
  }
  if (wants('FOLLOW', o)) {
    jobs.push(
      prisma.follow
        .findMany({ where: { followerId: userId, ...t('createdAt') }, orderBy: { createdAt: 'desc' }, take: limit, select: { createdAt: true, following: { select: { id: true, username: true } } } })
        .then((rows) => rows.map((r) => ({ id: `FOLLOW:${r.following.id}`, kind: 'FOLLOW' as const, at: r.createdAt.toISOString(), anime: null, title: `@${r.following.username}`, href: `/profile/${r.following.username}`, value: null, excerpt: null, private: false })))
    );
  }

  const merged = (await Promise.all(jobs)).flat().sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id.localeCompare(b.id)));
  const items = merged.slice(0, limit);
  return { items, nextCursor: merged.length > limit ? items[items.length - 1].at : null };
}

/**
 * Per-day counts (UTC) for the activity calendar and per-kind totals, from
 * the same sources and the same privacy rules as the feed.
 */
export async function getProfileActivityStats(userId: string, o: Pick<Options, 'isOwner' | 'viewerId'>, days = 372) {
  const since = new Date(Date.now() - days * 86_400_000);
  const discussionFilter = readableDiscussionsFilter(o.viewerId);
  const w = (k: ProfileActivityKind) => o.isOwner || !PRIVATE_KINDS.has(k);
  const CAP = 5000;
  const sources: Array<[ProfileActivityKind, Promise<Date[]>]> = [
    ['RATED', prisma.animeRating.findMany({ where: { userId, deletedAt: null, updatedAt: { gte: since } }, select: { updatedAt: true }, take: CAP }).then((r) => r.map((x) => x.updatedAt))],
    ['REVIEWED', prisma.review.findMany({ where: { userId, deletedAt: null, status: 'PUBLISHED', createdAt: { gte: since } }, select: { createdAt: true }, take: CAP }).then((r) => r.map((x) => x.createdAt))],
    ['REVIEW_REPLY', prisma.reviewReply.findMany({ where: { userId, deletedAt: null, status: 'PUBLISHED', createdAt: { gte: since } }, select: { createdAt: true }, take: CAP }).then((r) => r.map((x) => x.createdAt))],
    ['ARTICLE', prisma.userArticle.findMany({ where: { authorId: userId, status: 'PUBLISHED', deletedAt: null, createdAt: { gte: since } }, select: { createdAt: true }, take: CAP }).then((r) => r.map((x) => x.createdAt))],
    ['ARTICLE_COMMENT', prisma.userArticleComment.findMany({ where: { userId, status: 'PUBLISHED', deletedAt: null, createdAt: { gte: since } }, select: { createdAt: true }, take: CAP }).then((r) => r.map((x) => x.createdAt))],
    ['DISCUSSION', prisma.discussion.findMany({ where: { authorId: userId, status: { not: 'HIDDEN' }, AND: [discussionFilter], createdAt: { gte: since } }, select: { createdAt: true }, take: CAP }).then((r) => r.map((x) => x.createdAt))],
    ['DISCUSSION_COMMENT', prisma.discussionComment.findMany({ where: { authorId: userId, deletedAt: null, discussion: { AND: [discussionFilter] }, createdAt: { gte: since } }, select: { createdAt: true }, take: CAP }).then((r) => r.map((x) => x.createdAt))],
    ['LIST', prisma.userList.findMany({ where: { userId, ...(o.isOwner ? {} : { visibility: 'PUBLIC' }), createdAt: { gte: since } }, select: { createdAt: true }, take: CAP }).then((r) => r.map((x) => x.createdAt))],
    ['COMMUNITY', prisma.communityMember.findMany({ where: { userId, status: 'ACTIVE', ...(o.isOwner ? {} : { community: { visibility: { not: 'PRIVATE' } } }), joinedAt: { gte: since } }, select: { joinedAt: true }, take: CAP }).then((r) => r.map((x) => x.joinedAt))],
    ['FOLLOW', prisma.follow.findMany({ where: { followerId: userId, createdAt: { gte: since } }, select: { createdAt: true }, take: CAP }).then((r) => r.map((x) => x.createdAt))],
  ];
  if (w('RETENTION')) sources.push(['RETENTION', prisma.episodeRating.findMany({ where: { userId, retention: { not: null }, updatedAt: { gte: since } }, select: { updatedAt: true }, take: CAP }).then((r) => r.map((x) => x.updatedAt))]);
  if (w('HYPE')) sources.push(['HYPE', prisma.animeHype.findMany({ where: { userId, updatedAt: { gte: since } }, select: { updatedAt: true }, take: CAP }).then((r) => r.map((x) => x.updatedAt))]);
  if (w('LIBRARY')) sources.push(['LIBRARY', prisma.activity.findMany({ where: { userId, type: 'STATUS_CHANGED', createdAt: { gte: since } }, select: { createdAt: true }, take: CAP }).then((r) => r.map((x) => x.createdAt))]);
  if (w('FAVORITE')) sources.push(['FAVORITE', prisma.favorite.findMany({ where: { userId, createdAt: { gte: since } }, select: { createdAt: true }, take: CAP }).then((r) => r.map((x) => x.createdAt))]);

  const resolved = await Promise.all(sources.map(([, p]) => p));
  const perDay = new Map<string, number>();
  const totals: Partial<Record<ProfileActivityKind, number>> = {};
  sources.forEach(([kind], i) => {
    totals[kind] = resolved[i].length;
    for (const d of resolved[i]) {
      const key = d.toISOString().slice(0, 10);
      perDay.set(key, (perDay.get(key) ?? 0) + 1);
    }
  });
  return {
    days: Array.from(perDay.entries()).map(([date, count]) => ({ date, count })),
    /** Actions in the last year, per kind. */
    totals,
  };
}
