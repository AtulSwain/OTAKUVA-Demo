/**
 * Compact relative time for feeds and comments: "now", "5m", "2h", "3d",
 * then a short date. Pass `suffix` for "2h ago" style.
 */
export function relativeTime(iso: string | Date, now: number = Date.now(), suffix = false): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.floor((now - then) / 60000);
  const tail = suffix ? ' ago' : '';
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m${tail}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h${tail}`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d${tail}`;
  const d = new Date(then);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}
