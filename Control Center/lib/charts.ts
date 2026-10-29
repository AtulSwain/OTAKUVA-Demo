/**
 * Owner-made charts (2026-10-28): "Top 10 …", "Top 100 …", any ranked list,
 * plus the OTAKUVA Choice list itself (slug `otakuva-choice`). Plain SQL —
 * the tables are newer than some running Prisma clients. Order = rank.
 */
import { prisma } from '@/lib/prisma';
import { ControlEditError } from './editor';

export const CHOICE_SLUG = 'otakuva-choice';
export const CHART_SIZES = [10, 25, 50, 100] as const;

export interface ChartSummary {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  size: number;
  isPublished: boolean;
  entries: number;
  updatedAt: string;
}

export interface ChartEntry {
  animeId: string;
  position: number;
  note: string | null;
  slug: string;
  title: string;
  posterUrl: string | null;
  type: string | null;
  year: number | null;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);

export async function listCharts(): Promise<ChartSummary[]> {
  const rows = await prisma.$queryRaw<{ id: string; slug: string; title: string; description: string | null; size: number; isPublished: boolean; entries: bigint; updatedAt: Date }[]>`
    SELECT c.id, c.slug, c.title, c.description, c.size, c."isPublished", c."updatedAt",
           (SELECT COUNT(*) FROM "CuratedChartEntry" e WHERE e."chartId" = c.id) AS entries
    FROM "CuratedChart" c
    ORDER BY (c.slug = ${CHOICE_SLUG}) DESC, c."updatedAt" DESC`;
  return rows.map((r) => ({ ...r, entries: Number(r.entries), updatedAt: r.updatedAt.toISOString() }));
}

export async function getChart(idOrSlug: string): Promise<(ChartSummary & { items: ChartEntry[] }) | null> {
  const [c] = await prisma.$queryRaw<{ id: string; slug: string; title: string; description: string | null; size: number; isPublished: boolean; updatedAt: Date }[]>`
    SELECT id, slug, title, description, size, "isPublished", "updatedAt" FROM "CuratedChart" WHERE id = ${idOrSlug} OR slug = ${idOrSlug} LIMIT 1`;
  if (!c) return null;
  const items = await prisma.$queryRaw<ChartEntry[]>`
    SELECT e."animeId", e.position, e.note, a.slug, a."canonicalTitle" AS title, a."posterUrl", a.type, COALESCE(a.year, a."startYear") AS year
    FROM "CuratedChartEntry" e JOIN "Anime" a ON a.id = e."animeId"
    WHERE e."chartId" = ${c.id}
    ORDER BY e.position ASC`;
  return { ...c, entries: items.length, updatedAt: c.updatedAt.toISOString(), items };
}

function cleanChartInput(input: { title?: unknown; description?: unknown; size?: unknown; slug?: unknown }) {
  const title = typeof input.title === 'string' ? input.title.replace(/\s+/g, ' ').trim() : '';
  if (title.length < 2 || title.length > 100) throw new ControlEditError(400, 'Title must be 2–100 characters.');
  const description = typeof input.description === 'string' ? input.description.trim().slice(0, 600) || null : null;
  const size = Number(input.size) || 10;
  if (!(CHART_SIZES as readonly number[]).includes(size)) throw new ControlEditError(400, 'Size must be 10, 25, 50 or 100.');
  const slug = slugify(typeof input.slug === 'string' && input.slug.trim() ? input.slug : title);
  if (!slug) throw new ControlEditError(400, 'Choose a title with letters or numbers.');
  return { title, description, size, slug };
}

export async function createChart(input: { title?: unknown; description?: unknown; size?: unknown; slug?: unknown }, actorId: string) {
  const c = cleanChartInput(input);
  const taken = await prisma.$queryRaw<{ id: string }[]>`SELECT id FROM "CuratedChart" WHERE slug = ${c.slug}`;
  if (taken.length) throw new ControlEditError(409, 'A chart with that link already exists — change the title or link.');
  const [row] = await prisma.$queryRaw<{ id: string }[]>`
    INSERT INTO "CuratedChart" (id, slug, title, description, size, "isPublished", "createdById", "createdAt", "updatedAt")
    VALUES (gen_random_uuid()::text, ${c.slug}, ${c.title}, ${c.description}, ${c.size}, false, ${actorId}, NOW(), NOW())
    RETURNING id`;
  return { id: row.id, slug: c.slug };
}

