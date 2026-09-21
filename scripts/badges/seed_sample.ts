/**
 * Seeds the PLACEHOLDER badge demo data (src/fixtures/badges/sampleData.ts)
 * into the local development database, so the profile, anime and community
 * pages can be checked against the approved mockups.
 *
 *   npx tsx scripts/badges/seed_sample.ts            # create/refresh
 *   npx tsx scripts/badges/seed_sample.ts --remove   # delete exactly those rows
 *
 * Refuses to run when NODE_ENV=production. Every row is tagged (see
 * PLACEHOLDER in the fixture file), so --remove is exact and never touches
 * real data. The per-tier aggregates are written directly (a real anime with
 * 1,248 reviews would need 1,248 accounts); running `run_counting.ts rebuild`
 * would recompute them from real rows only and overwrite the sample numbers.
 */
import { prisma } from '../../src/lib/prisma';
import {
  PLACEHOLDER,
  SAMPLE_ANIME,
  SAMPLE_COMMUNITIES,
  SAMPLE_MECHA_MEMBERS,
  SAMPLE_USERS,
} from '../../src/fixtures/badges/sampleData';

const REVIEW_BODIES = SAMPLE_ANIME.topReviewers.map(
  (r) =>
    `${r.snippet} PLACEHOLDER REVIEW for demonstration only. The composition, colour and pacing are discussed at length in this fictional write-up so the text clears the minimum length used by the badge rules.`
);

async function remove() {
  const users = await prisma.user.deleteMany({ where: { email: { endsWith: `@${PLACEHOLDER.emailDomain}` } } });
  const communities = await prisma.community.deleteMany({ where: { slug: { startsWith: PLACEHOLDER.slugPrefix } } });
  const anime = await prisma.anime.deleteMany({ where: { externalSource: PLACEHOLDER.animeSource } });
  console.log({ removed: { users: users.count, communities: communities.count, anime: anime.count } });
}

async function seed() {
  const ids: Record<string, string> = {};
  for (const u of Object.values(SAMPLE_USERS)) {
    const email = `${u.username.replace(/[^a-z0-9]/gi, '_')}@${PLACEHOLDER.emailDomain}`;
    const user = await prisma.user.upsert({
      where: { username: u.username },
      create: { username: u.username, email, emailVerifiedAt: new Date(), bio: 'PLACEHOLDER account (badge demo data).' },
      update: {},
    });
    if (!user.email.endsWith(`@${PLACEHOLDER.emailDomain}`)) {
      throw new Error(`Refusing to touch real account "${u.username}" (email is not a placeholder address).`);
    }
    ids[u.username] = user.id;
    await prisma.userBadgeStats.upsert({
      where: { userId: user.id },
      create: { userId: user.id, currentTier: u.tier, countedReviewCount: u.reviews, helpfulVotes: u.helpfulVotes, lastCountedReviewAt: new Date() },
      update: { currentTier: u.tier, countedReviewCount: u.reviews, helpfulVotes: u.helpfulVotes, lastCountedReviewAt: new Date() },
    });
  }

  const anime = await prisma.anime.upsert({
    where: { slug: SAMPLE_ANIME.slug },
    create: {
      slug: SAMPLE_ANIME.slug,
      canonicalTitle: SAMPLE_ANIME.title,
      synopsis: 'PLACEHOLDER: a fictional title used only for badge demo data.',
      posterUrl: '',
      externalSource: PLACEHOLDER.animeSource,
      externalId: 'sunrise-over-kyoto',
    },
    update: {},
  });
  await prisma.animeBadgeAggregate.deleteMany({ where: { animeId: anime.id } });
  await prisma.animeBadgeAggregate.createMany({
    data: Object.entries(SAMPLE_ANIME.byTier).map(([tierKey, count]) => ({ animeId: anime.id, tierKey, count })),
  });

  for (const [i, r] of SAMPLE_ANIME.topReviewers.entries()) {
    const userId = ids[r.username];
    await prisma.userAnime.upsert({
      where: { userId_animeId: { userId, animeId: anime.id } },
      create: { userId, animeId: anime.id, status: 'COMPLETED' },
      update: {},
    });
    const data = {
      title: `PLACEHOLDER review ${i + 1}`,
      body: REVIEW_BODIES[i],
      rating: 8.5 - i * 0.5,
      watchStatusAtReview: 'COMPLETED',
      wordCount: REVIEW_BODIES[i].split(/\s+/).length,
      countState: 'COUNTED',
      countedAt: new Date(),
      likesCount: 120 - i * 35,
      status: 'PUBLISHED',
      deletedAt: null,
    };
    await prisma.review.upsert({
      where: { userId_animeId: { userId, animeId: anime.id } },
      create: { userId, animeId: anime.id, ...data },
      update: data,
    });
  }

  for (const c of SAMPLE_COMMUNITIES) {
    const community = await prisma.community.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        name: c.name,
        description: 'PLACEHOLDER community (badge demo data).',
        ownerId: ids[c.founder],
        memberCount: c.memberCount,
        visibility: 'PUBLIC',
      },
      update: { memberCount: c.memberCount, ownerId: ids[c.founder] },
    });
    const members = new Map<string, string>();
    members.set(c.founder, 'OWNER');
    if (c.yukiRole === 'MEMBER') members.set('yuki_watches', 'MEMBER');
    if (c.slug.endsWith('mecha-mondays')) for (const m of SAMPLE_MECHA_MEMBERS) if (!members.has(m.username)) members.set(m.username, m.role === 'MODERATOR' ? 'MODERATOR' : 'MEMBER');
    for (const [username, role] of Array.from(members.entries())) {
      await prisma.communityMember.upsert({
        where: { communityId_userId: { communityId: community.id, userId: ids[username] } },
        create: { communityId: community.id, userId: ids[username], role, status: 'ACTIVE' },
        update: { role, status: 'ACTIVE' },
      });
    }
    await prisma.communityBadgeAggregate.deleteMany({ where: { communityId: community.id } });
    if (c.byTier) {
      await prisma.communityBadgeAggregate.createMany({
        data: Object.entries(c.byTier).map(([tierKey, count]) => ({ communityId: community.id, tierKey, count })),
      });
    }
  }
  console.log('Seeded placeholder badge data. Remove with: npx tsx scripts/badges/seed_sample.ts --remove');
}

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('Refusing to seed placeholder data with NODE_ENV=production.');
    process.exit(1);
  }
  if (process.argv.includes('--remove')) await remove();
  else await seed();
  await prisma.$disconnect();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
