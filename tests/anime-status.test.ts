import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyAnimeStatus, formatAnimeStatus } from '../src/lib/anime/animeStatus';

describe('anime status display', () => {
  test('both providers’ vocabularies map to one set of labels', () => {
    for (const raw of ['Finished', 'Finished Airing', 'FINISHED']) assert.equal(formatAnimeStatus(raw), 'Finished', raw);
    for (const raw of ['Airing', 'Currently Airing', 'RELEASING', 'CURRENTLY_AIRING']) assert.equal(formatAnimeStatus(raw), 'Airing', raw);
    for (const raw of ['Not Yet Aired', 'Not yet aired', 'NOT_YET_AIRED', 'Upcoming']) assert.equal(formatAnimeStatus(raw), 'Not yet aired', raw);
  });

  test('"Finished Airing" is finished, not airing', () => {
    assert.equal(classifyAnimeStatus('Finished Airing'), 'finished');
  });

  test('unknown status shows nothing rather than a guess', () => {
    for (const raw of [null, undefined, '', 'UNKNOWN', 'something odd']) assert.equal(formatAnimeStatus(raw as any), null, String(raw));
  });
});