export async function updateChart(id: string, input: { title?: unknown; description?: unknown; size?: unknown; isPublished?: unknown }) {
  const current = await getChart(id);
  if (!current) throw new ControlEditError(404, 'Chart not found.');
  const c = cleanChartInput({
    title: input.title ?? current.title,
    description: input.description === undefined ? current.description : input.description,
    size: input.size ?? current.size,
    slug: current.slug,
  });
  const publish = typeof input.isPublished === 'boolean' ? input.isPublished : current.isPublished;
  if (publish && current.items.length === 0) throw new ControlEditError(400, 'Add at least one anime before publishing.');
  if (c.size < current.items.length) throw new ControlEditError(400, `This chart has ${current.items.length} anime — remove some before making it a Top ${c.size}.`);
  await prisma.$executeRaw`
    UPDATE "CuratedChart" SET title = ${c.title}, description = ${c.description}, size = ${c.size}, "isPublished" = ${publish}, "updatedAt" = NOW()
    WHERE id = ${current.id}`;
  return getChart(current.id);
}

export async function deleteChart(id: string) {
  const n = await prisma.$executeRaw`DELETE FROM "CuratedChart" WHERE id = ${id}`;
  if (!n) throw new ControlEditError(404, 'Chart not found.');
}

/** Replaces the chart's ranking with `entries` in this order (position 1…n). */
export async function setChartEntries(id: string, entries: unknown) {
  const chart = await getChart(id);
  if (!chart) throw new ControlEditError(404, 'Chart not found.');
  if (!Array.isArray(entries)) throw new ControlEditError(400, 'Send the list of anime.');
  const clean: { animeId: string; note: string | null }[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const animeId = typeof e?.animeId === 'string' ? e.animeId : '';
    if (!animeId || seen.has(animeId)) continue;
    seen.add(animeId);
    clean.push({ animeId, note: typeof e?.note === 'string' ? e.note.trim().slice(0, 280) || null : null });
  }
  if (clean.length > chart.size) throw new ControlEditError(400, `A Top ${chart.size} holds at most ${chart.size} anime.`);
  if (clean.length) {
    const found = await prisma.anime.count({ where: { id: { in: clean.map((c) => c.animeId) } } });
    if (found !== clean.length) throw new ControlEditError(400, 'One of those anime no longer exists.');
  }
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`DELETE FROM "CuratedChartEntry" WHERE "chartId" = ${chart.id}`;
    for (let i = 0; i < clean.length; i++) {
      await tx.$executeRaw`
        INSERT INTO "CuratedChartEntry" (id, "chartId", "animeId", position, note, "createdAt")
        VALUES (gen_random_uuid()::text, ${chart.id}, ${clean[i].animeId}, ${i + 1}, ${clean[i].note}, NOW())`;
    }
    await tx.$executeRaw`UPDATE "CuratedChart" SET "updatedAt" = NOW() WHERE id = ${chart.id}`;
  });
  return getChart(chart.id);
}

/** A published chart for the public site, or null. */
export async function getPublishedChart(slug: string) {
  const chart = await getChart(slug);
  return chart && chart.isPublished ? chart : null;
}

export async function listPublishedCharts(): Promise<ChartSummary[]> {
  return (await listCharts()).filter((c) => c.isPublished && c.entries > 0);
}

/** The OTAKUVA Choice ranking when the owner has published one (anime ids + notes in order), else null. */
export async function getPublishedChoice(): Promise<{ animeId: string; note: string | null }[] | null> {
  try {
    const chart = await getPublishedChart(CHOICE_SLUG);
    return chart && chart.items.length ? chart.items.map((i) => ({ animeId: i.animeId, note: i.note })) : null;
  } catch {
    return null; // table missing on an old database: keep the hand-edited list
  }
}
