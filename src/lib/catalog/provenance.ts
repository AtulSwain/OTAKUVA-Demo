/**
 * OTAKUVA — shared per-entity-batch provenance recording.
 *
 * Extracted from src/lib/syncEngine.ts (which was the only caller until
 * src/lib/catalog/episodeBackfillEngine.ts needed the same thing) so both
 * have one implementation of "which provider supplied this batch of
 * episodes/characters/staff for this anime" instead of two copies that
 * could drift. Writes DataSourceRecord — `entityId` is always the anime's
 * canonical id here: these are per-anime batches (all of an anime's
 * episodes, all its characters, ...), not one row per episode/character.
 */

import { prisma } from '../prisma';
import { logger } from '../logger';

// PERSON: a creator's profile details (entityId is the Person id, not an anime).
export type ProvenanceEntityType = 'EPISODE' | 'CHARACTER' | 'STAFF' | 'PERSON';

export async function recordDataSourceProvenance(
  entityType: ProvenanceEntityType,
  animeId: string,
  provider: 'anilist' | 'jikan',
  externalId: string
): Promise<void> {
  await prisma.dataSourceRecord
    .upsert({
      where: { entityType_entityId_provider: { entityType, entityId: animeId, provider } },
      update: { externalId, lastVerifiedAt: new Date() },
      create: { entityType, entityId: animeId, provider, externalId, retrievedAt: new Date(), lastVerifiedAt: new Date() },
    })
    .catch((e) => {
      logger.warn('failed to record provenance', { error: e, entityType, animeId, provider });
    });
}
