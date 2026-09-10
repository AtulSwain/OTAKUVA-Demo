import { prisma } from './prisma';

async function runCriticalTest() {
  console.log('--- Starting OTAKUVA Critical User Flow & Data Isolation Test ---');

  // 1. Ensure test user exists
  const testUserId = 'test_user_flow_123';
  const testUser = await prisma.user.upsert({
    where: { id: testUserId },
    create: {
      id: testUserId,
      email: 'otaku_test@otakuva.com',
      username: 'OtakuTester',
    },
    update: {},
  });
  console.log('✓ User Verified:', testUser.username);

  // 2. Resolve Anime (Monster)
  const monster = await prisma.anime.findFirst({
    where: {
      OR: [{ slug: 'monster' }, { canonicalTitle: 'Monster' }],
    },
  });

  if (!monster) {
    throw new Error('Monster anime not found in database!');
  }
  console.log('✓ Anime Resolved:', monster.canonicalTitle, `(${monster.id})`);

  // 3. User adds to library: PLAN_TO_WATCH
  const libraryEntry1 = await prisma.userAnime.upsert({
    where: { userId_animeId: { userId: testUser.id, animeId: monster.id } },
    create: {
      userId: testUser.id,
      animeId: monster.id,
      status: 'PLAN_TO_WATCH',
      episodesWatched: 0,
    },
    update: {
      status: 'PLAN_TO_WATCH',
    },
  });
  console.log('✓ Library Status Set: PLAN_TO_WATCH');

  // 4. Transition to WATCHING
  const libraryEntry2 = await prisma.userAnime.update({
    where: { userId_animeId: { userId: testUser.id, animeId: monster.id } },
    data: { status: 'WATCHING' },
  });
  console.log('✓ Library Status Transitioned: WATCHING');

  // 5. Mark Episode 1 Watched
  const ep1 = await prisma.episode.findFirst({
    where: { animeId: monster.id, number: 1 },
  });

  if (ep1) {
    await prisma.userEpisodeProgress.upsert({
      where: { userId_episodeId: { userId: testUser.id, episodeId: ep1.id } },
      create: {
        userId: testUser.id,
        animeId: monster.id,
        episodeId: ep1.id,
      },
      update: {},
    });
    await prisma.userAnime.update({
      where: { userId_animeId: { userId: testUser.id, animeId: monster.id } },
      data: { episodesWatched: 1 },
    });
    console.log('✓ Episode 1 Watched & Progress Incremented to 1');
  }

  // 6. User rates Monster 9/10
  await prisma.animeRating.upsert({
    where: { userId_animeId: { userId: testUser.id, animeId: monster.id } },
    create: {
      userId: testUser.id,
      animeId: monster.id,
      rating: 9.0,
    },
    update: {
      rating: 9.0,
    },
  });
  console.log('✓ User Rated Monster: 9.0 / 10');

  // 7. Transition to ON_HOLD
  const onHoldEntry = await prisma.userAnime.update({
    where: { userId_animeId: { userId: testUser.id, animeId: monster.id } },
    data: { status: 'ON_HOLD' },
  });
  console.log('✓ Status Transitioned to ON_HOLD');

  // 8. CRITICAL ISOLATION TEST: Re-query and verify state is intact
  const verifiedUserAnime = await prisma.userAnime.findUnique({
    where: { userId_animeId: { userId: testUser.id, animeId: monster.id } },
  });
  const verifiedRating = await prisma.animeRating.findUnique({
    where: { userId_animeId: { userId: testUser.id, animeId: monster.id } },
  });

  if (verifiedUserAnime?.status !== 'ON_HOLD') {
    throw new Error(`Expected status ON_HOLD, got ${verifiedUserAnime?.status}`);
  }
  if (verifiedUserAnime?.episodesWatched !== 1) {
    throw new Error(`Expected episodesWatched 1, got ${verifiedUserAnime?.episodesWatched}`);
  }
  if (verifiedRating?.rating !== 9.0) {
    throw new Error(`Expected rating 9.0, got ${verifiedRating?.rating}`);
  }

  console.log('====================================================');
  console.log('ALL CRITICAL PRODUCT & DATA ISOLATION TESTS PASSED!');
  console.log('====================================================');
}

runCriticalTest()
  .catch((e) => {
    console.error('Test Failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
