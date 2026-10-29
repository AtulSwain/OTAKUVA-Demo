/**
 * Runtime from the provider's duration text ("90 mins", "24 min per ep",
 * "1 hr 47 min", "2 hr") — real data only; anything unreadable gives null
 * and nothing is shown.
 */
export function durationMinutes(duration: string | null | undefined): number | null {
  if (!duration) return null;
  const s = duration.toLowerCase();
  const h = s.match(/(\d+)\s*(?:h|hr|hrs|hour|hours)\b/);
  const m = s.match(/(\d+)\s*(?:m|min|mins|minute|minutes)\b/);
  const total = (h ? Number(h[1]) * 60 : 0) + (m ? Number(m[1]) : 0);
  return total > 0 ? total : null;
}

/** "1h 47m", "47m", "2h". */
export function formatRuntime(minutes: number | null): string | null {
  if (!minutes || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? (m > 0 ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export const isMovieType = (type: string | null | undefined) => typeof type === 'string' && /movie/i.test(type);
