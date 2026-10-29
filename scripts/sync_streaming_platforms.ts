/**
 * Fetch every streaming site's official icon + brand colour from AniList
 * into StreamingPlatform (logos for "Where to Watch").
 *   npx tsx scripts/sync_streaming_platforms.ts           # dry run
 *   npx tsx scripts/sync_streaming_platforms.ts --apply
 */
import { prisma } from '../src/lib/prisma';
import { syncStreamingPlatforms } from '../src/lib/catalog/streamingPlatforms';

async function main() {
  const apply = process.argv.includes('--apply');
  const r = await syncStreamingPlatforms({ apply });
  console.log(`${apply ? 'Wrote' : 'Dry run — would write'} ${apply ? r.written : r.found} streaming platforms.`);
  const missing = await prisma.$queryRaw<Array<{ provider: string; n: bigint }>>`
    SELECT sa."provider", COUNT(*) AS n FROM "StreamingAvailability" sa
    LEFT JOIN "StreamingPlatform" sp ON lower(sp."site") = lower(sa."provider")
    WHERE sp."id" IS NULL GROUP BY sa."provider" ORDER BY n DESC`;
  if (missing.length) console.log('Listings with no platform art:', missing.map((m) => `${m.provider} (${m.n})`).join(', '));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
