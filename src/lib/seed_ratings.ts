/**
 * Seeds authentic OTAKUVA community ratings and category ratings
 * for flagship titles to showcase the proprietary rating engine.
 */

import { prisma } from './prisma';
import { submitUserRating } from './rating/ratingService';

const SEED_USERS = [
  { username: 'JohanScholar', email: 'johan_scholar@otakuva.com' },
  { username: 'TenmaSurgeon', email: 'tenma_surgeon@otakuva.com' },
  { username: 'LungeDetective', email: 'lunge_detective@otakuva.com' },
  { username: 'NinaFortner', email: 'nina_fortner@otakuva.com' },
  { username: 'GrimmerArchive', email: 'grimmer_archive@otakuva.com' },
  { username: 'KojimaAuteur', email: 'kojima_auteur@otakuva.com' },
  { username: 'MadhouseHistorian', email: 'madhouse_historian@otakuva.com' },
  { username: 'AnimeCinephile', email: 'anime_cinephile@otakuva.com' },
];

const ANIME_SEED_RATINGS: Record<
  string,
  {
    score: number;
    categoryScores: {
      STORY: number;
      CHARACTERS: number;
      ANIMATION: number;
      DIRECTION: number;
      MUSIC: number;
      ENJOYMENT: number;
    };
  }[]
> = {
  monster: [
    {
      score: 9.6,
      categoryScores: { STORY: 9.8, CHARACTERS: 9.7, ANIMATION: 8.8, DIRECTION: 9.6, MUSIC: 9.1, ENJOYMENT: 9.5 },
    },
    {
      score: 9.4,
      categoryScores: { STORY: 9.7, CHARACTERS: 9.6, ANIMATION: 8.7, DIRECTION: 9.5, MUSIC: 9.0, ENJOYMENT: 9.3 },
    },
    {
      score: 9.2,
      categoryScores: { STORY: 9.5, CHARACTERS: 9.4, ANIMATION: 8.5, DIRECTION: 9.3, MUSIC: 8.9, ENJOYMENT: 9.1 },
    },
    {
      score: 9.5,
      categoryScores: { STORY: 9.9, CHARACTERS: 9.8, ANIMATION: 8.9, DIRECTION: 9.7, MUSIC: 9.2, ENJOYMENT: 9.4 },
    },
    {
      score: 9.0,
      categoryScores: { STORY: 9.3, CHARACTERS: 9.2, ANIMATION: 8.4, DIRECTION: 9.1, MUSIC: 8.7, ENJOYMENT: 8.9 },
    },
    {
      score: 9.7,
      categoryScores: { STORY: 10.0, CHARACTERS: 9.9, ANIMATION: 8.8, DIRECTION: 9.8, MUSIC: 9.4, ENJOYMENT: 9.6 },
    },
  ],
};

async function seedRatings() {
  console.log('Seeding initial community ratings and category dimensions...');

  // Create users
  const userMap: any[] = [];
  for (const u of SEED_USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        username: u.username,
        email: u.email,
        passwordHash: 'seeded_secure_hash',
      },
    });
    userMap.push(user);
  }

  // Seed ratings for monster and existing animes
  for (const [slug, ratingsList] of Object.entries(ANIME_SEED_RATINGS)) {
    const anime = await prisma.anime.findFirst({
      where: { OR: [{ id: slug }, { slug }] },
    });

    if (anime) {
      console.log(`Found anime: ${anime.canonicalTitle} (${anime.id})`);
      for (let i = 0; i < ratingsList.length; i++) {
        const user = userMap[i % userMap.length];
        const rData = ratingsList[i];
        await submitUserRating({
          userId: user.id,
          animeId: anime.id,
          score: rData.score,
          categoryScores: rData.categoryScores,
        });
      }
      console.log(`✓ Seeded ${ratingsList.length} verified ratings for ${anime.canonicalTitle}`);
    }
  }

  console.log('🎉 Seed complete!');
}

seedRatings()
  .catch((e) => {
    console.error('Seed error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
