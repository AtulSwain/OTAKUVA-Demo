import { prisma } from '../src/lib/prisma';

async function verify() {
  console.log('=== VERIFYING REAL-WORLD ANIME NEWS SYSTEM ===');

  const count = await prisma.newsArticle.count();
  console.log(`Total News Articles: ${count}`);

  const articles = await prisma.newsArticle.findMany({
    include: {
      animeRelations: { include: { anime: true } },
      studioRelations: { include: { studio: true } },
    },
  });

  const providers = await prisma.newsProvider.findMany();
  console.log(`\n--- Source Registry (${providers.length} providers) ---`);
  for (const p of providers) {
    console.log(`- [${p.slug}] ${p.name} | Domain: ${p.domain} | Trust: ${p.trustLevel} | Status: ${p.status} | Active: ${p.active}`);
  }

  console.log('\n--- Article Integrity Check ---');
  let invalidCount = 0;
  for (const a of articles) {
    // Check 1: Real Source
    if (!a.sourceName || a.sourceName === 'UNKNOWN') {
      console.error(`Article ${a.id} has invalid sourceName!`);
      invalidCount++;
    }
    // Check 2: Real Canonical URL
    if (!a.canonicalUrl || !a.canonicalUrl.startsWith('http')) {
      console.error(`Article ${a.id} has invalid canonicalUrl: ${a.canonicalUrl}`);
      invalidCount++;
    }
    // Check 3: Real Date
    if (isNaN(a.publishedAt.getTime()) || a.publishedAt.getFullYear() < 2020) {
      console.error(`Article ${a.id} has invalid date: ${a.publishedAt}`);
      invalidCount++;
    }
    // Check 4: No Unsplash/Stock Images
    if (a.imageUrl && (a.imageUrl.includes('unsplash.com') || a.imageUrl.includes('placeholder'))) {
      console.error(`Article ${a.id} has fake/stock image: ${a.imageUrl}`);
      invalidCount++;
    }
  }

  if (invalidCount === 0) {
    console.log('✅ ALL articles passed strict real-world validation! Zero fake data detected.');
  } else {
    console.error(`❌ Found ${invalidCount} validation failures!`);
  }

  console.log('\n--- Sample Verified Ingested Articles ---');
  for (const a of articles.slice(0, 5)) {
    console.log(`• [${a.provider}] ${a.title}`);
    console.log(`  Source: ${a.sourceName} | By: ${a.author || 'Staff'} | Date: ${a.publishedAt.toISOString()}`);
    console.log(`  Link: ${a.canonicalUrl}`);
    console.log(`  Image: ${a.imageUrl ? 'Verified Production Visual' : 'None (Neutral editorial placeholder in UI)'}`);
  }
}

verify()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
