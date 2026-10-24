/**
 * Member-written articles (UserArticle): news tips and write-ups a user
 * shares about an anime. Community content, separate from provider-ingested
 * NewsArticle — listed in /articles, on the author's profile and on the
 * related anime's page (never in /news).
 *
 * Bodies are stored and rendered as plain text (paragraphs split on blank
 * lines); no HTML is ever accepted, so there's nothing to sanitise. Links
 * are restricted to http(s) and rendered rel="nofollow ugc noopener".
 */

import { getArticleSocialCounts } from './articleSocial';
import { randomBytes } from 'crypto';
import { prisma } from '../prisma';
import { notifyFollowersOfArticle } from '../social/followService';
import { getAnimeDisplayTitle } from '../animeTitleResolver';

export const ARTICLE_LIMITS = {
  titleMin: 8,
  titleMax: 140,
  summaryMax: 280,
  bodyMin: 80,
  bodyMax: 20000,
  linksMax: 5,
  linkLabelMax: 60,
  urlMax: 500,
} as const;

export interface ArticleLink {
  label: string;
  url: string;
}

export interface ArticleInput {
  title?: unknown;
  summary?: unknown;
  body?: unknown;
  links?: unknown;
  animeId?: unknown;
  coverAssetId?: unknown;
}

export type ValidatedArticle = {
  title: string;
  summary: string | null;
  body: string;
  links: ArticleLink[];
  animeId: string | null;
  coverAssetId: string | null;
};

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : '');

function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (u.username || u.password) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Returns the cleaned article or a user-facing error. */
export function validateArticleInput(input: ArticleInput): { ok: true; value: ValidatedArticle } | { ok: false; error: string } {
  const L = ARTICLE_LIMITS;
  const title = clean(input.title).replace(/\s+/g, ' ');
  if (title.length < L.titleMin || title.length > L.titleMax) {
    return { ok: false, error: `Title must be ${L.titleMin}–${L.titleMax} characters.` };
  }
  const summary = clean(input.summary).replace(/\s+/g, ' ');
  if (summary.length > L.summaryMax) return { ok: false, error: `Summary can be at most ${L.summaryMax} characters.` };
  const body = clean(input.body).replace(/\n{3,}/g, '\n\n');
  if (body.length < L.bodyMin) return { ok: false, error: `Write at least ${L.bodyMin} characters.` };
  if (body.length > L.bodyMax) return { ok: false, error: `Articles can be at most ${L.bodyMax.toLocaleString('en-US')} characters.` };

  const rawLinks = Array.isArray(input.links) ? input.links : [];
  if (rawLinks.length > L.linksMax) return { ok: false, error: `Add at most ${L.linksMax} links.` };
  const links: ArticleLink[] = [];
  for (const raw of rawLinks) {
    const urlText = clean((raw as any)?.url);
    if (!urlText) continue;
    if (urlText.length > L.urlMax) return { ok: false, error: 'One of the links is too long.' };
    const url = normalizeUrl(urlText);
    if (!url) return { ok: false, error: `"${urlText.slice(0, 60)}" isn't a valid http(s) link.` };
    const label = clean((raw as any)?.label).replace(/\s+/g, ' ').slice(0, L.linkLabelMax) || new URL(url).hostname.replace(/^www\./, '');
    links.push({ label, url });
  }

  const animeId = clean(input.animeId) || null;
  const coverAssetId = clean(input.coverAssetId) || null;
  return { ok: true, value: { title, summary: summary || null, body, links, animeId, coverAssetId } };
}

function slugify(title: string): string {
  const base = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/, '');
  return `${base || 'article'}-${randomBytes(3).toString('hex')}`;
}

