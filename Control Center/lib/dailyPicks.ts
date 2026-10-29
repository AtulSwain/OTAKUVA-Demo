/**
 * The homepage's daily OTAKUVA Choice spotlight, chosen per (UTC) day in the
 * control center (2026-10-28). A day without a pick keeps the automatic
 * rotation through the OTAKUVA Choice list. Plain SQL (newer table).
 */
import { prisma } from '@/lib/prisma';
import { ControlEditError } from './editor';

export interface DailyPick {
  day: string; // YYYY-MM-DD
  animeId: string;
  slug: string;
  title: string;
  posterUrl: string | null;
  bannerUrl: string | null;
  headline: string | null;
  note: string | null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const todayUtc = () => new Date().toISOString().slice(0, 10);

export async function listDailyPicks(fromDay = todayUtc(), days = 30): Promise<DailyPick[]> {
  if (!DAY.test(fromDay)) throw new ControlEditError(400, 'Bad date.');
  const rows = await prisma.$queryRaw<(Omit<DailyPick, 'day'> & { day: Date })[]>`
    SELECT p.day, p."animeId", a.slug, a."canonicalTitle" AS title, a."posterUrl", a."bannerUrl", p.headline, p.note
    FROM "DailyPick" p JOIN "Anime" a ON a.id = p."animeId"
    WHERE p.day >= ${fromDay}::date AND p.day < ${fromDay}::date + ${days}::int
    ORDER BY p.day ASC`;
  return rows.map((r) => ({ ...r, day: new Date(r.day).toISOString().slice(0, 10) }));
}

export async function setDailyPick(day: unknown, input: { animeId?: unknown; headline?: unknown; note?: unknown }, actorId: string) {
  if (typeof day !== 'string' || !DAY.test(day)) throw new ControlEditError(400, 'Pick a date.');
  if (day < todayUtc()) throw new ControlEditError(400, "Past days can't be changed.");
  const animeId = typeof input.animeId === 'string' ? input.animeId : '';
  const anime = animeId ? await prisma.anime.findUnique({ where: { id: animeId }, select: { id: true, isAdult: true } }) : null;
  if (!anime) throw new ControlEditError(400, 'Choose an anime.');
  if (anime.isAdult) throw new ControlEditError(400, 'Adult titles cannot be featured.');
  const headline = typeof input.headline === 'string' ? input.headline.trim().slice(0, 120) || null : null;
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 600) || null : null;
  await prisma.$executeRaw`
    INSERT INTO "DailyPick" (id, day, "animeId", headline, note, "createdById", "createdAt")
    VALUES (gen_random_uuid()::text, ${day}::date, ${anime.id}, ${headline}, ${note}, ${actorId}, NOW())
    ON CONFLICT (day) DO UPDATE SET "animeId" = EXCLUDED."animeId", headline = EXCLUDED.headline, note = EXCLUDED.note,
      "createdById" = EXCLUDED."createdById", "createdAt" = NOW()`;
}

export async function clearDailyPick(day: unknown) {
  if (typeof day !== 'string' || !DAY.test(day)) throw new ControlEditError(400, 'Pick a date.');
  await prisma.$executeRaw`DELETE FROM "DailyPick" WHERE day = ${day}::date`;
}

/** Today's chosen pick for the homepage, or null (then the rotation is used). */
export async function getTodayPick(): Promise<DailyPick | null> {
  try {
    return (await listDailyPicks(todayUtc(), 1))[0] ?? null;
  } catch {
    return null;
  }
}
