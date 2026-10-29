/**
 * Control center API handlers for the editorial sections (2026-10-28):
 * anime form, lookups, charts, daily picks, news, articles, collections.
 * Mounted by thin route files under src/app/api/control/**.
 */
import { prisma } from '@/lib/prisma';
import { body, guarded } from '@control/lib/http';
import { getAnimeForm, getFormOptions, saveAnimeForm, searchStudios } from '@control/lib/animeForm';
import { createChart, deleteChart, getChart, listCharts, setChartEntries, updateChart, CHOICE_SLUG } from '@control/lib/charts';
import { clearDailyPick, listDailyPicks, setDailyPick, todayUtc } from '@control/lib/dailyPicks';
import {
  deleteArticle,
  deleteCollection,
  deleteNews,
  getArticleForm,
  getCollectionForm,
  getNewsForm,
  listOwnArticles,
  listOwnCollections,
  listOwnNews,
  saveArticle,
  saveCollection,
  saveNews,
  NEWS_CATEGORIES,
} from '@control/lib/editorial';
import { ControlEditError } from '@control/lib/editor';

function notFound(what: string): never {
  throw new ControlEditError(404, what + ' not found.');
}

// Lookups
/** GET /api/control/lookup?kind=anime|studios&q= */
export const lookupGET = guarded('/api/control/lookup', async (req) => {
  const kind = req.nextUrl.searchParams.get('kind');
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 80);
  if (kind === 'studios') return { results: await searchStudios(q) };
  if (!q) return { results: [] };
  const rows = await prisma.anime.findMany({
    where: {
      status: { not: 'MERGED' },
      isAdult: false,
      OR: [{ canonicalTitle: { contains: q, mode: 'insensitive' } }, { titles: { some: { title: { contains: q, mode: 'insensitive' } } } }],
    },
    orderBy: { members: { sort: 'desc', nulls: 'last' } },
    take: 12,
    select: { id: true, slug: true, canonicalTitle: true, posterUrl: true, type: true, year: true },
  });
  return { results: rows.map((r) => ({ id: r.id, slug: r.slug, title: r.canonicalTitle, posterUrl: r.posterUrl, type: r.type, year: r.year })) };
});

// Anime form
export const animeFormOptionsGET = guarded('/api/control/anime-form', async () => getFormOptions());
export const animeFormCreatePOST = guarded('/api/control/anime-form POST', async (req, auth) => saveAnimeForm(null, await body(req), auth.id));
export const animeFormGET = guarded('/api/control/anime-form/[id]', async (_req, _auth, { params }) => (await getAnimeForm(params.id)) ?? notFound('Anime'));
export const animeFormPUT = guarded('/api/control/anime-form/[id] PUT', async (req, auth, { params }) => saveAnimeForm(params.id, await body(req), auth.id));

// Charts
export const chartsGET = guarded('/api/control/charts', async () => ({ charts: await listCharts(), choiceSlug: CHOICE_SLUG }));
export const chartsPOST = guarded('/api/control/charts POST', async (req, auth) => createChart(await body(req), auth.id));
export const chartGET = guarded('/api/control/charts/[id]', async (_req, _auth, { params }) => (await getChart(params.id)) ?? notFound('Chart'));
export const chartPATCH = guarded('/api/control/charts/[id] PATCH', async (req, _auth, { params }) => updateChart(params.id, await body(req)));
export const chartDELETE = guarded('/api/control/charts/[id] DELETE', async (_req, _auth, { params }) => deleteChart(params.id));
export const chartEntriesPUT = guarded('/api/control/charts/[id]/entries', async (req, _auth, { params }) => setChartEntries(params.id, (await body(req)).entries));

// Daily OTAKUVA Choice
export const picksGET = guarded('/api/control/picks', async (req) => ({
  today: todayUtc(),
  picks: await listDailyPicks(req.nextUrl.searchParams.get('from') || todayUtc(), 42),
}));
export const pickPUT = guarded('/api/control/picks/[day]', async (req, auth, { params }) => setDailyPick(params.day, await body(req), auth.id));
export const pickDELETE = guarded('/api/control/picks/[day] DELETE', async (_req, _auth, { params }) => clearDailyPick(params.day));

// News
export const newsGET = guarded('/api/control/news', async (req) => ({
  ...(await listOwnNews(req.nextUrl.searchParams.get('q') || '', Number(req.nextUrl.searchParams.get('page')) || 1)),
  categories: NEWS_CATEGORIES,
}));
export const newsPOST = guarded('/api/control/news POST', async (req, auth) => saveNews(null, await body(req), auth.id));
export const newsItemGET = guarded('/api/control/news/[id]', async (_req, _auth, { params }) => (await getNewsForm(params.id)) ?? notFound('Story'));
export const newsItemPUT = guarded('/api/control/news/[id] PUT', async (req, auth, { params }) => saveNews(params.id, await body(req), auth.id));
export const newsItemDELETE = guarded('/api/control/news/[id] DELETE', async (_req, _auth, { params }) => deleteNews(params.id));

// Articles
export const articlesGET = guarded('/api/control/articles', async (_req, auth) => ({ articles: await listOwnArticles(auth.id) }));
export const articlesPOST = guarded('/api/control/articles POST', async (req, auth) => saveArticle(null, await body(req), auth.id));
export const articleGET = guarded('/api/control/articles/[id]', async (_req, auth, { params }) => (await getArticleForm(params.id, auth.id)) ?? notFound('Article'));
export const articlePUT = guarded('/api/control/articles/[id] PUT', async (req, auth, { params }) => saveArticle(params.id, await body(req), auth.id));
export const articleDELETE = guarded('/api/control/articles/[id] DELETE', async (_req, auth, { params }) => deleteArticle(params.id, auth.id));

// Collections
export const collectionsGET = guarded('/api/control/collections', async (_req, auth) => ({ collections: await listOwnCollections(auth.id) }));
export const collectionsPOST = guarded('/api/control/collections POST', async (req, auth) => saveCollection(null, await body(req), auth.id));
export const collectionGET = guarded('/api/control/collections/[id]', async (_req, auth, { params }) => (await getCollectionForm(params.id, auth.id)) ?? notFound('Collection'));
export const collectionPUT = guarded('/api/control/collections/[id] PUT', async (req, auth, { params }) => saveCollection(params.id, await body(req), auth.id));
export const collectionDELETE = guarded('/api/control/collections/[id] DELETE', async (_req, auth, { params }) => deleteCollection(params.id, auth.id));
