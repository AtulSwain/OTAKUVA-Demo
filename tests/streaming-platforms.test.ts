import './helpers/setupTestDb';

import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { getPlatformArt } from '../src/lib/catalog/streamingPlatforms';

after(async () => {
  await prisma.$disconnect();
});

describe('streaming platform logos', () => {
  test('looks up icon + colour by site name, case-insensitively; unknown sites are absent', async () => {
    await prisma.$executeRaw`
      INSERT INTO "StreamingPlatform" ("id", "site", "iconUrl", "color")
      VALUES ('sp1', 'Crunchyroll', 'https://s4.anilist.co/file/anilistcdn/link/icon/5.png', '#F88B24')`;
    const art = await getPlatformArt(['crunchyroll', 'Some Unknown Site']);
    assert.deepEqual(art.get('crunchyroll'), { iconUrl: 'https://s4.anilist.co/file/anilistcdn/link/icon/5.png', color: '#F88B24' });
    assert.equal(art.has('some unknown site'), false);
    assert.equal((await getPlatformArt([])).size, 0);
  });
});