export async function createArticle(authorId: string, value: ValidatedArticle) {
  let coverImageUrl: string | null = null;
  if (value.coverAssetId) {
    // Only an image this author uploaded for an article can be attached.
    const asset = await prisma.mediaAsset.findFirst({
      where: { id: value.coverAssetId, userId: authorId, type: 'ARTICLE_COVER' },
      select: { storedUrl: true, sourceUrl: true },
    });
    if (!asset) throw new ArticleError('That cover image could not be found. Upload it again.', 400);
    coverImageUrl = asset.storedUrl || asset.sourceUrl;
  }
  if (value.animeId) {
    const anime = await prisma.anime.findFirst({ where: { OR: [{ id: value.animeId }, { slug: value.animeId }] }, select: { id: true } });
    if (!anime) throw new ArticleError('The related anime could not be found.', 400);
    value.animeId = anime.id;
  }

  const article = await prisma.userArticle.create({
    data: {
      slug: slugify(value.title),
      authorId,
      title: value.title,
      summary: value.summary,
      body: value.body,
      coverImageUrl,
      coverAssetId: value.coverAssetId,
      links: value.links as unknown as object,
      animeId: value.animeId,
    },
    select: { id: true, slug: true, animeId: true },
  });

  // Shows up in the author's activity feed / heatmap like other contributions.
  await prisma.activity
    .create({
      data: {
        userId: authorId,
        type: 'ARTICLE_PUBLISHED',
        animeId: article.animeId,
        metadata: JSON.stringify({ articleId: article.id, slug: article.slug, title: value.title }),
      },
    })
    .catch(() => {});

  await notifyFollowersOfArticle(authorId, { slug: article.slug, title: value.title });

  return article;
}

export class ArticleError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

const AUTHOR_SELECT = { id: true, username: true, avatarUrl: true } as const;
const ANIME_SELECT = { id: true, slug: true, canonicalTitle: true, posterUrl: true, titles: true } as const;

type ArticleRow = Awaited<ReturnType<typeof fetchArticles>>[number];

async function fetchArticles(where: object, take: number, skip: number) {
  return prisma.userArticle.findMany({
    where: { status: 'PUBLISHED', deletedAt: null, ...where },
    orderBy: { createdAt: 'desc' },
    take,
    skip,
    include: { author: { select: AUTHOR_SELECT }, anime: { select: ANIME_SELECT } },
  });
}

function toDto(a: ArticleRow, { includeBody = false } = {}) {
  return {
    id: a.id,
    slug: a.slug,
    title: a.title,
    summary: a.summary ?? excerpt(a.body),
    body: includeBody ? a.body : undefined,
    coverImageUrl: a.coverImageUrl,
    links: (Array.isArray(a.links) ? a.links : []) as unknown as ArticleLink[],
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    readMinutes: Math.max(1, Math.round(a.body.split(/\s+/).filter(Boolean).length / 230)),
    author: { id: a.author.id, username: a.author.username, avatarUrl: a.author.avatarUrl },
    anime: a.anime
      ? { id: a.anime.id, slug: a.anime.slug, title: getAnimeDisplayTitle(a.anime as any), posterUrl: a.anime.posterUrl }
      : null,
  };
}

export type ArticleDto = ReturnType<typeof toDto>;

function excerpt(body: string): string {
  const text = body.replace(/\s+/g, ' ').trim();
  return text.length > 200 ? `${text.slice(0, 197).trimEnd()}…` : text;
}

export async function listArticles({ authorUsername, animeId, page = 1, limit = 18 }: { authorUsername?: string; animeId?: string; page?: number; limit?: number }) {
  const take = Math.min(50, Math.max(1, limit));
  const skip = (Math.max(1, page) - 1) * take;
  const where: Record<string, unknown> = {};
  if (authorUsername) where.author = { username: authorUsername };
  if (animeId) where.animeId = animeId;
  const [rows, total] = await Promise.all([
    fetchArticles(where, take, skip),
    prisma.userArticle.count({ where: { status: 'PUBLISHED', deletedAt: null, ...where } }),
  ]);
  const social = await getArticleSocialCounts(rows.map((r) => r.id));
  const articles = rows.map((r) => ({ ...toDto(r), likeCount: social.get(r.id)?.likeCount ?? 0, commentCount: social.get(r.id)?.commentCount ?? 0 }));
  return { articles, total, page: Math.max(1, page), hasMore: skip + rows.length < total };
}

export async function getArticleBySlug(slug: string) {
  const row = await prisma.userArticle.findFirst({
    where: { slug, status: 'PUBLISHED', deletedAt: null },
    include: { author: { select: AUTHOR_SELECT }, anime: { select: ANIME_SELECT } },
  });
  if (!row) return null;
  const social = (await getArticleSocialCounts([row.id])).get(row.id);
  return { ...toDto(row, { includeBody: true }), likeCount: social?.likeCount ?? 0, commentCount: social?.commentCount ?? 0 };
}

export async function countArticlesByUser(userId: string) {
  return prisma.userArticle.count({ where: { authorId: userId, status: 'PUBLISHED', deletedAt: null } });
}
