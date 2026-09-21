/** Number formatting shared by the badge surfaces. */

/**
 * "1.8k", "12.4k": compact from `from` upward, full digits below it.
 * Helpful votes compact from 1,000; member counts only from 10,000.
 */
export function formatCompact(n: number, from = 1000): string {
  if (!Number.isFinite(n)) return '0';
  if (Math.abs(n) < from) return Math.round(n).toLocaleString('en-US');
  if (Math.abs(n) >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  return `${trim(n / 1000)}k`;
}

function trim(x: number): string {
  return x.toFixed(1).replace(/\.0$/, '');
}

export const pluralize = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
