import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial canonical communities and public discussions...');

  // Ensure default user exists
  const user = await prisma.user.upsert({
    where: { id: 'user_default' },
    update: {},
    create: {
      id: 'user_default',
      username: 'anilog_curator',
      email: 'curator@anilog.moe',
      bio: 'Official ANILOG Anime Community & Catalog Curator',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
    },
  });

  const communitiesData = [
    {
      name: 'Anime Mystery Club',
      slug: 'anime-mystery-club',
      description: 'Psychological, mystery, and thriller anime discussions, deep theories, and analytical breakdowns.',
      category: 'GENRE',
      visibility: 'PUBLIC',
      memberCount: 8420,
      iconUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=150',
      bannerUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200',
      rules: [
        { title: 'Spoiler Policy', content: 'Always tag episode spoilers and never post untagged manga plot twists.' },
        { title: 'Respectful Debate', content: 'Constructive theories and analysis are welcomed. Harassment is strictly prohibited.' },
      ],
      channels: [
        { name: 'welcome', slug: 'welcome', type: 'TEXT', position: 0 },
        { name: 'general', slug: 'general', type: 'TEXT', position: 1 },
        { name: 'theories', slug: 'theories', type: 'TEXT', position: 2 },
        { name: 'recommendations', slug: 'recommendations', type: 'TEXT', position: 3 },
      ],
    },
    {
      name: 'Frieren Sanctuary',
      slug: 'frieren-sanctuary',
      description: 'Dedicated space for fans of Frieren: Beyond Journey\'s End. Magic theories, character appreciation, and manga discussions.',
      category: 'ANIME',
      visibility: 'PUBLIC',
      memberCount: 18200,
      iconUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=150',
      bannerUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=1200',
      rules: [
        { title: 'Manga Spoilers in #manga only', content: 'Do not discuss unadapted manga chapters in general channels.' },
        { title: 'Art Attribution', content: 'Credit original fan artists when sharing fan art.' },
      ],
      channels: [
        { name: 'general', slug: 'general', type: 'TEXT', position: 0 },
        { name: 'episode-discussion', slug: 'episode-discussion', type: 'TEXT', position: 1 },
        { name: 'magic-lore', slug: 'magic-lore', type: 'TEXT', position: 2 },
      ],
    },
    {
      name: 'Seinen & Psychological Archive',
      slug: 'seinen-archive',
      description: 'For lovers of Monster, Pluto, Vinland Saga, Berserk, and mature storytelling in anime and manga.',
      category: 'GENRE',
      visibility: 'PUBLIC',
      memberCount: 12540,
      iconUrl: 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=150',
      bannerUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1200',
      rules: [
        { title: 'Mature Discussions', content: 'Keep discussions philosophical and respectful.' },
      ],
      channels: [
        { name: 'general', slug: 'general', type: 'TEXT', position: 0 },
        { name: 'character-analysis', slug: 'character-analysis', type: 'TEXT', position: 1 },
      ],
    },
    {
      name: 'Shonen Battle Society',
      slug: 'shonen-battle-society',
      description: 'Power scaling, weekly episode reactions, battle animation highlights, and tournament arcs.',
      category: 'GENRE',
      visibility: 'PUBLIC',
      memberCount: 24900,
      iconUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=150',
      bannerUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=1200',
      rules: [
        { title: 'No Toxicity', content: 'Power scaling discussions must remain friendly and respectful.' },
      ],
      channels: [
        { name: 'general', slug: 'general', type: 'TEXT', position: 0 },
        { name: 'sakuga-animations', slug: 'sakuga-animations', type: 'TEXT', position: 1 },
      ],
    },
  ];

  for (const c of communitiesData) {
    const community = await prisma.community.upsert({
      where: { slug: c.slug },
      update: {
        name: c.name,
        description: c.description,
        category: c.category,
        visibility: c.visibility,
        memberCount: c.memberCount,
        iconUrl: c.iconUrl,
        bannerUrl: c.bannerUrl,
      },
      create: {
        ownerId: user.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        category: c.category,
        visibility: c.visibility,
        memberCount: c.memberCount,
        iconUrl: c.iconUrl,
        bannerUrl: c.bannerUrl,
      },
    });

    // Seed Rules
    for (let i = 0; i < c.rules.length; i++) {
      const r = c.rules[i];
      await prisma.communityRule.create({
        data: {
          communityId: community.id,
          position: i,
          title: r.title,
          content: r.content,
        },
      });
    }

    // Seed Channels
    for (const ch of c.channels) {
      await prisma.communityChannel.upsert({
        where: { communityId_slug: { communityId: community.id, slug: ch.slug } },
        update: {},
        create: {
          communityId: community.id,
          name: ch.name,
          slug: ch.slug,
          type: ch.type,
          position: ch.position,
        },
      });
    }

    // Add owner as active member with OWNER role
    await prisma.communityMember.upsert({
      where: { communityId_userId: { communityId: community.id, userId: user.id } },
      update: { role: 'OWNER', status: 'ACTIVE' },
      create: {
        communityId: community.id,
        userId: user.id,
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });
  }

  // Seed Public Discussions (communityId = null)
  const publicDiscussions = [
    {
      title: 'What makes Monster\'s ending so powerful and psychologically haunting?',
      body: 'The ending of Monster does not give a conventional Hollywood climax; instead, it leaves us with the chilling empty hospital bed. What is your interpretation of Johan\'s ultimate fate and Tenma\'s moral resolve?',
      type: 'ANALYSIS',
      spoilerLevel: 'ANIME_SPOILER',
      replyCount: 14,
      helpfulCount: 42,
    },
    {
      title: 'Frieren Episode 28 — The significance of Himmel\'s memories in shaping Fern and Stark',
      body: 'As Season 1 concludes, how do you think Frieren\'s gradual understanding of human warmth affects the growth of her young companions?',
      type: 'EPISODE_DISCUSSION',
      spoilerLevel: 'EPISODE_SPOILER',
      replyCount: 28,
      helpfulCount: 89,
    },
    {
      title: 'Which anime studio had the best year in terms of consistent production quality?',
      body: 'Looking across MAPPA, ufotable, Wit Studio, CloverWorks, and Madhouse — who delivered the most impressive sakuga and direction?',
      type: 'QUESTION',
      spoilerLevel: 'NO_SPOILER',
      replyCount: 35,
      helpfulCount: 64,
    },
  ];

  for (const pd of publicDiscussions) {
    const discussion = await prisma.discussion.create({
      data: {
        authorId: user.id,
        title: pd.title,
        body: pd.body,
        type: pd.type,
        spoilerLevel: pd.spoilerLevel,
        replyCount: pd.replyCount,
        helpfulCount: pd.helpfulCount,
      },
    });

    // Add a comment
    await prisma.discussionComment.create({
      data: {
        discussionId: discussion.id,
        authorId: user.id,
        body: 'Completely agree with this perspective. The subtleties in character pacing really stand out upon rewatching.',
      },
    });
  }

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
