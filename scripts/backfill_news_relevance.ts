/**
 * OTAKUVA — NEWS RELEVANCE BACKFILL
 *
 * Usage:
 *   npx tsx scripts/backfill_news_relevance.ts            # dry run, writes nothing
 *   npx tsx scripts/backfill_news_relevance.ts --apply    # persist the verdicts
 *
 * Classifies every stored NewsArticle with newsRelevanceService and reports
 * what would change. Articles ingested before the relevance gate existed all
 * carry the 'ANIME_RELATED' column default, which is a placeholder rather than
 * a judgement — this pass replaces it with a real verdict.
 *
 * This only ever updates the three relevance columns. No article is deleted,
 * unpublished, re-categorised or otherwise altered: OFF_TOPIC simply stops the
 * article appearing in the public feed, and an editor can reverse it.
 */

import { prisma } from '../src/lib/prisma';
import { newsRelevanceService } from '../src/lib/engine/news/newsRelevanceService';

async function main() {
  const apply = process.argv.includes('--apply');

  const articles = await prisma.newsArticle.findMany({
    select: {
      id: true, title: true, summary: true, sourceName: true, relevance: true,
      // Mirror what ingestion passes in: an article already resolved to a
      // canonical entity is anime-related regardless of its wording.
      _count: {
        select: {
          animeRelations: true,
          studioRelations: true,
          personRelations: true,
        },
      },
    },
    orderBy: { publishedAt: 'desc' },
  });

  console.log('='.repeat(74));
  console.log(`  NEWS RELEVANCE BACKFILL — ${articles.length} articles — ${apply ? 'APPLY' : 'DRY RUN'}`);
  console.log('='.repeat(74) + '\n');

  const counts: Record<string, number> = { ANIME_RELATED: 0, REVIEW: 0, OFF_TOPIC: 0 };
  const changes: { title: string; source: string; from: string; to: string; reason: string }[] = [];

  for (const a of articles) {
    const verdict = await newsRelevanceService.classifyRelevance(a.title, a.summary, {
      hasConfirmedEntityMatch:
        a._count.animeRelations > 0 ||
        a._count.studioRelations > 0 ||
        a._count.personRelations > 0,
    });
    counts[verdict.relevance] = (counts[verdict.relevance] || 0) + 1;

    if (verdict.relevance !== a.relevance) {
      changes.push({
        title: a.title,
        source: a.sourceName,
        from: a.relevance,
        to: verdict.relevance,
        reason: verdict.reason,
      });
    }

    if (apply) {
      await prisma.newsArticle.update({
        where: { id: a.id },
        data: {
          relevance: verdict.relevance,
          relevanceScore: verdict.score,
          relevanceReason: verdict.reason,
        },
      });
    }
  }

  const offTopic = changes.filter((c) => c.to === 'OFF_TOPIC');
  const review = changes.filter((c) => c.to === 'REVIEW');

  if (offTopic.length) {
    console.log(`WITHHELD FROM PUBLIC FEED (${offTopic.length}) — retained, reversible:\n`);
    for (const c of offTopic) {
      console.log(`  ${c.source.slice(0, 20).padEnd(20)} | ${c.title.slice(0, 62)}`);
      console.log(`  ${' '.repeat(20)} | ${c.reason}\n`);
    }
  }

  if (review.length) {
    console.log(`FLAGGED FOR REVIEW (${review.length}) — still shown publicly:\n`);
    for (const c of review) {
      console.log(`  ${c.source.slice(0, 20).padEnd(20)} | ${c.title.slice(0, 62)}`);
    }
    console.log();
  }

  console.log('-'.repeat(74));
  console.log(`  ANIME_RELATED : ${counts.ANIME_RELATED}`);
  console.log(`  REVIEW        : ${counts.REVIEW}`);
  console.log(`  OFF_TOPIC     : ${counts.OFF_TOPIC}`);
  console.log(`  changed       : ${changes.length}`);
  console.log('-'.repeat(74));

  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to persist.');
  } else {
    console.log('\nApplied.');
  }
}

main()
  .catch((err) => {
    console.error('[backfill_news_relevance] Failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
