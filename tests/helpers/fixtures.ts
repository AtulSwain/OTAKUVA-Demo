import { prisma } from '../../src/lib/prisma';
import type { TestUser } from './http';

let seq = 0;
const next = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;

export async function createUser(role = 'USER'): Promise<TestUser & { role: string }> {
  const n = next();
  return prisma.user.create({
    data: { username: `user_${n}`, email: `user_${n}@test.invalid`, role },
    select: { id: true, username: true, email: true, role: true },
  });
}

export async function createAnime(overrides: Record<string, unknown> = {}) {
  const n = next();
  return prisma.anime.create({
    data: {
      slug: `test-anime-${n}`,
      canonicalTitle: `Test Anime ${n}`,
      synopsis: '',
      posterUrl: '',
      externalSource: 'mal',
      externalId: `test-${n}`,
      ...overrides,
    },
  });
}

export async function createEpisode(animeId: string, number: number, airedAt: Date | null = null) {
  return prisma.episode.create({ data: { animeId, number, airedAt } });
}

/** Community with its owner as an ACTIVE OWNER member, as creation does. */
export async function createCommunity(owner: TestUser, visibility: 'PUBLIC' | 'REQUEST_TO_JOIN' | 'PRIVATE', joinPolicy = 'OPEN') {
  const n = next();
  const community = await prisma.community.create({
    data: {
      ownerId: owner.id,
      name: `Community ${n}`,
      slug: `community-${n}`,
      description: 'test',
      visibility,
      joinPolicy,
    },
  });
  await prisma.communityMember.create({
    data: { communityId: community.id, userId: owner.id, role: 'OWNER', status: 'ACTIVE' },
  });
  return community;
}

export async function addMember(communityId: string, user: TestUser, role = 'MEMBER', status = 'ACTIVE') {
  return prisma.communityMember.create({ data: { communityId, userId: user.id, role, status } });
}

export async function createDiscussion(author: TestUser, communityId: string | null, extra: Record<string, unknown> = {}) {
  return prisma.discussion.create({
    data: { authorId: author.id, communityId, title: 'A test discussion', body: 'Body of the test discussion', ...extra },
  });
}
