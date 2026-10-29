import { prisma } from '../prisma';
import { getEpisodeReleaseState } from '../rating/episodeRatings';

/**
 * Per-episode "watched" ticks by episode number (2026-10-21) for anime with
 * no Episode rows — before this, ticking episode 5 there meant "watched up to
 * 5" and ticked 1–4 too. Each tick is now its own row (UserEpisodeWatch), and
 * the library's `episodesWatched` is kept equal to how many are ticked.
 *
 * Members who already had a "watched up to N" count get it carried over as
 * ticks 1…N (capped at what has aired) the first time they tick anything, so
 * nobody loses progress.
 */
export class EpisodeWatchError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function resolveAnime(idOrSlug: string) {
  const anime = await prisma.anime.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true },
  });
  if (!anime) throw new EpisodeWatchError('Anime not found', 404);
  return anime.id;
}

export async function getWatchedEpisodes(userId: string, animeIdOrSlug: string): Promise<number[]> {
  const animeId = await resolveAnime(animeIdOrSlug);
  const rows = await prisma.userEpisodeWatch.findMany({
    where: { userId, animeId },
    select: { episodeNumber: true },
    orderBy: { episodeNumber: 'asc' },
  });
  if (rows.length > 0) return rows.map((r) => r.episodeNumber);
  // Not ticked anything yet: show the old "watched up to N" count as ticks.
  const lib = await prisma.userAnime.findUnique({ where: { userId_animeId: { userId, animeId } }, select: { episodesWatched: true } });
  return Array.from({ length: lib?.episodesWatched ?? 0 }, (_, i) => i + 1);
}

export async function setEpisodeWatched(userId: string, animeIdOrSlug: string, episodeNumber: unknown, watched: unknown) {
  if (typeof watched !== 'boolean') throw new EpisodeWatchError('watched must be true or false.', 400);
  const n = Number(episodeNumber);
  if (!Number.isInteger(n) || n < 1) throw new EpisodeWatchError('Pick a valid episode.', 400);
  const animeId = await resolveAnime(animeIdOrSlug);
  const state = await getEpisodeReleaseState(animeId);
  if (watched && n > state.released) throw new EpisodeWatchError("That episode hasn't aired yet.", 409);

  const result = await prisma.$transaction(async (tx) => {
    // One member's ticks on one anime are applied one at a time, so two quick
    // taps (episode 1, then 2) can't each count the other out.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`episode-watch:${userId}:${animeId}`}))`;
    const lib = await tx.userAnime.findUnique({ where: { userId_animeId: { userId, animeId } } });
    const existing = await tx.userEpisodeWatch.count({ where: { userId, animeId } });
    // First tick: carry an old "watched up to N" count over as ticks 1…N.
    if (existing === 0 && lib && lib.episodesWatched > 0) {
      const upTo = Math.min(lib.episodesWatched, Math.max(state.released, 0));
      if (upTo > 0) {
        await tx.userEpisodeWatch.createMany({
          data: Array.from({ length: upTo }, (_, i) => ({ userId, animeId, episodeNumber: i + 1 })),
          skipDuplicates: true,
        });
      }
    }

    if (watched) {
      await tx.userEpisodeWatch.upsert({
        where: { userId_animeId_episodeNumber: { userId, animeId, episodeNumber: n } },
        create: { userId, animeId, episodeNumber: n },
        update: {},
      });
    } else {
      await tx.userEpisodeWatch.deleteMany({ where: { userId, animeId, episodeNumber: n } });
    }

    const rows = await tx.userEpisodeWatch.findMany({
      where: { userId, animeId },
      select: { episodeNumber: true },
      orderBy: { episodeNumber: 'asc' },
    });
    const count = rows.length;
    // Same status rules as the Episode Guide's progress counter.
    const total = state.total ?? null;
    const status =
      total && count >= total
        ? 'COMPLETED'
        : !lib || lib.status === 'PLAN_TO_WATCH' || lib.status === 'COMPLETED'
        ? count > 0
          ? 'WATCHING'
          : lib?.status ?? 'WATCHING'
        : lib.status;
    // Ticking an episode never adds the anime to the library (owner,
    // 2026-10-26: "let the user decide"). Only an existing entry is updated.
    if (!lib) return { numbers: rows.map((r) => r.episodeNumber), status: null, episodesWatched: count, inLibrary: false };
    const saved = await tx.userAnime.update({
      where: { userId_animeId: { userId, animeId } },
      data: { status, episodesWatched: count },
      select: { status: true, episodesWatched: true },
    });
    return { numbers: rows.map((r) => r.episodeNumber), status: saved.status, episodesWatched: saved.episodesWatched, inLibrary: true };
  });
  return result;
}
