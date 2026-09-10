-- CreateTable
CREATE TABLE "Anime" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalSource" TEXT NOT NULL DEFAULT 'anilist',
    "externalId" TEXT,
    "malId" INTEGER,
    "anilistId" INTEGER,
    "slug" TEXT NOT NULL,
    "canonicalTitle" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL,
    "background" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TV',
    "source" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Finished',
    "country" TEXT DEFAULT 'JP',
    "isAdult" BOOLEAN NOT NULL DEFAULT false,
    "episodes" INTEGER,
    "duration" TEXT,
    "rating" TEXT,
    "airedFrom" DATETIME,
    "airedTo" DATETIME,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "startYear" INTEGER,
    "startMonth" INTEGER,
    "startDay" INTEGER,
    "endYear" INTEGER,
    "endMonth" INTEGER,
    "endDay" INTEGER,
    "datePrecision" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "season" TEXT,
    "seasonYear" INTEGER,
    "year" INTEGER,
    "broadcastDay" TEXT,
    "broadcastTime" TEXT,
    "broadcastTimezone" TEXT,
    "nextAiringEpisode" INTEGER,
    "nextAiringAt" DATETIME,
    "timeUntilAiring" INTEGER,
    "score" REAL,
    "scoredBy" INTEGER DEFAULT 0,
    "rank" INTEGER,
    "popularity" INTEGER,
    "members" INTEGER DEFAULT 0,
    "favoritesCount" INTEGER DEFAULT 0,
    "posterUrl" TEXT NOT NULL,
    "largePosterUrl" TEXT,
    "bannerUrl" TEXT,
    "trailerUrl" TEXT,
    "metadataHash" TEXT,
    "dataCompletenessScore" REAL DEFAULT 0.0,
    "firstImportedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AnimeExternalId" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnimeExternalId_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnimeTitle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "language" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "searchableTitle" TEXT,
    CONSTRAINT "AnimeTitle_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "externalId" TEXT,
    "number" REAL NOT NULL DEFAULT 1.0,
    "title" TEXT,
    "titleJapanese" TEXT,
    "synopsis" TEXT,
    "airedAt" DATETIME,
    "duration" TEXT,
    "filler" BOOLEAN NOT NULL DEFAULT false,
    "recap" BOOLEAN NOT NULL DEFAULT false,
    "imageUrl" TEXT,
    "externalUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Episode_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AnimeGenre" (
    "animeId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,

    PRIMARY KEY ("animeId", "genreId"),
    CONSTRAINT "AnimeGenre_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnimeGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AnimeTheme" (
    "animeId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,

    PRIMARY KEY ("animeId", "themeId"),
    CONSTRAINT "AnimeTheme_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnimeTheme_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnimeTag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rank" INTEGER DEFAULT 0,
    "isMediaSpoiler" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'anilist',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnimeTag_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Studio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "externalSource" TEXT,
    "name" TEXT NOT NULL,
    "nativeName" TEXT,
    "romanizedName" TEXT,
    "alternativeNamesJson" TEXT,
    "slug" TEXT,
    "about" TEXT,
    "shortDescription" TEXT,
    "descriptionSource" TEXT NOT NULL DEFAULT 'EDITORIAL',
    "foundedDate" DATETIME,
    "foundedYear" INTEGER,
    "dissolvedDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "country" TEXT DEFAULT 'Japan',
    "region" TEXT,
    "city" TEXT,
    "website" TEXT,
    "wikipediaUrl" TEXT,
    "twitterUrl" TEXT,
    "youtubeUrl" TEXT,
    "externalLinksJson" TEXT,
    "imageUrl" TEXT,
    "bannerUrl" TEXT,
    "logoAssetId" TEXT,
    "bannerAssetId" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "publicationState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "adminOverrideName" TEXT,
    "adminOverrideDescription" TEXT,
    "adminOverrideFoundedYear" INTEGER,
    "adminOverrideImageUrl" TEXT,
    "adminOverrideWebsite" TEXT,
    "hasAdminOverride" BOOLEAN NOT NULL DEFAULT false,
    "adminNotes" TEXT,
    "metadataJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AnimeStudio" (
    "animeId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MAIN_STUDIO',
    "isMain" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "productionStatus" TEXT DEFAULT 'COMPLETED',
    "source" TEXT DEFAULT 'CANONICAL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("animeId", "studioId"),
    CONSTRAINT "AnimeStudio_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnimeStudio_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudioPerson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studioId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "tenureStartYear" INTEGER,
    "tenureEndYear" INTEGER,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudioPerson_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudioPerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudioRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentStudioId" TEXT NOT NULL,
    "childStudioId" TEXT NOT NULL,
    "relationshipType" TEXT NOT NULL,
    "establishedYear" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudioRelationship_parentStudioId_fkey" FOREIGN KEY ("parentStudioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudioRelationship_childStudioId_fkey" FOREIGN KEY ("childStudioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudioEra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studioId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATETIME,
    "startYear" INTEGER,
    "endDate" DATETIME,
    "endYear" INTEGER,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudioEra_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudioHistoryEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studioId" TEXT NOT NULL,
    "eraId" TEXT,
    "title" TEXT NOT NULL,
    "shortDescription" TEXT,
    "fullDescription" TEXT,
    "eventDate" DATETIME,
    "eventYear" INTEGER,
    "eventEndDate" DATETIME,
    "eventEndYear" INTEGER,
    "eventType" TEXT NOT NULL DEFAULT 'MILESTONE',
    "importance" TEXT NOT NULL DEFAULT 'NORMAL',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "imageCaption" TEXT,
    "imageAltText" TEXT,
    "personId" TEXT,
    "animeId" TEXT,
    "relatedStudioId" TEXT,
    "source" TEXT,
    "sourceUrl" TEXT,
    "sourceType" TEXT NOT NULL DEFAULT 'OFFICIAL',
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "publicationState" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudioHistoryEvent_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudioHistoryEvent_eraId_fkey" FOREIGN KEY ("eraId") REFERENCES "StudioEra" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudioHistoryEvent_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudioHistoryEvent_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StudioHistoryEvent_relatedStudioId_fkey" FOREIGN KEY ("relatedStudioId") REFERENCES "Studio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudioAuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studioId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValues" TEXT,
    "newValues" TEXT,
    "reason" TEXT,
    "ipAddress" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudioAuditLog_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudioAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudioVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studioId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "authorId" TEXT NOT NULL,
    "snapshotJson" TEXT NOT NULL,
    "changesSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudioVersion_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudioVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudioMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studioId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "assetId" TEXT,
    "source" TEXT,
    "attribution" TEXT,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "uploadedById" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StudioMedia_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudioMedia_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudioAnalyticsSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studioId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "metricVersion" TEXT NOT NULL DEFAULT 'v1',
    "projectCount" INTEGER NOT NULL DEFAULT 0,
    "averageScore" REAL,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "watchCount" INTEGER NOT NULL DEFAULT 0,
    "completionCount" INTEGER NOT NULL DEFAULT 0,
    "communityActivity" INTEGER NOT NULL DEFAULT 0,
    "newsActivity" INTEGER NOT NULL DEFAULT 0,
    "momentumScore" REAL NOT NULL DEFAULT 0.0,
    "snapshotDataJson" TEXT NOT NULL,
    "generatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudioAnalyticsSnapshot_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudioAlias" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "studioId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalizedAlias" TEXT NOT NULL,
    "language" TEXT DEFAULT 'en',
    "aliasType" TEXT NOT NULL DEFAULT 'ALTERNATIVE',
    "source" TEXT DEFAULT 'MANUAL',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudioAlias_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudioMerge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canonicalStudioId" TEXT NOT NULL,
    "mergedStudioId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "reason" TEXT,
    "confidenceScore" REAL NOT NULL DEFAULT 1.0,
    "relationshipsMigratedCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "rollbackAvailable" BOOLEAN NOT NULL DEFAULT true,
    "snapshotDataJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudioMerge_canonicalStudioId_fkey" FOREIGN KEY ("canonicalStudioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudioMerge_mergedStudioId_fkey" FOREIGN KEY ("mergedStudioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StudioMerge_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StudioRedirect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceIdentifier" TEXT NOT NULL,
    "canonicalStudioId" TEXT NOT NULL,
    "redirectType" TEXT NOT NULL DEFAULT 'MERGE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StudioRedirect_canonicalStudioId_fkey" FOREIGN KEY ("canonicalStudioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Producer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "about" TEXT,
    "website" TEXT,
    "imageUrl" TEXT
);

-- CreateTable
CREATE TABLE "AnimeProducer" (
    "animeId" TEXT NOT NULL,
    "producerId" TEXT NOT NULL,

    PRIMARY KEY ("animeId", "producerId"),
    CONSTRAINT "AnimeProducer_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnimeProducer_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Licensor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AnimeLicensor" (
    "animeId" TEXT NOT NULL,
    "licensorId" TEXT NOT NULL,

    PRIMARY KEY ("animeId", "licensorId"),
    CONSTRAINT "AnimeLicensor_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnimeLicensor_licensorId_fkey" FOREIGN KEY ("licensorId") REFERENCES "Licensor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "nameKanji" TEXT,
    "about" TEXT,
    "birthday" TEXT,
    "website" TEXT,
    "imageUrl" TEXT
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT,
    "nameKanji" TEXT,
    "about" TEXT,
    "imageUrl" TEXT
);

-- CreateTable
CREATE TABLE "AnimeCharacter" (
    "animeId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Main',

    PRIMARY KEY ("animeId", "characterId"),
    CONSTRAINT "AnimeCharacter_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnimeCharacter_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterVoiceActor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "characterId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'Japanese',
    CONSTRAINT "CharacterVoiceActor_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterVoiceActor_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnimeStaff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    CONSTRAINT "AnimeStaff_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnimeStaff_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnimeRelation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceAnimeId" TEXT NOT NULL,
    "targetAnimeId" TEXT NOT NULL,
    "relationType" TEXT NOT NULL,
    CONSTRAINT "AnimeRelation_sourceAnimeId_fkey" FOREIGN KEY ("sourceAnimeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnimeRelation_targetAnimeId_fkey" FOREIGN KEY ("targetAnimeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Franchise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FranchiseAnime" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "franchiseId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "relationship" TEXT NOT NULL DEFAULT 'MAIN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FranchiseAnime_franchiseId_fkey" FOREIGN KEY ("franchiseId") REFERENCES "Franchise" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FranchiseAnime_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnimeVideo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "externalId" TEXT,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'Trailer',
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    CONSTRAINT "AnimeVideo_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AiringSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "episodeId" TEXT,
    "episode" INTEGER NOT NULL,
    "airingAt" DATETIME NOT NULL,
    "releaseType" TEXT NOT NULL DEFAULT 'BROADCAST',
    "timezone" TEXT,
    "scheduleStatus" TEXT NOT NULL DEFAULT 'UPCOMING',
    "timeUntilAiring" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'anilist',
    "externalScheduleId" TEXT,
    "lastVerifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiringSchedule_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AiringSchedule_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExternalAnimeStats" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'mal',
    "malScore" REAL,
    "malScoredBy" INTEGER DEFAULT 0,
    "malRank" INTEGER,
    "malPopularity" INTEGER,
    "malMembers" INTEGER DEFAULT 0,
    "malFavorites" INTEGER DEFAULT 0,
    "anilistScore" INTEGER,
    "anilistPopularity" INTEGER,
    "anilistFavorites" INTEGER,
    "watching" INTEGER NOT NULL DEFAULT 0,
    "completed" INTEGER NOT NULL DEFAULT 0,
    "onHold" INTEGER NOT NULL DEFAULT 0,
    "dropped" INTEGER NOT NULL DEFAULT 0,
    "planToWatch" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "score1" INTEGER NOT NULL DEFAULT 0,
    "score2" INTEGER NOT NULL DEFAULT 0,
    "score3" INTEGER NOT NULL DEFAULT 0,
    "score4" INTEGER NOT NULL DEFAULT 0,
    "score5" INTEGER NOT NULL DEFAULT 0,
    "score6" INTEGER NOT NULL DEFAULT 0,
    "score7" INTEGER NOT NULL DEFAULT 0,
    "score8" INTEGER NOT NULL DEFAULT 0,
    "score9" INTEGER NOT NULL DEFAULT 0,
    "score10" INTEGER NOT NULL DEFAULT 0,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExternalAnimeStats_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL DEFAULT 'anilist',
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "totalItems" INTEGER DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "cursor" TEXT,
    "page" INTEGER DEFAULT 1,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SyncCheckpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "syncJobId" TEXT,
    "provider" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,
    "cursor" TEXT,
    "lastProcessedId" TEXT,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SyncCheckpoint_syncJobId_fkey" FOREIGN KEY ("syncJobId") REFERENCES "SyncJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DataSourceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "sourceVersion" TEXT,
    "rawHash" TEXT,
    "payload" TEXT,
    "retrievedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastVerifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DataConflict" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL DEFAULT 'ANIME',
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "providerA" TEXT NOT NULL,
    "valueA" TEXT NOT NULL,
    "providerB" TEXT NOT NULL,
    "valueB" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataConflict_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EditorialOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT NOT NULL,
    "approvedAt" DATETIME,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DataCorrectionRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'ANIME',
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "currentValue" TEXT,
    "suggestedValue" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DataCorrectionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnimeMetadataHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "source" TEXT NOT NULL DEFAULT 'sync',
    "changedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnimeMetadataHistory_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "beforeJson" TEXT,
    "afterJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserAnime" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "episodesWatched" INTEGER NOT NULL DEFAULT 0,
    "score" REAL,
    "notes" TEXT,
    "startDate" DATETIME,
    "finishDate" DATETIME,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserAnime_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserAnime_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserEpisodeProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "episodeNumber" REAL NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "watchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserEpisodeProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserEpisodeProgress_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserEpisodeProgress_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnimeRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "rating" REAL NOT NULL,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnimeRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AnimeRating_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RatingCategoryScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ratingId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RatingCategoryScore_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "AnimeRating" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RatingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ratingId" TEXT,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "previousScore" REAL,
    "newScore" REAL NOT NULL,
    "eventType" TEXT NOT NULL,
    "categoryScoresJson" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RatingEvent_ratingId_fkey" FOREIGN KEY ("ratingId") REFERENCES "AnimeRating" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RatingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RatingEvent_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RatingAggregate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "rawAverage" REAL,
    "medianScore" REAL,
    "bayesianScore" REAL,
    "variance" REAL,
    "standardDeviation" REAL,
    "confidence" TEXT NOT NULL DEFAULT 'NO_DATA',
    "distributionJson" TEXT,
    "algorithmVersion" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RatingAggregate_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RatingCategoryAggregate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "responseCount" INTEGER NOT NULL DEFAULT 0,
    "averageScore" REAL,
    "medianScore" REAL,
    "variance" REAL,
    "standardDeviation" REAL,
    "percentageShare" REAL,
    "confidence" TEXT NOT NULL DEFAULT 'NO_DATA',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RatingCategoryAggregate_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RatingRiskSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "riskScore" REAL NOT NULL DEFAULT 0.0,
    "signalType" TEXT NOT NULL,
    "detailsJson" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RatingRiskSignal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RatingRiskSignal_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EpisodeRating" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "rating" REAL NOT NULL,
    "review" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EpisodeRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EpisodeRating_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Favorite_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "episodeId" TEXT,
    "seasonId" TEXT,
    "ratingId" TEXT,
    "reviewType" TEXT NOT NULL DEFAULT 'ANIME_REVIEW',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 8,
    "containsSpoiler" BOOLEAN NOT NULL DEFAULT false,
    "likesCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "language" TEXT NOT NULL DEFAULT 'en',
    "languageConfidence" REAL NOT NULL DEFAULT 1.0,
    "overallSentiment" TEXT NOT NULL DEFAULT 'POSITIVE',
    "sentimentConfidence" REAL NOT NULL DEFAULT 1.0,
    "analysisModelVersion" INTEGER NOT NULL DEFAULT 1,
    "analysisStatus" TEXT NOT NULL DEFAULT 'COMPLETED',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewLike" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reactionType" TEXT NOT NULL DEFAULT 'HELPFUL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewLike_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewReport" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewReport_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReviewReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Community" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "iconUrl" TEXT,
    "iconSource" TEXT DEFAULT 'URL',
    "bannerUrl" TEXT,
    "bannerSource" TEXT DEFAULT 'URL',
    "category" TEXT NOT NULL DEFAULT 'ANIME',
    "communityType" TEXT NOT NULL DEFAULT 'GENERAL',
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "joinPolicy" TEXT NOT NULL DEFAULT 'OPEN',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "memberCount" INTEGER NOT NULL DEFAULT 1,
    "animeId" TEXT,
    "studioId" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Community_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Community_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Community_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "creatorVerified" BOOLEAN NOT NULL DEFAULT false,
    "verificationProvider" TEXT,
    "mutedUntil" DATETIME,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityMember_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    CONSTRAINT "CommunityRule_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXT',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommunityChannel_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityJoinRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    CONSTRAINT "CommunityJoinRequest_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityJoinRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityBan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME,
    CONSTRAINT "CommunityBan_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityBan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "communityId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "maxUses" INTEGER,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" DATETIME,
    CONSTRAINT "CommunityInvite_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Discussion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "authorId" TEXT NOT NULL DEFAULT 'user_default',
    "animeId" TEXT,
    "episodeId" TEXT,
    "communityId" TEXT,
    "channelId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "spoilerLevel" TEXT NOT NULL DEFAULT 'NO_SPOILER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Discussion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Discussion_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Discussion_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Discussion_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Discussion_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "CommunityChannel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiscussionPoll" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discussionId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "expiresAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscussionPoll_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "Discussion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PollOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pollId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PollOption_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "DiscussionPoll" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "optionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PollVote_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "PollOption" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PollVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiscussionComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discussionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL DEFAULT 'user_default',
    "parentId" TEXT,
    "body" TEXT NOT NULL,
    "spoilerLevel" TEXT NOT NULL DEFAULT 'NO_SPOILER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "DiscussionComment_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "Discussion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DiscussionComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DiscussionComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DiscussionComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiscussionFollower" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discussionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscussionFollower_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "Discussion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DiscussionFollower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiscussionReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "discussionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'HELPFUL',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DiscussionReaction_discussionId_fkey" FOREIGN KEY ("discussionId") REFERENCES "Discussion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DiscussionReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommentReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LIKE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommentReaction_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "DiscussionComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommentReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CommunityMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channelId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL DEFAULT 'user_default',
    "body" TEXT NOT NULL,
    "replyToId" TEXT,
    "spoilerLevel" TEXT NOT NULL DEFAULT 'NO_SPOILER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME,
    CONSTRAINT "CommunityMessage_channelId_fkey" FOREIGN KEY ("channelId") REFERENCES "CommunityChannel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommunityMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reporterId" TEXT NOT NULL DEFAULT 'user_default',
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "actionTaken" TEXT,
    "reviewedBy" TEXT,
    "reviewedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moderatorId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "communityId" TEXT,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ModerationAction_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserList" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'user_default',
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserListItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "listId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "UserList" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserListItem_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'user_default',
    "type" TEXT NOT NULL,
    "animeId" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Follow" (
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("followerId", "followingId"),
    CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL DEFAULT 'user_default',
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "linkUrl" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentWarning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT,
    "source" TEXT NOT NULL DEFAULT 'anilist',
    "provider" TEXT NOT NULL DEFAULT 'anilist',
    "lastVerifiedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentWarning_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "storedUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "format" TEXT,
    "lastVerifiedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaAsset_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnimeExternalLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnimeExternalLink_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DeadLetterQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "error" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "lastAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PotentialDuplicate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "primaryAnimeId" TEXT NOT NULL,
    "secondaryAnimeId" TEXT,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "similarityScore" REAL NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME
);

-- CreateTable
CREATE TABLE "ProviderPayload" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "provider" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "hash" TEXT,
    "retrievedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NewsProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'HEALTHY',
    "lastSuccessfulSync" DATETIME,
    "lastFailedSync" DATETIME,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NewsStoryCluster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topicTitle" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NewsArticle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "slug" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "contentType" TEXT NOT NULL DEFAULT 'SOURCE_METADATA',
    "sourceName" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "canonicalUrl" TEXT,
    "imageUrl" TEXT,
    "author" TEXT,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" TEXT NOT NULL DEFAULT 'ANIME',
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "moderationState" TEXT NOT NULL DEFAULT 'APPROVED',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "featuredPriority" INTEGER NOT NULL DEFAULT 0,
    "featuredUntil" DATETIME,
    "scheduledPublishAt" DATETIME,
    "deletedAt" DATETIME,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discoveredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "provider" TEXT NOT NULL DEFAULT 'ANN',
    "externalId" TEXT,
    "contentHash" TEXT,
    "ingestedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clusterId" TEXT,
    "adminOverrideTitle" TEXT,
    "adminOverrideSummary" TEXT,
    "adminOverrideCategory" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NewsArticle_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "NewsStoryCluster" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsArticleAnime" (
    "articleId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "confidenceScore" REAL NOT NULL DEFAULT 1.0,
    "matchMethod" TEXT NOT NULL DEFAULT 'EXACT_TITLE',
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "relationType" TEXT NOT NULL DEFAULT 'RELATED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("articleId", "animeId"),
    CONSTRAINT "NewsArticleAnime_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NewsArticleAnime_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsArticleStudio" (
    "articleId" TEXT NOT NULL,
    "studioId" TEXT NOT NULL,
    "confidenceScore" REAL NOT NULL DEFAULT 1.0,
    "matchMethod" TEXT NOT NULL DEFAULT 'EXACT_NAME',
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "relationType" TEXT NOT NULL DEFAULT 'PRODUCED_BY',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("articleId", "studioId"),
    CONSTRAINT "NewsArticleStudio_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NewsArticleStudio_studioId_fkey" FOREIGN KEY ("studioId") REFERENCES "Studio" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsArticlePerson" (
    "articleId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("articleId", "personId"),
    CONSTRAINT "NewsArticlePerson_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NewsArticlePerson_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsReviewQueue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "articleId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "matchedEntityId" TEXT,
    "confidenceScore" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    "reviewedBy" TEXT,
    CONSTRAINT "NewsReviewQueue_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NewsIngestionJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerSlug" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "articlesFetched" INTEGER NOT NULL DEFAULT 0,
    "articlesCreated" INTEGER NOT NULL DEFAULT 0,
    "articlesUpdated" INTEGER NOT NULL DEFAULT 0,
    "duplicatesCount" INTEGER NOT NULL DEFAULT 0,
    "matchesCreated" INTEGER NOT NULL DEFAULT 0,
    "reviewRequired" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'DIRECT',
    "title" TEXT,
    "avatarUrl" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "lastReadAt" DATETIME,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isMuted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'TEXT',
    "mediaUrl" TEXT,
    "replyToId" TEXT,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageReaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MessageReaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReviewAspect" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "aspect" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "sentimentScore" REAL NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "snippetsJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReviewAspect_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnimeCommunityOpinion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "overallSentiment" TEXT NOT NULL DEFAULT 'POSITIVE',
    "storyScore" REAL,
    "animationScore" REAL,
    "charactersScore" REAL,
    "musicScore" REAL,
    "directionScore" REAL,
    "pacingScore" REAL,
    "worldBuildingScore" REAL,
    "enjoymentScore" REAL,
    "positivePercentage" REAL NOT NULL DEFAULT 0.0,
    "mixedPercentage" REAL NOT NULL DEFAULT 0.0,
    "negativePercentage" REAL NOT NULL DEFAULT 0.0,
    "frequentlyPraisedJson" TEXT,
    "frequentlyCriticizedJson" TEXT,
    "analyzedReviewCount" INTEGER NOT NULL DEFAULT 0,
    "confidence" TEXT NOT NULL DEFAULT 'NO_DATA',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnimeCommunityOpinion_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "metadata" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EventLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AnimeTrendMetric" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "interactionVolume" INTEGER NOT NULL DEFAULT 0,
    "interactionVelocity" REAL NOT NULL DEFAULT 0.0,
    "growthRatePercent" REAL NOT NULL DEFAULT 0.0,
    "momentumScore" REAL NOT NULL DEFAULT 0.0,
    "trendTier" TEXT NOT NULL DEFAULT 'POPULAR',
    "timeDecayScore" REAL NOT NULL DEFAULT 0.0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AnimeTrendMetric_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StreamingAvailability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "animeId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "region" TEXT NOT NULL DEFAULT 'GLOBAL',
    "availabilityType" TEXT NOT NULL DEFAULT 'SUBSCRIPTION',
    "url" TEXT,
    "source" TEXT NOT NULL DEFAULT 'OFFICIAL',
    "lastVerifiedAt" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StreamingAvailability_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserTasteProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "profileVersion" INTEGER NOT NULL DEFAULT 1,
    "confidenceTier" TEXT NOT NULL DEFAULT 'NEW_USER',
    "overallConfidence" REAL NOT NULL DEFAULT 0.0,
    "totalSignalsCount" INTEGER NOT NULL DEFAULT 0,
    "topGenresJson" TEXT,
    "topThemesJson" TEXT,
    "topStudiosJson" TEXT,
    "aspectProfileJson" TEXT,
    "shortTermProfileJson" TEXT,
    "formatPreferencesJson" TEXT,
    "lengthPreferencesJson" TEXT,
    "seasonalityPreferencesJson" TEXT,
    "creatorPreferencesJson" TEXT,
    "derivedExplanationsJson" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserTasteProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserTasteSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "profileId" TEXT NOT NULL,
    "signalType" TEXT NOT NULL,
    "targetName" TEXT NOT NULL,
    "preferenceScore" REAL NOT NULL,
    "confidenceScore" REAL NOT NULL DEFAULT 0.0,
    "evidenceCount" INTEGER NOT NULL DEFAULT 1,
    "evidenceJson" TEXT,
    "lastUpdated" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserTasteSignal_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "UserTasteProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecommendationSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "algorithmVersion" INTEGER NOT NULL DEFAULT 1,
    "context" TEXT NOT NULL DEFAULT 'HOME',
    "targetAnimeId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecommendationItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "score" REAL NOT NULL,
    "source" TEXT NOT NULL,
    "reasonType" TEXT NOT NULL,
    "reasonText" TEXT NOT NULL,
    "reasonData" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DELIVERED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationItem_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecommendationSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecommendationItem_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecommendationFeedback" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "feedback" TEXT NOT NULL,
    "context" TEXT DEFAULT 'HOME',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecommendationFeedback_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EntityEmbedding" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "modelName" TEXT NOT NULL DEFAULT 'otakuva-semantic-v1',
    "modelVersion" TEXT NOT NULL DEFAULT 'v1',
    "dimension" INTEGER NOT NULL DEFAULT 64,
    "vectorJson" TEXT NOT NULL,
    "documentDigest" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ReviewAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reviewId" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "overallSentiment" TEXT NOT NULL,
    "sentimentScore" REAL NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "aspectsJson" TEXT NOT NULL,
    "topicsJson" TEXT,
    "summaryText" TEXT,
    "analysisModel" TEXT NOT NULL DEFAULT 'review-aspect-v1',
    "analysisVersion" TEXT NOT NULL DEFAULT 'v1',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReviewAnalysis_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserInterestCluster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "clusterIndex" INTEGER NOT NULL,
    "clusterLabel" TEXT NOT NULL,
    "weight" REAL NOT NULL DEFAULT 1.0,
    "genresJson" TEXT NOT NULL,
    "themesJson" TEXT NOT NULL,
    "vectorJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserInterestCluster_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModelRegistry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "modelName" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "featureVersion" TEXT NOT NULL DEFAULT 'v1',
    "metricsJson" TEXT,
    "configJson" TEXT,
    "trafficPercentage" INTEGER NOT NULL DEFAULT 0,
    "deployedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RecommendationPrediction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "animeId" TEXT NOT NULL,
    "predictionType" TEXT NOT NULL,
    "predictedProbability" REAL NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "featuresJson" TEXT,
    "outcomeRecorded" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationPrediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecommendationPrediction_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Anime_slug_key" ON "Anime"("slug");

-- CreateIndex
CREATE INDEX "Anime_year_season_idx" ON "Anime"("year", "season");

-- CreateIndex
CREATE INDEX "Anime_score_idx" ON "Anime"("score");

-- CreateIndex
CREATE INDEX "Anime_popularity_idx" ON "Anime"("popularity");

-- CreateIndex
CREATE INDEX "Anime_malId_idx" ON "Anime"("malId");

-- CreateIndex
CREATE INDEX "Anime_anilistId_idx" ON "Anime"("anilistId");

-- CreateIndex
CREATE INDEX "Anime_startYear_idx" ON "Anime"("startYear");

-- CreateIndex
CREATE INDEX "Anime_status_idx" ON "Anime"("status");

-- CreateIndex
CREATE INDEX "Anime_type_idx" ON "Anime"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Anime_externalSource_externalId_key" ON "Anime"("externalSource", "externalId");

-- CreateIndex
CREATE INDEX "AnimeExternalId_animeId_idx" ON "AnimeExternalId"("animeId");

-- CreateIndex
CREATE INDEX "AnimeExternalId_provider_externalId_idx" ON "AnimeExternalId"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeExternalId_provider_externalId_key" ON "AnimeExternalId"("provider", "externalId");

-- CreateIndex
CREATE INDEX "AnimeTitle_animeId_idx" ON "AnimeTitle"("animeId");

-- CreateIndex
CREATE INDEX "AnimeTitle_title_idx" ON "AnimeTitle"("title");

-- CreateIndex
CREATE INDEX "AnimeTitle_searchableTitle_idx" ON "AnimeTitle"("searchableTitle");

-- CreateIndex
CREATE INDEX "Episode_animeId_idx" ON "Episode"("animeId");

-- CreateIndex
CREATE UNIQUE INDEX "Episode_animeId_number_key" ON "Episode"("animeId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_name_key" ON "Genre"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_slug_key" ON "Genre"("slug");

-- CreateIndex
CREATE INDEX "AnimeGenre_genreId_idx" ON "AnimeGenre"("genreId");

-- CreateIndex
CREATE UNIQUE INDEX "Theme_name_key" ON "Theme"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Theme_slug_key" ON "Theme"("slug");

-- CreateIndex
CREATE INDEX "AnimeTheme_themeId_idx" ON "AnimeTheme"("themeId");

-- CreateIndex
CREATE INDEX "AnimeTag_animeId_idx" ON "AnimeTag"("animeId");

-- CreateIndex
CREATE INDEX "AnimeTag_name_idx" ON "AnimeTag"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeTag_animeId_name_key" ON "AnimeTag"("animeId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_name_key" ON "Studio"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Studio_slug_key" ON "Studio"("slug");

-- CreateIndex
CREATE INDEX "Studio_slug_idx" ON "Studio"("slug");

-- CreateIndex
CREATE INDEX "Studio_status_idx" ON "Studio"("status");

-- CreateIndex
CREATE INDEX "Studio_verificationStatus_idx" ON "Studio"("verificationStatus");

-- CreateIndex
CREATE INDEX "Studio_publicationState_idx" ON "Studio"("publicationState");

-- CreateIndex
CREATE INDEX "Studio_foundedYear_idx" ON "Studio"("foundedYear");

-- CreateIndex
CREATE INDEX "AnimeStudio_studioId_idx" ON "AnimeStudio"("studioId");

-- CreateIndex
CREATE INDEX "AnimeStudio_animeId_idx" ON "AnimeStudio"("animeId");

-- CreateIndex
CREATE INDEX "AnimeStudio_isPrimary_idx" ON "AnimeStudio"("isPrimary");

-- CreateIndex
CREATE INDEX "StudioPerson_studioId_idx" ON "StudioPerson"("studioId");

-- CreateIndex
CREATE INDEX "StudioPerson_personId_idx" ON "StudioPerson"("personId");

-- CreateIndex
CREATE INDEX "StudioPerson_role_idx" ON "StudioPerson"("role");

-- CreateIndex
CREATE UNIQUE INDEX "StudioPerson_studioId_personId_role_key" ON "StudioPerson"("studioId", "personId", "role");

-- CreateIndex
CREATE INDEX "StudioRelationship_parentStudioId_idx" ON "StudioRelationship"("parentStudioId");

-- CreateIndex
CREATE INDEX "StudioRelationship_childStudioId_idx" ON "StudioRelationship"("childStudioId");

-- CreateIndex
CREATE UNIQUE INDEX "StudioRelationship_parentStudioId_childStudioId_relationshipType_key" ON "StudioRelationship"("parentStudioId", "childStudioId", "relationshipType");

-- CreateIndex
CREATE INDEX "StudioEra_studioId_displayOrder_idx" ON "StudioEra"("studioId", "displayOrder");

-- CreateIndex
CREATE INDEX "StudioHistoryEvent_studioId_eventYear_displayOrder_idx" ON "StudioHistoryEvent"("studioId", "eventYear", "displayOrder");

-- CreateIndex
CREATE INDEX "StudioHistoryEvent_studioId_publicationState_idx" ON "StudioHistoryEvent"("studioId", "publicationState");

-- CreateIndex
CREATE INDEX "StudioHistoryEvent_studioId_importance_idx" ON "StudioHistoryEvent"("studioId", "importance");

-- CreateIndex
CREATE INDEX "StudioHistoryEvent_studioId_eventType_idx" ON "StudioHistoryEvent"("studioId", "eventType");

-- CreateIndex
CREATE INDEX "StudioHistoryEvent_animeId_idx" ON "StudioHistoryEvent"("animeId");

-- CreateIndex
CREATE INDEX "StudioHistoryEvent_personId_idx" ON "StudioHistoryEvent"("personId");

-- CreateIndex
CREATE INDEX "StudioAuditLog_studioId_createdAt_idx" ON "StudioAuditLog"("studioId", "createdAt");

-- CreateIndex
CREATE INDEX "StudioAuditLog_actorId_idx" ON "StudioAuditLog"("actorId");

-- CreateIndex
CREATE INDEX "StudioAuditLog_action_idx" ON "StudioAuditLog"("action");

-- CreateIndex
CREATE INDEX "StudioVersion_studioId_idx" ON "StudioVersion"("studioId");

-- CreateIndex
CREATE INDEX "StudioVersion_authorId_idx" ON "StudioVersion"("authorId");

-- CreateIndex
CREATE UNIQUE INDEX "StudioVersion_studioId_versionNumber_key" ON "StudioVersion"("studioId", "versionNumber");

-- CreateIndex
CREATE INDEX "StudioMedia_studioId_idx" ON "StudioMedia"("studioId");

-- CreateIndex
CREATE INDEX "StudioMedia_mediaType_idx" ON "StudioMedia"("mediaType");

-- CreateIndex
CREATE INDEX "StudioMedia_status_idx" ON "StudioMedia"("status");

-- CreateIndex
CREATE INDEX "StudioAnalyticsSnapshot_studioId_idx" ON "StudioAnalyticsSnapshot"("studioId");

-- CreateIndex
CREATE INDEX "StudioAnalyticsSnapshot_period_idx" ON "StudioAnalyticsSnapshot"("period");

-- CreateIndex
CREATE INDEX "StudioAnalyticsSnapshot_generatedAt_idx" ON "StudioAnalyticsSnapshot"("generatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StudioAnalyticsSnapshot_studioId_period_metricVersion_key" ON "StudioAnalyticsSnapshot"("studioId", "period", "metricVersion");

-- CreateIndex
CREATE INDEX "StudioAlias_normalizedAlias_idx" ON "StudioAlias"("normalizedAlias");

-- CreateIndex
CREATE INDEX "StudioAlias_studioId_idx" ON "StudioAlias"("studioId");

-- CreateIndex
CREATE INDEX "StudioAlias_aliasType_idx" ON "StudioAlias"("aliasType");

-- CreateIndex
CREATE UNIQUE INDEX "StudioAlias_studioId_normalizedAlias_key" ON "StudioAlias"("studioId", "normalizedAlias");

-- CreateIndex
CREATE INDEX "StudioMerge_canonicalStudioId_idx" ON "StudioMerge"("canonicalStudioId");

-- CreateIndex
CREATE INDEX "StudioMerge_mergedStudioId_idx" ON "StudioMerge"("mergedStudioId");

-- CreateIndex
CREATE INDEX "StudioMerge_initiatedById_idx" ON "StudioMerge"("initiatedById");

-- CreateIndex
CREATE INDEX "StudioMerge_status_idx" ON "StudioMerge"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StudioRedirect_sourceIdentifier_key" ON "StudioRedirect"("sourceIdentifier");

-- CreateIndex
CREATE INDEX "StudioRedirect_sourceIdentifier_idx" ON "StudioRedirect"("sourceIdentifier");

-- CreateIndex
CREATE INDEX "StudioRedirect_canonicalStudioId_idx" ON "StudioRedirect"("canonicalStudioId");

-- CreateIndex
CREATE UNIQUE INDEX "Producer_name_key" ON "Producer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Producer_slug_key" ON "Producer"("slug");

-- CreateIndex
CREATE INDEX "AnimeProducer_producerId_idx" ON "AnimeProducer"("producerId");

-- CreateIndex
CREATE UNIQUE INDEX "Licensor_name_key" ON "Licensor"("name");

-- CreateIndex
CREATE INDEX "AnimeLicensor_licensorId_idx" ON "AnimeLicensor"("licensorId");

-- CreateIndex
CREATE UNIQUE INDEX "Person_slug_key" ON "Person"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Character_slug_key" ON "Character"("slug");

-- CreateIndex
CREATE INDEX "AnimeCharacter_characterId_idx" ON "AnimeCharacter"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterVoiceActor_characterId_personId_language_key" ON "CharacterVoiceActor"("characterId", "personId", "language");

-- CreateIndex
CREATE INDEX "AnimeStaff_animeId_idx" ON "AnimeStaff"("animeId");

-- CreateIndex
CREATE INDEX "AnimeStaff_personId_idx" ON "AnimeStaff"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeRelation_sourceAnimeId_targetAnimeId_relationType_key" ON "AnimeRelation"("sourceAnimeId", "targetAnimeId", "relationType");

-- CreateIndex
CREATE UNIQUE INDEX "Franchise_name_key" ON "Franchise"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Franchise_slug_key" ON "Franchise"("slug");

-- CreateIndex
CREATE INDEX "FranchiseAnime_franchiseId_position_idx" ON "FranchiseAnime"("franchiseId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "FranchiseAnime_franchiseId_animeId_key" ON "FranchiseAnime"("franchiseId", "animeId");

-- CreateIndex
CREATE INDEX "AnimeVideo_animeId_idx" ON "AnimeVideo"("animeId");

-- CreateIndex
CREATE INDEX "AiringSchedule_airingAt_idx" ON "AiringSchedule"("airingAt");

-- CreateIndex
CREATE INDEX "AiringSchedule_animeId_airingAt_idx" ON "AiringSchedule"("animeId", "airingAt");

-- CreateIndex
CREATE INDEX "AiringSchedule_episodeId_airingAt_idx" ON "AiringSchedule"("episodeId", "airingAt");

-- CreateIndex
CREATE INDEX "AiringSchedule_source_externalScheduleId_idx" ON "AiringSchedule"("source", "externalScheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "AiringSchedule_animeId_episode_key" ON "AiringSchedule"("animeId", "episode");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalAnimeStats_animeId_key" ON "ExternalAnimeStats"("animeId");

-- CreateIndex
CREATE INDEX "SyncJob_provider_jobType_idx" ON "SyncJob"("provider", "jobType");

-- CreateIndex
CREATE INDEX "SyncJob_status_idx" ON "SyncJob"("status");

-- CreateIndex
CREATE INDEX "SyncCheckpoint_provider_jobType_idx" ON "SyncCheckpoint"("provider", "jobType");

-- CreateIndex
CREATE UNIQUE INDEX "SyncCheckpoint_provider_jobType_key" ON "SyncCheckpoint"("provider", "jobType");

-- CreateIndex
CREATE INDEX "DataSourceRecord_provider_externalId_idx" ON "DataSourceRecord"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "DataSourceRecord_entityType_entityId_provider_key" ON "DataSourceRecord"("entityType", "entityId", "provider");

-- CreateIndex
CREATE INDEX "DataConflict_entityId_field_idx" ON "DataConflict"("entityId", "field");

-- CreateIndex
CREATE INDEX "DataConflict_status_idx" ON "DataConflict"("status");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialOverride_entityType_entityId_field_key" ON "EditorialOverride"("entityType", "entityId", "field");

-- CreateIndex
CREATE INDEX "DataCorrectionRequest_entityId_status_idx" ON "DataCorrectionRequest"("entityId", "status");

-- CreateIndex
CREATE INDEX "DataCorrectionRequest_userId_idx" ON "DataCorrectionRequest"("userId");

-- CreateIndex
CREATE INDEX "AnimeMetadataHistory_animeId_idx" ON "AnimeMetadataHistory"("animeId");

-- CreateIndex
CREATE INDEX "AnimeMetadataHistory_changedAt_idx" ON "AnimeMetadataHistory"("changedAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "UserAnime_userId_status_idx" ON "UserAnime"("userId", "status");

-- CreateIndex
CREATE INDEX "UserAnime_animeId_idx" ON "UserAnime"("animeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserAnime_userId_animeId_key" ON "UserAnime"("userId", "animeId");

-- CreateIndex
CREATE INDEX "UserEpisodeProgress_userId_animeId_idx" ON "UserEpisodeProgress"("userId", "animeId");

-- CreateIndex
CREATE INDEX "UserEpisodeProgress_userId_status_idx" ON "UserEpisodeProgress"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UserEpisodeProgress_userId_episodeId_key" ON "UserEpisodeProgress"("userId", "episodeId");

-- CreateIndex
CREATE INDEX "AnimeRating_animeId_idx" ON "AnimeRating"("animeId");

-- CreateIndex
CREATE INDEX "AnimeRating_userId_idx" ON "AnimeRating"("userId");

-- CreateIndex
CREATE INDEX "AnimeRating_deletedAt_idx" ON "AnimeRating"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeRating_userId_animeId_key" ON "AnimeRating"("userId", "animeId");

-- CreateIndex
CREATE INDEX "RatingCategoryScore_category_score_idx" ON "RatingCategoryScore"("category", "score");

-- CreateIndex
CREATE INDEX "RatingCategoryScore_ratingId_idx" ON "RatingCategoryScore"("ratingId");

-- CreateIndex
CREATE UNIQUE INDEX "RatingCategoryScore_ratingId_category_key" ON "RatingCategoryScore"("ratingId", "category");

-- CreateIndex
CREATE INDEX "RatingEvent_animeId_createdAt_idx" ON "RatingEvent"("animeId", "createdAt");

-- CreateIndex
CREATE INDEX "RatingEvent_userId_idx" ON "RatingEvent"("userId");

-- CreateIndex
CREATE INDEX "RatingEvent_eventType_idx" ON "RatingEvent"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "RatingAggregate_animeId_key" ON "RatingAggregate"("animeId");

-- CreateIndex
CREATE INDEX "RatingAggregate_bayesianScore_idx" ON "RatingAggregate"("bayesianScore");

-- CreateIndex
CREATE INDEX "RatingAggregate_ratingCount_idx" ON "RatingAggregate"("ratingCount");

-- CreateIndex
CREATE INDEX "RatingCategoryAggregate_animeId_idx" ON "RatingCategoryAggregate"("animeId");

-- CreateIndex
CREATE INDEX "RatingCategoryAggregate_category_idx" ON "RatingCategoryAggregate"("category");

-- CreateIndex
CREATE UNIQUE INDEX "RatingCategoryAggregate_animeId_category_key" ON "RatingCategoryAggregate"("animeId", "category");

-- CreateIndex
CREATE INDEX "RatingRiskSignal_status_idx" ON "RatingRiskSignal"("status");

-- CreateIndex
CREATE INDEX "RatingRiskSignal_animeId_idx" ON "RatingRiskSignal"("animeId");

-- CreateIndex
CREATE INDEX "RatingRiskSignal_userId_idx" ON "RatingRiskSignal"("userId");

-- CreateIndex
CREATE INDEX "EpisodeRating_episodeId_idx" ON "EpisodeRating"("episodeId");

-- CreateIndex
CREATE UNIQUE INDEX "EpisodeRating_userId_episodeId_key" ON "EpisodeRating"("userId", "episodeId");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_animeId_key" ON "Favorite"("userId", "animeId");

-- CreateIndex
CREATE INDEX "Review_animeId_idx" ON "Review"("animeId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE INDEX "Review_episodeId_idx" ON "Review"("episodeId");

-- CreateIndex
CREATE INDEX "Review_status_idx" ON "Review"("status");

-- CreateIndex
CREATE INDEX "Review_createdAt_idx" ON "Review"("createdAt");

-- CreateIndex
CREATE INDEX "ReviewLike_reviewId_idx" ON "ReviewLike"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewLike_reviewId_userId_key" ON "ReviewLike"("reviewId", "userId");

-- CreateIndex
CREATE INDEX "ReviewReport_status_idx" ON "ReviewReport"("status");

-- CreateIndex
CREATE INDEX "ReviewReport_reviewId_idx" ON "ReviewReport"("reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewReport_reviewId_userId_key" ON "ReviewReport"("reviewId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Community_slug_key" ON "Community"("slug");

-- CreateIndex
CREATE INDEX "Community_category_idx" ON "Community"("category");

-- CreateIndex
CREATE INDEX "Community_visibility_idx" ON "Community"("visibility");

-- CreateIndex
CREATE INDEX "Community_communityType_idx" ON "Community"("communityType");

-- CreateIndex
CREATE INDEX "Community_studioId_idx" ON "Community"("studioId");

-- CreateIndex
CREATE INDEX "Community_status_idx" ON "Community"("status");

-- CreateIndex
CREATE INDEX "Community_memberCount_idx" ON "Community"("memberCount");

-- CreateIndex
CREATE INDEX "Community_createdAt_idx" ON "Community"("createdAt");

-- CreateIndex
CREATE INDEX "CommunityMember_communityId_role_idx" ON "CommunityMember"("communityId", "role");

-- CreateIndex
CREATE INDEX "CommunityMember_userId_status_idx" ON "CommunityMember"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityMember_communityId_userId_key" ON "CommunityMember"("communityId", "userId");

-- CreateIndex
CREATE INDEX "CommunityRule_communityId_position_idx" ON "CommunityRule"("communityId", "position");

-- CreateIndex
CREATE INDEX "CommunityChannel_communityId_position_idx" ON "CommunityChannel"("communityId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityChannel_communityId_slug_key" ON "CommunityChannel"("communityId", "slug");

-- CreateIndex
CREATE INDEX "CommunityJoinRequest_communityId_status_idx" ON "CommunityJoinRequest"("communityId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityJoinRequest_communityId_userId_key" ON "CommunityJoinRequest"("communityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityBan_communityId_userId_key" ON "CommunityBan"("communityId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityInvite_token_key" ON "CommunityInvite"("token");

-- CreateIndex
CREATE INDEX "CommunityInvite_token_idx" ON "CommunityInvite"("token");

-- CreateIndex
CREATE INDEX "Discussion_animeId_idx" ON "Discussion"("animeId");

-- CreateIndex
CREATE INDEX "Discussion_episodeId_idx" ON "Discussion"("episodeId");

-- CreateIndex
CREATE INDEX "Discussion_communityId_idx" ON "Discussion"("communityId");

-- CreateIndex
CREATE INDEX "Discussion_channelId_idx" ON "Discussion"("channelId");

-- CreateIndex
CREATE INDEX "Discussion_createdAt_idx" ON "Discussion"("createdAt");

-- CreateIndex
CREATE INDEX "Discussion_helpfulCount_idx" ON "Discussion"("helpfulCount");

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionPoll_discussionId_key" ON "DiscussionPoll"("discussionId");

-- CreateIndex
CREATE INDEX "PollOption_pollId_idx" ON "PollOption"("pollId");

-- CreateIndex
CREATE INDEX "PollVote_userId_idx" ON "PollVote"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_optionId_userId_key" ON "PollVote"("optionId", "userId");

-- CreateIndex
CREATE INDEX "DiscussionComment_discussionId_idx" ON "DiscussionComment"("discussionId");

-- CreateIndex
CREATE INDEX "DiscussionComment_parentId_idx" ON "DiscussionComment"("parentId");

-- CreateIndex
CREATE INDEX "DiscussionComment_createdAt_idx" ON "DiscussionComment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionFollower_discussionId_userId_key" ON "DiscussionFollower"("discussionId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscussionReaction_discussionId_userId_type_key" ON "DiscussionReaction"("discussionId", "userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "CommentReaction_commentId_userId_type_key" ON "CommentReaction"("commentId", "userId", "type");

-- CreateIndex
CREATE INDEX "CommunityMessage_channelId_createdAt_idx" ON "CommunityMessage"("channelId", "createdAt");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationAction_communityId_idx" ON "ModerationAction"("communityId");

-- CreateIndex
CREATE INDEX "ModerationAction_targetUserId_idx" ON "ModerationAction"("targetUserId");

-- CreateIndex
CREATE INDEX "UserList_userId_idx" ON "UserList"("userId");

-- CreateIndex
CREATE INDEX "UserListItem_listId_idx" ON "UserListItem"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "UserListItem_listId_animeId_key" ON "UserListItem"("listId", "animeId");

-- CreateIndex
CREATE INDEX "Activity_userId_createdAt_idx" ON "Activity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Follow_followerId_idx" ON "Follow"("followerId");

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "ContentWarning_animeId_idx" ON "ContentWarning"("animeId");

-- CreateIndex
CREATE INDEX "ContentWarning_type_idx" ON "ContentWarning"("type");

-- CreateIndex
CREATE INDEX "MediaAsset_animeId_idx" ON "MediaAsset"("animeId");

-- CreateIndex
CREATE INDEX "MediaAsset_type_idx" ON "MediaAsset"("type");

-- CreateIndex
CREATE INDEX "AnimeExternalLink_animeId_idx" ON "AnimeExternalLink"("animeId");

-- CreateIndex
CREATE INDEX "DeadLetterQueue_provider_entityType_idx" ON "DeadLetterQueue"("provider", "entityType");

-- CreateIndex
CREATE INDEX "PotentialDuplicate_primaryAnimeId_idx" ON "PotentialDuplicate"("primaryAnimeId");

-- CreateIndex
CREATE INDEX "PotentialDuplicate_status_idx" ON "PotentialDuplicate"("status");

-- CreateIndex
CREATE INDEX "ProviderPayload_provider_entityType_idx" ON "ProviderPayload"("provider", "entityType");

-- CreateIndex
CREATE UNIQUE INDEX "ProviderPayload_provider_entityType_externalId_key" ON "ProviderPayload"("provider", "entityType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsProvider_slug_key" ON "NewsProvider"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "NewsStoryCluster_slug_key" ON "NewsStoryCluster"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_slug_key" ON "NewsArticle"("slug");

-- CreateIndex
CREATE INDEX "NewsArticle_publishedAt_idx" ON "NewsArticle"("publishedAt");

-- CreateIndex
CREATE INDEX "NewsArticle_category_idx" ON "NewsArticle"("category");

-- CreateIndex
CREATE INDEX "NewsArticle_sourceName_idx" ON "NewsArticle"("sourceName");

-- CreateIndex
CREATE INDEX "NewsArticle_provider_idx" ON "NewsArticle"("provider");

-- CreateIndex
CREATE INDEX "NewsArticle_status_idx" ON "NewsArticle"("status");

-- CreateIndex
CREATE INDEX "NewsArticle_isFeatured_idx" ON "NewsArticle"("isFeatured");

-- CreateIndex
CREATE INDEX "NewsArticle_scheduledPublishAt_idx" ON "NewsArticle"("scheduledPublishAt");

-- CreateIndex
CREATE INDEX "NewsArticle_clusterId_idx" ON "NewsArticle"("clusterId");

-- CreateIndex
CREATE UNIQUE INDEX "NewsArticle_provider_externalId_key" ON "NewsArticle"("provider", "externalId");

-- CreateIndex
CREATE INDEX "NewsArticleAnime_animeId_idx" ON "NewsArticleAnime"("animeId");

-- CreateIndex
CREATE INDEX "NewsArticleAnime_status_idx" ON "NewsArticleAnime"("status");

-- CreateIndex
CREATE INDEX "NewsArticleStudio_studioId_idx" ON "NewsArticleStudio"("studioId");

-- CreateIndex
CREATE INDEX "NewsArticleStudio_status_idx" ON "NewsArticleStudio"("status");

-- CreateIndex
CREATE INDEX "NewsArticlePerson_personId_idx" ON "NewsArticlePerson"("personId");

-- CreateIndex
CREATE INDEX "NewsReviewQueue_status_idx" ON "NewsReviewQueue"("status");

-- CreateIndex
CREATE INDEX "NewsReviewQueue_articleId_idx" ON "NewsReviewQueue"("articleId");

-- CreateIndex
CREATE INDEX "NewsIngestionJob_providerSlug_status_idx" ON "NewsIngestionJob"("providerSlug", "status");

-- CreateIndex
CREATE INDEX "NewsIngestionJob_startedAt_idx" ON "NewsIngestionJob"("startedAt");

-- CreateIndex
CREATE INDEX "Conversation_type_idx" ON "Conversation"("type");

-- CreateIndex
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_userId_idx" ON "ConversationParticipant"("userId");

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_idx" ON "ConversationParticipant"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_userId_key" ON "ConversationParticipant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_userId_emoji_key" ON "MessageReaction"("messageId", "userId", "emoji");

-- CreateIndex
CREATE INDEX "ReviewAspect_reviewId_idx" ON "ReviewAspect"("reviewId");

-- CreateIndex
CREATE INDEX "ReviewAspect_aspect_sentiment_idx" ON "ReviewAspect"("aspect", "sentiment");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeCommunityOpinion_animeId_key" ON "AnimeCommunityOpinion"("animeId");

-- CreateIndex
CREATE INDEX "AnimeCommunityOpinion_overallSentiment_idx" ON "AnimeCommunityOpinion"("overallSentiment");

-- CreateIndex
CREATE INDEX "EventLog_userId_createdAt_idx" ON "EventLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EventLog_eventType_createdAt_idx" ON "EventLog"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "EventLog_entityType_entityId_idx" ON "EventLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimeTrendMetric_animeId_key" ON "AnimeTrendMetric"("animeId");

-- CreateIndex
CREATE INDEX "AnimeTrendMetric_momentumScore_idx" ON "AnimeTrendMetric"("momentumScore");

-- CreateIndex
CREATE INDEX "AnimeTrendMetric_trendTier_idx" ON "AnimeTrendMetric"("trendTier");

-- CreateIndex
CREATE INDEX "StreamingAvailability_animeId_region_idx" ON "StreamingAvailability"("animeId", "region");

-- CreateIndex
CREATE INDEX "StreamingAvailability_provider_idx" ON "StreamingAvailability"("provider");

-- CreateIndex
CREATE UNIQUE INDEX "UserTasteProfile_userId_key" ON "UserTasteProfile"("userId");

-- CreateIndex
CREATE INDEX "UserTasteProfile_userId_idx" ON "UserTasteProfile"("userId");

-- CreateIndex
CREATE INDEX "UserTasteProfile_confidenceTier_idx" ON "UserTasteProfile"("confidenceTier");

-- CreateIndex
CREATE INDEX "UserTasteSignal_profileId_signalType_idx" ON "UserTasteSignal"("profileId", "signalType");

-- CreateIndex
CREATE INDEX "UserTasteSignal_preferenceScore_idx" ON "UserTasteSignal"("preferenceScore");

-- CreateIndex
CREATE UNIQUE INDEX "UserTasteSignal_profileId_signalType_targetName_key" ON "UserTasteSignal"("profileId", "signalType", "targetName");

-- CreateIndex
CREATE INDEX "RecommendationSession_userId_createdAt_idx" ON "RecommendationSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "RecommendationSession_context_idx" ON "RecommendationSession"("context");

-- CreateIndex
CREATE INDEX "RecommendationItem_sessionId_position_idx" ON "RecommendationItem"("sessionId", "position");

-- CreateIndex
CREATE INDEX "RecommendationItem_animeId_idx" ON "RecommendationItem"("animeId");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_userId_feedback_idx" ON "RecommendationFeedback"("userId", "feedback");

-- CreateIndex
CREATE INDEX "RecommendationFeedback_animeId_idx" ON "RecommendationFeedback"("animeId");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationFeedback_userId_animeId_feedback_key" ON "RecommendationFeedback"("userId", "animeId", "feedback");

-- CreateIndex
CREATE INDEX "EntityEmbedding_entityType_entityId_idx" ON "EntityEmbedding"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "EntityEmbedding_status_idx" ON "EntityEmbedding"("status");

-- CreateIndex
CREATE INDEX "EntityEmbedding_modelName_modelVersion_idx" ON "EntityEmbedding"("modelName", "modelVersion");

-- CreateIndex
CREATE UNIQUE INDEX "EntityEmbedding_entityType_entityId_modelVersion_key" ON "EntityEmbedding"("entityType", "entityId", "modelVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ReviewAnalysis_reviewId_key" ON "ReviewAnalysis"("reviewId");

-- CreateIndex
CREATE INDEX "ReviewAnalysis_overallSentiment_idx" ON "ReviewAnalysis"("overallSentiment");

-- CreateIndex
CREATE INDEX "ReviewAnalysis_analysisVersion_idx" ON "ReviewAnalysis"("analysisVersion");

-- CreateIndex
CREATE INDEX "UserInterestCluster_userId_idx" ON "UserInterestCluster"("userId");

-- CreateIndex
CREATE INDEX "ModelRegistry_taskType_status_idx" ON "ModelRegistry"("taskType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ModelRegistry_modelName_modelVersion_key" ON "ModelRegistry"("modelName", "modelVersion");

-- CreateIndex
CREATE INDEX "RecommendationPrediction_userId_animeId_idx" ON "RecommendationPrediction"("userId", "animeId");

-- CreateIndex
CREATE INDEX "RecommendationPrediction_predictionType_idx" ON "RecommendationPrediction"("predictionType");
