/**
 * Page views per page per day (2026-10-28), for the control center's
 * analytics. Counts only: no user id, IP or cookie is stored. Plain SQL
 * (the table is newer than some running Prisma clients).
 */
import { prisma } from '../prisma';

export const VIEW_KINDS = ['anime', 'news', 'article', 'collection', 'chart', 'studio', 'person'] as const;
export type ViewKind = (typeof VIEW_KINDS)[number];

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|monitor|curl|wget|python-requests/i;

export const isViewKind = (v: unknown): v is ViewKind => typeof v === 'string' && (VIEW_KINDS as readonly string[]).includes(v);
export const looksLikeBot = (ua: string | null) => !ua || BOT.test(ua);

export async function recordView(kind: ViewKind, entityId: string) {
  await prisma.$executeRaw`
    INSERT INTO "PageViewDaily" (kind, "entityId", day, views)
    VALUES (${kind}, ${entityId}, CURRENT_DATE, 1)
    ON CONFLICT (kind, "entityId", day) DO UPDATE SET views = "PageViewDaily".views + 1`;
}
