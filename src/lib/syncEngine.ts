import { prisma } from './prisma';
import { anilistProvider, jikanProvider } from './providers';
import { AnimeProvider, ProviderAnime } from './providers/animeProvider.interface';
import { getJikanAnimeFull, getJikanProducerFull } from './jikanService';
import {
  validateAndNormalizeAnime,
  validateAndNormalizeEpisode,
  generateSlug,
  normalizeSearchTitle,
  calculateDataCompletenessScore,
} from './normalizers';

export class SyncEngine {
  private activeLocks = new Set<string>();

  private acquireLock(key: string): boolean {
    if (this.activeLocks.has(key)) return false;
    this.activeLocks.add(key);
    return true;
  }

  private releaseLock(key: string): void {
    this.activeLocks.delete(key);
  }

  private getProvider(name: 'anilist' | 'jikan'): AnimeProvider {
    return name === 'jikan' ? jikanProvider : anilistProvider;
  }

  /**
   * Ingests a single ProviderAnime into canonical PostgreSQL/Prisma
   */
  async ingestAnime(rawAnime: ProviderAnime, providerName: 'anilist' | 'jikan' = 'anilist'): Promise<{
    animeId: string;
    isNew: boolean;
    slug: string;
  }> {
    const normalized = validateAndNormalizeAnime(rawAnime);

    // 1. Entity Resolution: Check by AnimeExternalId first, then malId/anilistId, then exact normalized slug
    let existingAnime = await prisma.anime.findFirst({
      where: {
        OR: [
          { externalIds: { some: { provider: providerName, externalId: normalized.externalId } } },
          ...(normalized.anilistId ? [{ anilistId: normalized.anilistId }] : []),
          ...(normalized.malId ? [{ malId: normalized.malId }] : []),
          { slug: normalized.slug },
        ],
      },
      include: {
        externalIds: true,
      },
    });

    // Check for active Editorial Overrides
    const overrides = existingAnime
      ? await prisma.editorialOverride.findMany({
          where: { entityType: 'ANIME', entityId: existingAnime.id },
        })
      : [];

    const overrideMap = new Map<string, string>();
    overrides.forEach((o) => overrideMap.set(o.field, o.value));

    const finalTitle = overrideMap.get('canonicalTitle') || normalized.canonicalTitle;
    const finalSynopsis = overrideMap.get('synopsis') || normalized.synopsis;

    let animeId: string;
    let isNew = false;
    const slug = existingAnime ? existingAnime.slug : normalized.slug;

    if (!existingAnime) {
      isNew = true;
      const created = await prisma.anime.create({
        data: {
          slug,
          canonicalTitle: finalTitle,
          synopsis: finalSynopsis,
          background: normalized.background,
          externalSource: providerName,
          externalId: normalized.externalId,
          malId: normalized.malId,
          anilistId: normalized.anilistId,
          type: normalized.type,
          source: normalized.source,
          status: normalized.status,
          country: normalized.country,
          isAdult: normalized.isAdult,
          episodes: normalized.episodes,
          duration: normalized.duration,
          rating: normalized.rating,
          airedFrom: normalized.airedFrom,
          airedTo: normalized.airedTo,
          startDate: normalized.startDate,
          endDate: normalized.endDate,
          startYear: normalized.startYear,
          startMonth: normalized.startMonth,
          startDay: normalized.startDay,
          endYear: normalized.endYear,
          endMonth: normalized.endMonth,
          endDay: normalized.endDay,
          datePrecision: normalized.datePrecision,
          season: normalized.season,
          seasonYear: normalized.seasonYear,
          year: normalized.year,
          broadcastDay: normalized.broadcastDay,
          broadcastTime: normalized.broadcastTime,
          broadcastTimezone: normalized.broadcastTimezone,
          score: normalized.score,
          scoredBy: normalized.scoredBy,
          rank: normalized.rank,
          popularity: normalized.popularity,
          members: normalized.members,
          favoritesCount: normalized.favoritesCount,
          posterUrl: normalized.posterUrl,
          largePosterUrl: normalized.largePosterUrl,
          bannerUrl: normalized.bannerUrl,
          trailerUrl: normalized.trailerUrl,
          metadataHash: normalized.metadataHash,
          firstImportedAt: new Date(),
          lastSyncedAt: new Date(),
        },
      });
      animeId = created.id;
    } else {
      animeId = existingAnime.id;
      // Perform field-level sync only if changed
      if (existingAnime.metadataHash !== normalized.metadataHash) {
        await prisma.anime.update({
          where: { id: animeId },
          data: {
            canonicalTitle: overrideMap.has('canonicalTitle') ? undefined : finalTitle,
            synopsis: overrideMap.has('synopsis') ? undefined : finalSynopsis,
            background: normalized.background || undefined,
            malId: normalized.malId || undefined,
            anilistId: normalized.anilistId || undefined,
            type: normalized.type,
            source: normalized.source || undefined,
            status: normalized.status,
            country: normalized.country,
            isAdult: normalized.isAdult,
            episodes: normalized.episodes || undefined,
            duration: normalized.duration || undefined,
            airedFrom: normalized.airedFrom || undefined,
            airedTo: normalized.airedTo || undefined,
            startDate: normalized.startDate || undefined,
            endDate: normalized.endDate || undefined,
            startYear: normalized.startYear || undefined,
            startMonth: normalized.startMonth || undefined,
            startDay: normalized.startDay || undefined,
            datePrecision: normalized.datePrecision,
            season: normalized.season || undefined,
            seasonYear: normalized.seasonYear || undefined,
            year: normalized.year || undefined,
            score: normalized.score || undefined,
            scoredBy: normalized.scoredBy || undefined,
            rank: normalized.rank || undefined,
            popularity: normalized.popularity || undefined,
            members: normalized.members || undefined,
            favoritesCount: normalized.favoritesCount || undefined,
            posterUrl: normalized.posterUrl || undefined,
            largePosterUrl: normalized.largePosterUrl || undefined,
            bannerUrl: normalized.bannerUrl || undefined,
            trailerUrl: normalized.trailerUrl || undefined,
            metadataHash: normalized.metadataHash,
            lastSyncedAt: new Date(),
          },
        });
      }
    }

    // 2. Upsert AnimeExternalId
    await prisma.animeExternalId.upsert({
      where: { provider_externalId: { provider: providerName, externalId: normalized.externalId } },
      update: { animeId, updatedAt: new Date() },
      create: { animeId, provider: providerName, externalId: normalized.externalId },
    });

    if (normalized.malId && (providerName as string) !== 'mal') {
      await prisma.animeExternalId.upsert({
        where: { provider_externalId: { provider: 'mal', externalId: String(normalized.malId) } },
        update: { animeId, updatedAt: new Date() },
        create: { animeId, provider: 'mal', externalId: String(normalized.malId) },
      });
    }

    // 3. Upsert AnimeTitles with Searchable Normalization
    const titlesToInsert = [...normalized.titles];
    if (!titlesToInsert.some((t) => t.title.toLowerCase() === normalized.canonicalTitle.toLowerCase())) {
      titlesToInsert.unshift({ type: 'official', title: normalized.canonicalTitle });
    }

    for (const t of titlesToInsert) {
      const searchableTitle = normalizeSearchTitle(t.title);
      const existingTitle = await prisma.animeTitle.findFirst({
        where: { animeId, title: t.title },
      });
      if (!existingTitle) {
        await prisma.animeTitle.create({
          data: {
            animeId,
            type: t.type,
            title: t.title,
            language: t.language || null,
            isPrimary: t.type === 'official',
            searchableTitle,
          },
        });
      }
    }

    // 4. Upsert Genres & AnimeGenre
    for (const g of normalized.genres) {
      const genreSlug = generateSlug(g);
      const genreRecord = await prisma.genre.upsert({
        where: { name: g },
        update: {},
        create: { name: g, slug: genreSlug },
      });
      await prisma.animeGenre.upsert({
        where: { animeId_genreId: { animeId, genreId: genreRecord.id } },
        update: {},
        create: { animeId, genreId: genreRecord.id },
      });
    }

    // 5. Upsert Themes & AnimeTheme
    for (const th of normalized.themes) {
      const themeSlug = generateSlug(th);
      const themeRecord = await prisma.theme.upsert({
        where: { name: th },
        update: {},
        create: { name: th, slug: themeSlug },
      });
      await prisma.animeTheme.upsert({
        where: { animeId_themeId: { animeId, themeId: themeRecord.id } },
        update: {},
        create: { animeId, themeId: themeRecord.id },
      });
    }

    // 6. Upsert Tags (AniList tags)
    for (const tag of normalized.tags) {
      await prisma.animeTag.upsert({
        where: { animeId_name: { animeId, name: tag.name } },
        update: {
          rank: tag.rank || 0,
          description: tag.description || null,
          isMediaSpoiler: Boolean(tag.isMediaSpoiler),
        },
        create: {
          animeId,
          name: tag.name,
          description: tag.description || null,
          rank: tag.rank || 0,
          isMediaSpoiler: Boolean(tag.isMediaSpoiler),
          source: providerName,
        },
      });
    }

    // 7. Upsert Animation Studios strictly (AnimeStudio)
    for (const s of normalized.studios) {
      const studioSlug = generateSlug(s.name);
      const studioRecord = await prisma.studio.upsert({
        where: { name: s.name },
        update: { slug: studioSlug },
        create: { name: s.name, slug: studioSlug },
      });
      await prisma.animeStudio.upsert({
        where: { animeId_studioId: { animeId, studioId: studioRecord.id } },
        update: { isMain: s.isMain ?? true },
        create: { animeId, studioId: studioRecord.id, isMain: s.isMain ?? true },
      });
    }

    // 7b. Upsert Producers strictly (AnimeProducer)
    if (Array.isArray(normalized.producers)) {
      for (const pName of normalized.producers) {
        if (!pName || typeof pName !== 'string') continue;
        const producerSlug = generateSlug(pName);
        const producerRecord = await prisma.producer.upsert({
          where: { name: pName },
          update: { slug: producerSlug },
          create: { name: pName, slug: producerSlug },
        });
        await prisma.animeProducer.upsert({
          where: { animeId_producerId: { animeId, producerId: producerRecord.id } },
          update: {},
          create: { animeId, producerId: producerRecord.id },
        });
      }
    }

    // 8. Calculate Data Completeness Score
    const completeness = calculateDataCompletenessScore({
      canonicalTitle: finalTitle,
      synopsis: finalSynopsis,
      posterUrl: normalized.posterUrl,
      bannerUrl: normalized.bannerUrl,
      startDate: normalized.startDate,
      startYear: normalized.startYear,
      episodes: normalized.episodes,
      type: normalized.type,
      status: normalized.status,
      genresCount: normalized.genres.length,
      studiosCount: normalized.studios.length,
    });

    await prisma.anime.update({
      where: { id: animeId },
      data: { dataCompletenessScore: completeness },
    });

    // 9. Save DataSourceRecord Provenance
    await prisma.dataSourceRecord.upsert({
      where: {
        entityType_entityId_provider: {
          entityType: 'ANIME',
          entityId: animeId,
          provider: providerName,
        },
      },
      update: {
        externalId: normalized.externalId,
        rawHash: normalized.metadataHash,
        lastVerifiedAt: new Date(),
      },
      create: {
        entityType: 'ANIME',
        entityId: animeId,
        provider: providerName,
        externalId: normalized.externalId,
        rawHash: normalized.metadataHash,
        retrievedAt: new Date(),
        lastVerifiedAt: new Date(),
      },
    });

    return { animeId, isNew, slug };
  }

