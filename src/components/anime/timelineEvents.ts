export interface TimelineEvent {
  year: string | number;
  title: string;
  description?: string;
  category?: 'premiere' | 'finale' | 'sequel' | 'movie';
  sortKey: number;
}

const TIMELINE_RELATIONS = ['Sequel', 'Prequel', 'Side story', 'Movie', 'Spin-off'];

// Never show more precision than the record holds: a YEAR-precision start
// date rendered as "Jan 1, 2020" would assert a day nobody recorded.
const formatDate = (value: string | Date, precision?: string | null) => {
  const d = new Date(value);
  if (precision === 'YEAR') return String(d.getUTCFullYear());
  if (precision === 'MONTH') return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};

/**
 * Milestones the catalog actually records: the anime's own air dates and
 * dated franchise relations. Nothing is inferred. This used to invent a
 * source serialisation two years before airing and a production-committee
 * green-light one year before, for every anime, under a "Verified" heading.
 */
export function buildTimelineEvents(anime: any, relations: any[] = []): TimelineEvent[] {
  const items: TimelineEvent[] = [];
  // The detail API exposes startDate/endDate; other payloads use airedFrom/airedTo.
  const start = anime?.startDate ?? anime?.airedFrom ?? null;
  const end = anime?.endDate ?? anime?.airedTo ?? null;
  const precision = anime?.datePrecision ?? null;

  if (start) {
    items.push({
      year: formatDate(start, precision),
      title: 'Premiere',
      category: 'premiere',
      sortKey: new Date(start).getTime(),
    });
  }

  if (end) {
    items.push({
      year: formatDate(end, precision),
      title: 'Final episode aired',
      description: typeof anime.episodes === 'number' ? `${anime.episodes} episodes` : undefined,
      category: 'finale',
      sortKey: new Date(end).getTime(),
    });
  }

  for (const rel of relations) {
    if (!rel || !TIMELINE_RELATIONS.includes(rel.relationType) || typeof rel.year !== 'number') continue;
    const relTitle = rel.title || rel.canonicalTitle || rel.name;
    if (!relTitle) continue;
    items.push({
      year: rel.year,
      title: `${rel.relationType}: ${relTitle}`,
      category: rel.relationType === 'Movie' || rel.type === 'Movie' ? 'movie' : 'sequel',
      sortKey: Date.UTC(rel.year, 0, 1),
    });
  }

  return items.sort((a, b) => a.sortKey - b.sortKey);
}
