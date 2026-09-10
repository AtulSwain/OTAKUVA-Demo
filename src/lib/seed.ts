import { prisma } from './prisma';
import { FIXTURE_ANIMES, FIXTURE_USER_PROGRESS } from '../fixtures/anime.fixture';

export async function seedDatabase() {
  console.log('Seeding Phase 2 & 3 Relational Database...');

  // 1. Ensure default user exists
  const defaultUser = await prisma.user.upsert({
    where: { id: 'user_default' },
    update: {
      username: 'Atul Swain',
      email: 'atul@anilog.app',
      avatarUrl: '/avatars/default.png',
      bio: 'Anime enthusiast, archivist, and seasonal watcher.',
    },
    create: {
      id: 'user_default',
      username: 'Atul Swain',
      email: 'atul@anilog.app',
      avatarUrl: '/avatars/default.png',
      bio: 'Anime enthusiast, archivist, and seasonal watcher.',
    },
  });

  // 2. Ensure canonical major studios exist
  const coreStudios = [
    { name: 'MAPPA', slug: 'mappa' },
    { name: 'Trigger', slug: 'trigger' },
    { name: 'Kyoto Animation', slug: 'kyoto-animation' },
    { name: 'Madhouse', slug: 'madhouse' },
    { name: 'Bones', slug: 'bones' },
    { name: 'Wit Studio', slug: 'wit-studio' },
    { name: 'Ufotable', slug: 'ufotable' },
    { name: 'CloverWorks', slug: 'cloverworks' },
    { name: 'A-1 Pictures', slug: 'a-1-pictures' },
  ];
  for (const st of coreStudios) {
    await prisma.studio.upsert({
      where: { slug: st.slug },
      update: { name: st.name },
      create: { name: st.name, slug: st.slug },
    });
  }

  // Ensure canonical creators exist
  const corePeople = [
    { name: 'Hayao Miyazaki', nameKanji: '宮崎 駿' },
    { name: 'Makoto Shinkai', nameKanji: '新海 誠' },
    { name: 'Shinichiro Watanabe', nameKanji: '渡辺 信一郎' },
    { name: 'Satoshi Kon', nameKanji: '今 敏' },
  ];
  for (const p of corePeople) {
    const existingP = await prisma.person.findFirst({ where: { name: p.name } });
    if (!existingP) {
      await prisma.person.create({
        data: { name: p.name, nameKanji: p.nameKanji },
      });
    }
  }

  // 3. Seed canonical anime and their rich relational entities
  for (const anime of FIXTURE_ANIMES) {
    const slug = anime.id;
    const extId = anime.externalId || slug;
    const extSource = anime.externalSource || 'mal';

    // Find existing by externalId or slug
    let savedAnime = await prisma.anime.findFirst({
      where: {
        OR: [
          { externalSource: extSource, externalId: extId },
          { slug },
        ],
      },
    });

    const animeData = {
      externalId: extId,
      externalSource: extSource,
      malId: extSource === 'mal' && extId && !isNaN(Number(extId)) ? parseInt(extId, 10) : undefined,
      slug,
      canonicalTitle: anime.title,
      synopsis: anime.synopsis,
      type: anime.type,
      episodes: anime.episodes,
      status: anime.status,
      season: anime.season,
      year: anime.year,
      score: anime.score,
      scoredBy: anime.ratingCount || 0,
      rank: anime.rank,
      popularity: anime.popularity,
      posterUrl: anime.posterImage,
      largePosterUrl: anime.posterImage,
      bannerUrl: anime.bannerImage || anime.posterImage,
      duration: anime.duration,
      source: anime.source,
    };

    if (savedAnime) {
      savedAnime = await prisma.anime.update({
        where: { id: savedAnime.id },
        data: animeData,
      });
    } else {
      savedAnime = await prisma.anime.create({
        data: {
          id: slug,
          ...animeData,
        },
      });
    }

    // Canonical Season 1
    const season1 = await prisma.season.upsert({
      where: {
        animeId_seasonNumber: {
          animeId: savedAnime.id,
          seasonNumber: 1,
        },
      },
      update: {
        title: `${anime.title} (Season 1)`,
        episodeCount: anime.episodes || 12,
      },
      create: {
        animeId: savedAnime.id,
        seasonNumber: 1,
        title: `${anime.title} (Season 1)`,
        episodeCount: anime.episodes || 12,
      },
    });

    // Titles
    await prisma.animeTitle.deleteMany({ where: { animeId: savedAnime.id } });
    const titlesToInsert = [
      { type: 'official', title: anime.title },
      ...(anime.englishTitle ? [{ type: 'english', title: anime.englishTitle }] : []),
      ...(anime.japaneseTitle ? [{ type: 'japanese', title: anime.japaneseTitle }] : []),
      ...(anime.romajiTitle ? [{ type: 'romaji', title: anime.romajiTitle }] : []),
    ];

    for (const t of titlesToInsert) {
      await prisma.animeTitle.create({
        data: {
          animeId: savedAnime.id,
          type: t.type,
          title: t.title,
        },
      });
    }

    // Genres
    for (const gName of anime.genres) {
      const gSlug = gName.toLowerCase().replace(/\s+/g, '-');
      const genre = await prisma.genre.upsert({
        where: { name: gName },
        update: {},
        create: { name: gName, slug: gSlug },
      });

      await prisma.animeGenre.upsert({
        where: {
          animeId_genreId: {
            animeId: savedAnime.id,
            genreId: genre.id,
          },
        },
        update: {},
        create: {
          animeId: savedAnime.id,
          genreId: genre.id,
        },
      });
    }

    // Themes
    if (anime.themes) {
      for (const thName of anime.themes) {
        const thSlug = thName.toLowerCase().replace(/\s+/g, '-');
        const theme = await prisma.theme.upsert({
          where: { name: thName },
          update: {},
          create: { name: thName, slug: thSlug },
        });

        await prisma.animeTheme.upsert({
          where: {
            animeId_themeId: {
              animeId: savedAnime.id,
              themeId: theme.id,
            },
          },
          update: {},
          create: {
            animeId: savedAnime.id,
            themeId: theme.id,
          },
        });
      }
    }

    // Studios
    for (const stName of anime.studios) {
      const stSlug = stName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const studio = await prisma.studio.upsert({
        where: { slug: stSlug },
        update: { name: stName },
        create: { name: stName, slug: stSlug },
      });

      await prisma.animeStudio.upsert({
        where: {
          animeId_studioId: {
            animeId: savedAnime.id,
            studioId: studio.id,
          },
        },
        update: {},
        create: {
          animeId: savedAnime.id,
          studioId: studio.id,
          isMain: true,
        },
      });
    }

    // Episodes
    const totalEps = anime.episodes || 12;
    for (let epNum = 1; epNum <= totalEps; epNum++) {
      await prisma.episode.upsert({
        where: {
          animeId_number: {
            animeId: savedAnime.id,
            number: epNum,
          },
        },
        update: {
          seasonId: season1.id,
          canonicalOrder: epNum,
          status: 'AIRED',
        },
        create: {
          animeId: savedAnime.id,
          seasonId: season1.id,
          number: epNum,
          canonicalOrder: epNum,
          status: 'AIRED',
          title: `Episode ${epNum}`,
          duration: '24 min',
        },
      });
    }

    // External stats
    await prisma.externalAnimeStats.upsert({
      where: { animeId: savedAnime.id },
      update: {
        score10: Math.floor((anime.ratingCount || 1000) * 0.45),
        score9: Math.floor((anime.ratingCount || 1000) * 0.3),
        score8: Math.floor((anime.ratingCount || 1000) * 0.15),
        score7: Math.floor((anime.ratingCount || 1000) * 0.06),
        score6: Math.floor((anime.ratingCount || 1000) * 0.02),
        score5: Math.floor((anime.ratingCount || 1000) * 0.01),
        score4: 0,
        score3: 0,
        score2: 0,
        score1: 0,
        total: anime.ratingCount || 1000,
      },
      create: {
        animeId: savedAnime.id,
        source: 'mal',
        score10: Math.floor((anime.ratingCount || 1000) * 0.45),
        score9: Math.floor((anime.ratingCount || 1000) * 0.3),
        score8: Math.floor((anime.ratingCount || 1000) * 0.15),
        score7: Math.floor((anime.ratingCount || 1000) * 0.06),
        score6: Math.floor((anime.ratingCount || 1000) * 0.02),
        score5: Math.floor((anime.ratingCount || 1000) * 0.01),
        score4: 0,
        score3: 0,
        score2: 0,
        score1: 0,
        total: anime.ratingCount || 1000,
      },
    });
  }

  // 4. Seed user progress & ratings
  for (const item of FIXTURE_USER_PROGRESS) {
    const targetAnime = await prisma.anime.findFirst({
      where: {
        OR: [
          { id: item.animeId },
          { slug: item.animeId },
        ],
      },
    });
    if (!targetAnime) continue;

    const actualAnimeId = targetAnime.id;
    const upperStatus = item.status.toUpperCase();

    // UserAnime
    await prisma.userAnime.upsert({
      where: {
        userId_animeId: {
          userId: 'user_default',
          animeId: actualAnimeId,
        },
      },
      update: {
        status: upperStatus,
        episodesWatched: item.episodesWatched,
      },
      create: {
        userId: 'user_default',
        animeId: actualAnimeId,
        status: upperStatus,
        episodesWatched: item.episodesWatched,
        startDate: new Date(),
      },
    });

    // Rating
    if (item.personalScore) {
      await prisma.animeRating.upsert({
        where: {
          userId_animeId: {
            userId: 'user_default',
            animeId: actualAnimeId,
          },
        },
        update: {
          rating: item.personalScore,
        },
        create: {
          userId: 'user_default',
          animeId: actualAnimeId,
          rating: item.personalScore,
        },
      });
    }

    // Favorite
    if (item.isFavorite) {
      await prisma.favorite.upsert({
        where: {
          userId_animeId: {
            userId: 'user_default',
            animeId: actualAnimeId,
          },
        },
        update: {},
        create: {
          userId: 'user_default',
          animeId: actualAnimeId,
        },
      });
    }

    // User episode progress
    const episodes = await prisma.episode.findMany({
      where: {
        animeId: actualAnimeId,
        number: { lte: item.episodesWatched },
      },
    });

    for (const ep of episodes) {
      await prisma.userEpisodeProgress.upsert({
        where: {
          userId_episodeId: {
            userId: 'user_default',
            episodeId: ep.id,
          },
        },
        update: {},
        create: {
          userId: 'user_default',
          animeId: actualAnimeId,
          episodeId: ep.id,
        },
      });
    }
  }

  // 4. Seed Community Data (Reviews, Discussions, Lists, Activities)
  const aot = await prisma.anime.findFirst({ where: { slug: 'attack-on-titan-final-season' } });
  const frieren = await prisma.anime.findFirst({ where: { slug: 'frieren-beyond-journeys-end' } });
  const apothecary = await prisma.anime.findFirst({ where: { slug: 'the-apothecary-diaries' } });

  if (aot) {
    const existingReview = await prisma.review.findFirst({ where: { userId: 'user_default', animeId: aot.id } });
    if (!existingReview) {
      await prisma.review.create({
        data: {
          userId: 'user_default',
          animeId: aot.id,
          title: 'A monumental, emotionally exhausting conclusion to a generational masterpiece.',
          body: 'The Final Season challenges the morality of every single character we grew up with. MAPPA delivers incredible directing, and the soundtrack elevates every scene into pure tragic cinema.',
          rating: 10,
          containsSpoiler: false,
        },
      });
    }

    const existingDisc = await prisma.discussion.findFirst({ where: { authorId: 'user_default', animeId: aot.id } });
    if (!existingDisc) {
      await prisma.discussion.create({
        data: {
          authorId: 'user_default',
          animeId: aot.id,
          title: 'Episode 16 Ending Discussion: Freedom vs Retribution',
          body: 'What are your interpretations of the shifting allegiances in this climax? Let us discuss character motivations.',
          spoilerLevel: 'EPISODE_SPOILER',
        },
      });
    }

    const existingAct = await prisma.activity.findFirst({ where: { userId: 'user_default', animeId: aot.id } });
    if (!existingAct) {
      await prisma.activity.create({
        data: {
          userId: 'user_default',
          type: 'STATUS_CHANGED',
          animeId: aot.id,
          metadata: JSON.stringify({ status: 'WATCHING', progress: 16 }),
        },
      });
    }
  }

  if (frieren) {
    const existingReview = await prisma.review.findFirst({ where: { userId: 'user_default', animeId: frieren.id } });
    if (!existingReview) {
      await prisma.review.create({
        data: {
          userId: 'user_default',
          animeId: frieren.id,
          title: 'Poignant, breathtaking, and beautifully paced fantasy.',
          body: 'Frieren takes the end of a typical hero fantasy journey and turns it into a meditation on time, fleeting mortality, and human connection.',
          rating: 10,
          containsSpoiler: false,
        },
      });
    }

    const existingDisc = await prisma.discussion.findFirst({ where: { authorId: 'user_default', animeId: frieren.id } });
    if (!existingDisc) {
      await prisma.discussion.create({
        data: {
          authorId: 'user_default',
          animeId: frieren.id,
          title: 'Why the First-Class Mage Exam Arc Subverts Battle Shonen Tropes',
          body: 'The pacing and psychological emphasis during the mage exam arc stood out compared to typical tournament arcs.',
          spoilerLevel: 'NO_SPOILER',
        },
      });
    }

    const existingAct = await prisma.activity.findFirst({ where: { userId: 'user_default', animeId: frieren.id } });
    if (!existingAct) {
      await prisma.activity.create({
        data: {
          userId: 'user_default',
          type: 'EPISODE_WATCHED',
          animeId: frieren.id,
          metadata: JSON.stringify({ episodeNumber: 28 }),
        },
      });
    }
  }

  if (apothecary) {
    const existingAct = await prisma.activity.findFirst({ where: { userId: 'user_default', animeId: apothecary.id } });
    if (!existingAct) {
      await prisma.activity.create({
        data: {
          userId: 'user_default',
          type: 'STATUS_CHANGED',
          animeId: apothecary.id,
          metadata: JSON.stringify({ status: 'WATCHING', progress: 24 }),
        },
      });
    }
  }

  // Custom List
  const existingList = await prisma.userList.findFirst({ where: { userId: 'user_default' } });
  if (!existingList) {
    const list = await prisma.userList.create({
      data: {
        userId: 'user_default',
        name: 'Peak Modern Storytelling (2020s Masterpieces)',
        description: 'A curated selection of narrative-driven masterworks with sublime direction and worldbuilding.',
        visibility: 'PUBLIC',
      },
    });

    if (aot) {
      await prisma.userListItem.create({
        data: { listId: list.id, animeId: aot.id, position: 1 },
      });
    }
    if (frieren) {
      await prisma.userListItem.create({
        data: { listId: list.id, animeId: frieren.id, position: 2 },
      });
    }
    if (apothecary) {
      await prisma.userListItem.create({
        data: { listId: list.id, animeId: apothecary.id, position: 3 },
      });
    }

    await prisma.activity.create({
      data: {
        userId: 'user_default',
        type: 'LIST_CREATED',
        metadata: JSON.stringify({ listName: list.name }),
      },
    });
  }

  console.log('Database successfully seeded with Phase 2 & 3 Relational Architecture and Community Data.');
}
