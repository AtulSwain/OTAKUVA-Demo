import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { DevR2WithLocalFallback } from '../src/lib/storage';
import { R2AuthError } from '../src/lib/storage/r2StorageProvider';

const uploadsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'otakuva-storage-'));
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(4096, 1)]);
const file = { file: png, filename: 'a.png', mimeType: 'image/png', category: 'profile-avatar' as const, entityId: 'u1' };

before(() => {
  process.env.LOCAL_UPLOADS_ROOT = uploadsRoot;
});
after(() => {
  fs.rmSync(uploadsRoot, { recursive: true, force: true });
});

function fakeR2(behaviour: 'auth-error' | 'network-error' | 'ok') {
  let calls = 0;
  return {
    get calls() { return calls; },
    async upload() {
      calls++;
      if (behaviour === 'auth-error') throw new R2AuthError('rejected');
      if (behaviour === 'network-error') throw new Error('socket hang up');
      return { url: 'https://media.example/avatars/x.webp', filename: 'x.webp', size: 3, mimeType: 'image/webp', provider: 'r2' as const };
    },
    async delete() { return true; },
    getPublicUrl: (k: string) => `https://media.example/${k}`,
  };
}

describe('dev storage fallback when R2 rejects credentials', () => {
  // Revoked/rolled R2 tokens made every avatar/banner upload fail in dev.
  test('an R2 auth failure switches to local storage, and stays switched', async () => {
    const r2 = fakeR2('auth-error');
    const storage = new DevR2WithLocalFallback(r2 as any, async () => true);
    const first = await storage.upload(file);
    assert.equal(first.provider, 'local');
    assert.match(first.url, /^\/uploads\//);
    await storage.upload(file);
    assert.equal(r2.calls, 1, 'R2 is not retried once it rejected the token');
    assert.equal(storage.name, 'local');
  });

  test('other R2 errors are not masked by the fallback', async () => {
    const storage = new DevR2WithLocalFallback(fakeR2('network-error') as any, async () => true);
    await assert.rejects(storage.upload(file), /socket hang up/);
  });

  test('a working R2 is used as-is', async () => {
    const storage = new DevR2WithLocalFallback(fakeR2('ok') as any, async () => true);
    assert.equal((await storage.upload(file)).provider, 'r2');
  });
});

describe('dev storage fallback when the public image address is down', () => {
  // MEDIA_PUBLIC_URL pointed at a domain that wasn't set up: uploads "worked"
  // but every image link was broken (2026-10-28).
  test('an unreachable public address stores uploads locally, without touching R2', async () => {
    const r2 = fakeR2('ok');
    const storage = new DevR2WithLocalFallback(r2 as any, async () => false);
    const res = await storage.upload(file);
    assert.match(res.url, /^\/uploads\//);
    assert.equal(r2.calls, 0);
  });
});
