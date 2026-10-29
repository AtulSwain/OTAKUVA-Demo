/**
 * Streaming platform art for "Where to Watch" (2026-10-26): the official
 * icon + brand colour AniList publishes per streaming site, stored once per
 * site in StreamingPlatform. Upsert by site name; a provider failure writes
 * nothing. Read/written with plain SQL so it works on a server whose Prisma
 * client predates the table (same approach as AnimeVibe).
 */
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { prisma } from '../prisma';
import { anilistProvider } from '../providers/anilistProvider';

export interface PlatformArt {
  iconUrl: string | null;
  color: string | null;
}

/** Public folder the icons are saved to, and the URL path they're served from. */
const ICON_DIR = path.join(process.cwd(), 'public', 'brand', 'streaming', 'sites');
const ICON_URL = '/brand/streaming/sites';

/**
 * Save the icon on our own server so the page never hotlinks AniList's CDN
 * (several icons at once could fail to load). Returns the local path, or the
 * original URL if the download fails.
 */
async function localIcon(siteId: number, remote: string | null): Promise<string | null> {
  if (!remote) return null;
  try {
    const res = await fetch(remote, { signal: AbortSignal.timeout(15000) });
    const type = res.headers.get('content-type') || '';
    if (!res.ok || !type.startsWith('image/')) return remote;
    const ext = type.includes('svg') ? 'svg' : type.includes('jpeg') ? 'jpg' : type.includes('webp') ? 'webp' : 'png';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 512 * 1024) return remote;
    await mkdir(ICON_DIR, { recursive: true });
    const file = `${siteId}.${ext}`;
    await writeFile(path.join(ICON_DIR, file), buf);
    return `${ICON_URL}/${file}`;
  } catch {
    return remote;
  }
}

export async function syncStreamingPlatforms({ apply = true }: { apply?: boolean } = {}) {
  const sources = await anilistProvider.getStreamingSources();
  if (!apply) return { found: sources.length, written: 0 };
  let written = 0;
  for (const src of sources) {
    const s = { ...src, icon: await localIcon(src.id, src.icon) };
    await prisma.$executeRaw`
      INSERT INTO "StreamingPlatform" ("id", "site", "anilistSiteId", "iconUrl", "color", "source", "fetchedAt")
      VALUES (gen_random_uuid()::text, ${s.site}, ${s.id}, ${s.icon}, ${s.color}, 'anilist', NOW())
      ON CONFLICT ("site") DO UPDATE SET
        "anilistSiteId" = EXCLUDED."anilistSiteId",
        "iconUrl" = COALESCE(EXCLUDED."iconUrl", "StreamingPlatform"."iconUrl"),
        "color" = COALESCE(EXCLUDED."color", "StreamingPlatform"."color"),
        "fetchedAt" = NOW()
      WHERE "StreamingPlatform"."source" = 'anilist'`;
    written++;
  }
  return { found: sources.length, written };
}

/** Icon + colour for each of these site names (case-insensitive). Missing → absent from the map. */
export async function getPlatformArt(sites: string[]): Promise<Map<string, PlatformArt>> {
  const out = new Map<string, PlatformArt>();
  const names = Array.from(new Set(sites.map((s) => s.toLowerCase())));
  if (names.length === 0) return out;
  try {
    const rows = await prisma.$queryRaw<Array<{ site: string; iconUrl: string | null; color: string | null }>>`
      SELECT "site", "iconUrl", "color" FROM "StreamingPlatform" WHERE lower("site") = ANY(${names})`;
    for (const r of rows) out.set(r.site.toLowerCase(), { iconUrl: r.iconUrl, color: r.color });
  } catch {
    // Table missing (migration not applied yet): logos just don't show.
  }
  return out;
}
