import { prisma } from '../prisma';

/**
 * Has this member marked episode `n` of this anime as watched? (2026-10-21,
 * owner: an episode's retention can only be given after marking it watched.)
 *
 * Counts every way a watch is recorded:
 * - a per-episode tick (UserEpisodeWatch — anime without Episode rows);
 * - per-episode progress on anime with Episode rows (UserEpisodeProgress,
 *   status COMPLETED);
 * - a legacy "watched up to N" library count, only while the member has no
 *   per-episode ticks yet for this anime (the same carry-over the Episode
 *   Guide shows, see episodeWatch.ts).
 */
export async function hasWatchedEpisode(userId: string, animeId: string, n: number): Promise<boolean> {
  const [tick, anyTicks, progress] = await Promise.all([
    prisma.userEpisodeWatch.findUnique({
      where: { userId_animeId_episodeNumber: { userId, animeId, episodeNumber: n } },
      select: { id: true },
    }),
    prisma.userEpisodeWatch.count({ where: { userId, animeId } }),
    prisma.userEpisodeProgress.findFirst({
      where: { userId, animeId, episodeNumber: n, status: 'COMPLETED' },
      select: { id: true },
    }),
  ]);
  if (tick || progress) return true;
  if (anyTicks > 0) return false;
  const lib = await prisma.userAnime.findUnique({
    where: { userId_animeId: { userId, animeId } },
    select: { episodesWatched: true },
  });
  return (lib?.episodesWatched ?? 0) >= n;
}