  /**
   * Checkpointed Full/Bulk Catalog Ingestion with automatic resume
   */
  async syncCatalog(
    providerName: 'anilist' | 'jikan' = 'anilist',
    maxPages = 2,
    jobType = 'FULL_CATALOG'
  ): Promise<{
    success: boolean;
    jobId: string;
    processedCount: number;
    createdCount: number;
    updatedCount: number;
    error?: string;
  }> {
    const lockKey = `sync:${providerName}:${jobType}`;
    if (!this.acquireLock(lockKey)) {
      return { success: false, jobId: '', processedCount: 0, createdCount: 0, updatedCount: 0, error: 'Sync job already running' };
    }

    try {
      // 1. Get or create SyncCheckpoint
      let checkpoint = await prisma.syncCheckpoint.findUnique({
        where: { provider_jobType: { provider: providerName, jobType } },
      });

      let startPage = checkpoint ? checkpoint.page : 1;

      // 2. Create SyncJob record
      const job = await prisma.syncJob.create({
        data: {
          provider: providerName,
          jobType,
          status: 'RUNNING',
          page: startPage,
          startedAt: new Date(),
        },
      });

      const provider = this.getProvider(providerName);
      let currentPage = startPage;
      let totalProcessed = 0;
      let totalCreated = 0;
      let totalUpdated = 0;
      let totalFailed = 0;

      for (let i = 0; i < maxPages; i++) {
        try {
          const listRes = await provider.getAnimeList(currentPage, 25);
          if (!listRes.items || listRes.items.length === 0) break;

          for (const item of listRes.items) {
            try {
              const res = await this.ingestAnime(item, providerName);
              totalProcessed++;
              if (res.isNew) totalCreated++;
              else totalUpdated++;
            } catch (err: any) {
              totalFailed++;
              console.error(`Failed to ingest anime ${item.title}:`, err?.message);
            }
          }

          // Advance page checkpoint
          currentPage++;
          await prisma.syncCheckpoint.upsert({
            where: { provider_jobType: { provider: providerName, jobType } },
            update: {
              page: currentPage,
              processedCount: { increment: listRes.items.length },
              createdCount: { increment: totalCreated },
              updatedCount: { increment: totalUpdated },
              failedCount: { increment: totalFailed },
              updatedAt: new Date(),
            },
            create: {
              syncJobId: job.id,
              provider: providerName,
              jobType,
              page: currentPage,
              processedCount: totalProcessed,
              createdCount: totalCreated,
              updatedCount: totalUpdated,
              failedCount: totalFailed,
            },
          });

          if (!listRes.pagination.hasNextPage) break;
        } catch (pageErr: any) {
          console.error(`Error on page ${currentPage} during syncCatalog:`, pageErr?.message);
          break;
        }
      }

      // Finalize SyncJob
      await prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          processedCount: totalProcessed,
          createdCount: totalCreated,
          updatedCount: totalUpdated,
          failedCount: totalFailed,
          completedAt: new Date(),
        },
      });

      return {
        success: true,
        jobId: job.id,
        processedCount: totalProcessed,
        createdCount: totalCreated,
        updatedCount: totalUpdated,
      };
    } catch (err: any) {
      return { success: false, jobId: '', processedCount: 0, createdCount: 0, updatedCount: 0, error: err?.message };
    } finally {
      this.releaseLock(lockKey);
    }
  }

  /**
   * Sync Live Airing Broadcast Schedules
   */
  async syncWeeklySchedule(): Promise<{ success: boolean; syncedCount: number; error?: string }> {
    const lockKey = 'schedule:weekly';
    if (!this.acquireLock(lockKey)) {
      return { success: false, syncedCount: 0, error: 'Schedule sync already running' };
    }

    try {
      const now = Math.floor(Date.now() / 1000);
      const startOfWeek = now - 86400; // 1 day ago
      const endOfWeek = now + 7 * 86400; // 7 days ahead

      const scheduleData = await anilistProvider.getAiringSchedule(startOfWeek, endOfWeek, 1, 50);
      let syncedCount = 0;

      for (const item of scheduleData.items) {
        if (!item.media) continue;

        const media = item.media;
        const anilistId = media.id;
        const malId = media.idMal || null;
        const airingDate = new Date(item.airingAt * 1000);
        if (!Number.isFinite(airingDate.getTime()) || item.episode < 1) continue;

        const anime = await prisma.anime.findFirst({
          where: {
            OR: [
              { anilistId },
              ...(malId ? [{ malId }] : []),
              { externalIds: { some: { provider: 'anilist', externalId: String(anilistId) } } },
            ],
          },
        });
        if (!anime) {
          console.warn(`[Schedule Sync] Skipping unmatched anime ${anilistId}`);
          continue;
        }

        const episode = await prisma.episode.findUnique({
          where: { animeId_number: { animeId: anime.id, number: item.episode } },
        });
        if (!episode) {
          console.warn(`[Schedule Sync] Skipping episode ${item.episode} for ${anime.canonicalTitle}: canonical episode missing`);
          continue;
        }

        // Upsert AiringSchedule
        await prisma.airingSchedule.upsert({
          where: {
            animeId_episode_releaseType: {
              animeId: anime.id,
              episode: item.episode,
              releaseType: 'BROADCAST',
            },
          },
          update: {
            airingAt: airingDate,
            timeUntilAiring: item.timeUntilAiring,
            lastVerifiedAt: new Date(),
          },
          create: {
            animeId: anime.id,
            episodeId: episode.id,
            episode: item.episode,
            airingAt: airingDate,
            timeUntilAiring: item.timeUntilAiring,
            releaseType: 'BROADCAST',
            source: 'anilist',
            externalScheduleId: String(item.id),
          },
        });

        syncedCount++;
      }

      return { success: true, syncedCount };
    } catch (err: any) {
      return { success: false, syncedCount: 0, error: err?.message };
    } finally {
      this.releaseLock(lockKey);
    }
  }

  /**
   * Ingest Episodes for an Anime
   */
  async syncEpisodes(animeId: string, externalId: string, providerName: 'anilist' | 'jikan' = 'jikan'): Promise<number> {
    const provider = this.getProvider(providerName);

    // getAnimeEpisodes only returns one page (Jikan pages at 100 episodes),
    // so a single call silently truncates every long-running show — a
    // 1000+ episode series like One Piece would sync as if it had 100.
    // Page through until the provider says there's nothing more, with a
    // generous but finite cap so a provider bug can never spin this forever.
    const MAX_EPISODE_PAGES = 50; // 50 x 100 = 5,000 episodes, well past any real anime
    const episodes: Awaited<ReturnType<typeof provider.getAnimeEpisodes>>['episodes'] = [];
    let page = 1;
    while (page <= MAX_EPISODE_PAGES) {
      const res = await provider.getAnimeEpisodes(externalId, page);
      if (res.episodes.length === 0) break;
      episodes.push(...res.episodes);
      if (!res.pagination.hasNextPage) break;
      page++;
    }

    let count = 0;

    for (const ep of episodes) {
      try {
        const norm = validateAndNormalizeEpisode(ep, animeId);
        await prisma.episode.upsert({
          where: { animeId_number: { animeId, number: norm.number } },
          update: {
            title: norm.title,
            titleJapanese: norm.titleJapanese,
            synopsis: norm.synopsis,
            airedAt: norm.airedAt,
            filler: norm.filler,
            recap: norm.recap,
            externalUrl: norm.externalUrl,
            imageUrl: norm.imageUrl,
            updatedAt: new Date(),
          },
          create: {
            animeId,
            externalId: norm.externalId,
            number: norm.number,
            title: norm.title,
            titleJapanese: norm.titleJapanese,
            synopsis: norm.synopsis,
            airedAt: norm.airedAt,
            filler: norm.filler,
            recap: norm.recap,
            externalUrl: norm.externalUrl,
            imageUrl: norm.imageUrl,
          },
        });
        count++;
      } catch (e) {
        // Skip invalid episode
      }
    }
    return count;
  }

  /**
   * Ingest Characters & Japanese Voice Actors for an Anime
   */
  async syncCharacters(animeId: string, externalId: string, providerName: 'anilist' | 'jikan' = 'anilist'): Promise<number> {
    const provider = this.getProvider(providerName);
    const characters = await provider.getAnimeCharacters(externalId);
    let count = 0;

    for (const c of characters) {
      try {
        const characterSlug = generateSlug(c.name, c.externalId);
        const charRecord = await prisma.character.upsert({
          where: { slug: characterSlug },
          update: {
            externalId: c.externalId,
            nameKanji: c.nameKanji || undefined,
            about: c.about || undefined,
            imageUrl: c.imageUrl || undefined,
          },
          create: {
            externalId: c.externalId,
            name: c.name,
            slug: characterSlug,
            nameKanji: c.nameKanji || null,
            about: c.about || null,
            imageUrl: c.imageUrl || null,
          },
        });

        await prisma.animeCharacter.upsert({
          where: { animeId_characterId: { animeId, characterId: charRecord.id } },
          update: { role: c.role },
          create: { animeId, characterId: charRecord.id, role: c.role },
        });

        // Ingest Voice Actors
        for (const va of c.voiceActors) {
          const personSlug = generateSlug(va.personName, va.personExternalId);
          const personRecord = await prisma.person.upsert({
            where: { slug: personSlug },
            update: {
              externalId: va.personExternalId,
              nameKanji: va.personKanji || undefined,
              imageUrl: va.personImage || undefined,
            },
            create: {
              externalId: va.personExternalId,
              name: va.personName,
              slug: personSlug,
              nameKanji: va.personKanji || null,
              imageUrl: va.personImage || null,
            },
          });

          await prisma.characterVoiceActor.upsert({
            where: {
              characterId_personId_language: {
                characterId: charRecord.id,
                personId: personRecord.id,
                language: va.language,
              },
            },
            update: {},
            create: {
              characterId: charRecord.id,
              personId: personRecord.id,
              language: va.language,
            },
          });
        }
        count++;
      } catch (e) {
        // Skip on duplicate
      }
    }
    return count;
  }

  /**
   * Ingest Staff for an Anime
   */
  async syncStaff(animeId: string, externalId: string, providerName: 'anilist' | 'jikan' = 'anilist'): Promise<number> {
    const provider = this.getProvider(providerName);
    const staffList = await provider.getAnimeStaff(externalId);
    let count = 0;

    for (const s of staffList) {
      try {
        const personSlug = generateSlug(s.personName, s.personExternalId);
        const personRecord = await prisma.person.upsert({
          where: { slug: personSlug },
          update: {
            externalId: s.personExternalId,
            nameKanji: s.personKanji || undefined,
            imageUrl: s.personImage || undefined,
          },
          create: {
            externalId: s.personExternalId,
            name: s.personName,
            slug: personSlug,
            nameKanji: s.personKanji || null,
            imageUrl: s.personImage || null,
          },
        });

        const roleName = s.positions.join(', ') || 'Staff';
        const existingStaff = await prisma.animeStaff.findFirst({
          where: { animeId, personId: personRecord.id, role: roleName },
        });

        if (!existingStaff) {
          await prisma.animeStaff.create({
            data: {
              animeId,
              personId: personRecord.id,
              role: roleName,
            },
          });
        }
        count++;
      } catch (e) {}
    }
    return count;
  }

  /**
   * Ingest Relations & Auto-Link Franchises
   */
  async syncRelations(animeId: string, externalId: string, providerName: 'anilist' | 'jikan' = 'anilist'): Promise<number> {
    const provider = this.getProvider(providerName);
    const relations = await provider.getAnimeRelations(externalId);
    let count = 0;

    const sourceAnime = await prisma.anime.findUnique({ where: { id: animeId } });
    if (!sourceAnime) return 0;

    for (const rel of relations) {
      try {
        // Resolve target anime if in database
        const targetAnime = await prisma.anime.findFirst({
          where: {
            OR: [
              { externalIds: { some: { provider: providerName, externalId: rel.relatedExternalId } } },
              { canonicalTitle: rel.relatedTitle },
            ],
          },
        });

        if (targetAnime) {
          await prisma.animeRelation.upsert({
            where: {
              sourceAnimeId_targetAnimeId_relationType: {
                sourceAnimeId: animeId,
                targetAnimeId: targetAnime.id,
                relationType: rel.relationType,
              },
            },
            update: {},
            create: {
              sourceAnimeId: animeId,
              targetAnimeId: targetAnime.id,
              relationType: rel.relationType,
            },
          });

          // Auto-link to Franchise if exists or create root franchise
          const rootFranchiseName = sourceAnime.canonicalTitle.split(':')[0].trim();
          const franchiseSlug = generateSlug(rootFranchiseName);

          const franchise = await prisma.franchise.upsert({
            where: { name: rootFranchiseName },
            update: {},
            create: {
              name: rootFranchiseName,
              slug: franchiseSlug,
              description: `Franchise timeline and productions for ${rootFranchiseName}.`,
            },
          });

          await prisma.franchiseAnime.upsert({
            where: { franchiseId_animeId: { franchiseId: franchise.id, animeId } },
            update: { position: 1 },
            create: { franchiseId: franchise.id, animeId, position: 1, relationship: 'MAIN' },
          });

          await prisma.franchiseAnime.upsert({
            where: { franchiseId_animeId: { franchiseId: franchise.id, animeId: targetAnime.id } },
            update: { position: 2 },
            create: { franchiseId: franchise.id, animeId: targetAnime.id, position: 2, relationship: rel.relationType.toUpperCase() },
          });

          count++;
        }
      } catch (e) {}
    }
    return count;
  }

  /**
   * Best-effort studio detail enrichment. `ingestAnime` only ever upserts a
   * Studio's `name`/`slug` (it doesn't know which provider-specific record
   * that name came from). This backfills the richer editorial fields
   * (`about`, `foundedYear`, `imageUrl`, ...) from Jikan's producer page,
   * once per studio — never overwrites a studio an admin has already
   * verified/edited (`verificationStatus` past UNVERIFIED, or
   * `descriptionSource === 'ADMIN'`/`'EDITORIAL'` with content already set).
   */
  async enrichStudioFromJikan(studioName: string, jikanMalId: number): Promise<boolean> {
    try {
      const studio = await prisma.studio.findUnique({ where: { name: studioName } });
      if (!studio) return false;

      // Record provenance even if we skip the content fetch below.
      if (!studio.externalId || studio.externalSource !== 'mal') {
        await prisma.studio.update({
          where: { id: studio.id },
          data: { externalId: String(jikanMalId), externalSource: studio.externalSource || 'mal' },
        });
      }

      const alreadyEnriched =
        Boolean(studio.about) ||
        studio.verificationStatus !== 'UNVERIFIED' ||
        (studio.descriptionSource !== 'PROVIDER' && studio.descriptionSource !== 'EDITORIAL');
      // EDITORIAL is the schema default for a bare upsert-by-name row (no
      // real editorial content yet), so treat "EDITORIAL with no `about`"
      // as still eligible for a provider fill-in.
      if (alreadyEnriched && studio.descriptionSource !== 'EDITORIAL') return false;
      if (studio.about) return false;

      const full = await getJikanProducerFull(jikanMalId);
      if (!full) return false;

      await prisma.studio.update({
        where: { id: studio.id },
        data: {
          about: full.about || undefined,
          foundedYear: full.established ? new Date(full.established).getFullYear() || undefined : undefined,
          foundedDate: full.established ? new Date(full.established) : undefined,
          imageUrl: full.images?.jpg?.image_url || undefined,
          website: Array.isArray(full.external) && full.external[0]?.url ? full.external[0].url : undefined,
          descriptionSource: full.about ? 'PROVIDER' : undefined,
        },
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Ingests exactly one anime by its MAL id via Jikan: canonical record,
   * episodes, characters/staff, relations, and best-effort studio detail —
   * everything `syncFullCatalogById` needs per title. Split out so an admin
   * "resync this one anime" action can reuse it directly.
   *
   * Returns `null` (not an error) when Jikan has no such id, or when the
   * fetch fails after Jikan's own retry/backoff — the caller is responsible
   * for queuing a retry (see `syncFullCatalogById`); a transient provider
   * failure must never be treated as "this anime doesn't exist."
   */
  async ingestAnimeByMalId(malId: number): Promise<{ animeId: string; isNew: boolean } | null> {
    // Same URL/cache key as jikanProvider.getAnime() below, so this doesn't
    // cost a second network round-trip — it's there to recover the raw
    // `studios[].mal_id` values the mapped ProviderAnime shape drops.
    const raw = await getJikanAnimeFull(malId);
    if (!raw) return null;

    const providerAnime = await jikanProvider.getAnime(String(malId));
    if (!providerAnime) return null;

    const { animeId, isNew } = await this.ingestAnime(providerAnime, 'jikan');

    // Best-effort detail enrichment. None of these may ever block or fail
    // the core catalog write above — a missing character list is a gap to
    // fill later, not a reason to lose the anime record itself.
    await Promise.allSettled([
      this.syncEpisodes(animeId, String(malId), 'jikan'),
      this.syncCharacters(animeId, String(malId), 'jikan'),
      this.syncStaff(animeId, String(malId), 'jikan'),
      this.syncRelations(animeId, String(malId), 'jikan'),
    ]);

    if (Array.isArray(raw.studios)) {
      for (const s of raw.studios) {
        if (s?.mal_id && s?.name) {
          await this.enrichStudioFromJikan(s.name, s.mal_id).catch(() => false);
        }
      }
    }

    return { animeId, isNew };
  }

  /**
   * Resumable full-catalog crawl over Jikan's MAL id space, driven by id
   * rather than by `/anime` search pagination: Jikan's search/listing
   * endpoints proxy a live MAL search and degrade under load (observed
   * firsthand — sustained 504s), while `/anime/{id}/full` is served from
   * Jikan's own cache and is far more reliable. IDs with no anime (gaps,
   * manga-only ids, 404s) are cheap to skip and are never retried as
   * failures; genuine fetch failures go to `DeadLetterQueue` instead of
   * being silently skipped forever.
   *
   * Bounded by `maxIds` per call so a driver script can call this
   * repeatedly (e.g. in a loop with its own logging/shutdown handling)
   * rather than one call running for the entire multi-hour crawl.
   */
  async syncFullCatalogById(
    maxIds: number,
    endId: number,
    jobType = 'FULL_CATALOG_BY_ID',
    startId = 1
  ): Promise<{
    success: boolean;
    doneToId: number;
    reachedEnd: boolean;
    processed: number;
    created: number;
    updated: number;
    notFound: number;
    failed: number;
  }> {
    const lockKey = `sync:jikan:${jobType}`;
    if (!this.acquireLock(lockKey)) {
      return { success: false, doneToId: 0, reachedEnd: false, processed: 0, created: 0, updated: 0, notFound: 0, failed: 0 };
    }

    let processed = 0, created = 0, updated = 0, notFound = 0, failed = 0;
    let currentId = startId;

    try {
      let checkpoint = await prisma.syncCheckpoint.findUnique({
        where: { provider_jobType: { provider: 'jikan', jobType } },
      });
      currentId = checkpoint?.lastProcessedId ? parseInt(checkpoint.lastProcessedId, 10) + 1 : startId;

      const job = checkpoint?.syncJobId
        ? await prisma.syncJob.update({ where: { id: checkpoint.syncJobId }, data: { status: 'RUNNING' } })
        : await prisma.syncJob.create({
            data: { provider: 'jikan', jobType, status: 'RUNNING', totalItems: endId },
          });

      let idsAttempted = 0;
      let reachedEnd = false;

      while (idsAttempted < maxIds && currentId <= endId) {
        try {
          let wasCreated = false;
          let wasUpdated = false;
          let wasNotFound = false;

          const result = await this.ingestAnimeByMalId(currentId);
          if (result) {
            processed++;
            if (result.isNew) { created++; wasCreated = true; } else { updated++; wasUpdated = true; }
          } else {
            // Could be a real 404 (no such id) or an exhausted-retry
            // failure — either way, queue it. A genuine gap costs one
            // cheap re-check later; a transient failure gets the retry it
            // needs. Never silently drop it as "resolved."
            notFound++;
            wasNotFound = true;
            await prisma.deadLetterQueue.create({
              data: {
                provider: 'jikan',
                entityType: 'ANIME',
                externalId: String(currentId),
                error: 'No data returned (not found or provider fetch failed after retries)',
              },
            }).catch(() => {});
          }

          // checkpoint stats below are cumulative counters on one row, so
          // each id's outcome must land as a +1 increment — never a `set`
          // to this call's local running total, which would overwrite
          // (not add to) whatever earlier batches already recorded.
          await prisma.syncCheckpoint.upsert({
            where: { provider_jobType: { provider: 'jikan', jobType } },
            update: {
              lastProcessedId: String(currentId),
              page: Math.floor(currentId / 25) + 1,
              processedCount: { increment: 1 },
              createdCount: wasCreated ? { increment: 1 } : undefined,
              updatedCount: wasUpdated ? { increment: 1 } : undefined,
              failedCount: wasNotFound ? { increment: 1 } : undefined,
            },
            create: {
              syncJobId: job.id,
              provider: 'jikan',
              jobType,
              lastProcessedId: String(currentId),
              page: Math.floor(currentId / 25) + 1,
              processedCount: 1,
              createdCount: wasCreated ? 1 : 0,
              updatedCount: wasUpdated ? 1 : 0,
              failedCount: wasNotFound ? 1 : 0,
            },
          });
        } catch (err: any) {
          failed++;
          await prisma.deadLetterQueue.create({
            data: {
              provider: 'jikan',
              entityType: 'ANIME',
              externalId: String(currentId),
              error: err?.message || String(err),
            },
          }).catch(() => {});

          await prisma.syncCheckpoint.upsert({
            where: { provider_jobType: { provider: 'jikan', jobType } },
            update: {
              lastProcessedId: String(currentId),
              page: Math.floor(currentId / 25) + 1,
              processedCount: { increment: 1 },
              failedCount: { increment: 1 },
            },
            create: {
              syncJobId: job.id,
              provider: 'jikan',
              jobType,
              lastProcessedId: String(currentId),
              page: Math.floor(currentId / 25) + 1,
              processedCount: 1,
              failedCount: 1,
            },
          });
        }

        idsAttempted++;
        currentId++;
      }

      if (currentId > endId) reachedEnd = true;

      await prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: reachedEnd ? 'COMPLETED' : 'PAUSED',
          processedCount: { increment: idsAttempted },
          createdCount: { increment: created },
          updatedCount: { increment: updated },
          failedCount: { increment: notFound + failed },
          page: Math.floor(currentId / 25) + 1,
          completedAt: reachedEnd ? new Date() : undefined,
        },
      });

      return { success: true, doneToId: currentId - 1, reachedEnd, processed, created, updated, notFound, failed };
    } finally {
      this.releaseLock(lockKey);
    }
  }
}

export const syncEngine = new SyncEngine();
