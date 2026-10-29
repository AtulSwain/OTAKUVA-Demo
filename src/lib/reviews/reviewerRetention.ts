import { prisma } from '../prisma';

/**
 * Each reviewer's own retention for an anime: the average of the episode
 * ratings (1–100) they gave it, whole percent. Shown on their review as a
 * verdict pill ("Hooked", "Peaking"… — retentionTone.ts). Missing when they
 * rated no episodes. Keyed "userId|animeId".
 */
export async function getReviewerRetention(pairs: { userId: string; animeId: string }[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (pairs.length === 0) return out;
  const userIds = Array.from(new Set(pairs.map((p) => p.userId)));
  const animeIds = Array.from(new Set(pairs.map((p) => p.animeId)));
  const rows = await prisma.episodeRating.groupBy({
    by: ['userId', 'animeId'],
    where: { userId: { in: userIds }, animeId: { in: animeIds }, episodeNumber: { not: null }, retention: { gte: 1, lte: 100 } },
    _avg: { retention: true },
  });
  for (const r of rows) {
    if (r.animeId && r._avg.retention !== null) out.set(`${r.userId}|${r.animeId}`, Math.round(r._avg.retention));
  }
  return out;
}
