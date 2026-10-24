-- Member-written articles (separate from provider-ingested NewsArticle).
-- Hand-written from `migrate diff --script` with the AnimeTitle.searchVector drop removed (see CLAUDE.md).

-- CreateTable
CREATE TABLE "UserArticle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "body" TEXT NOT NULL,
    "coverImageUrl" TEXT,
    "coverAssetId" TEXT,
    "links" JSONB NOT NULL DEFAULT '[]',
    "animeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserArticle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserArticle_slug_key" ON "UserArticle"("slug");

-- CreateIndex
CREATE INDEX "UserArticle_status_createdAt_idx" ON "UserArticle"("status", "createdAt");

-- CreateIndex
CREATE INDEX "UserArticle_authorId_createdAt_idx" ON "UserArticle"("authorId", "createdAt");

-- CreateIndex
CREATE INDEX "UserArticle_animeId_idx" ON "UserArticle"("animeId");

-- AddForeignKey
ALTER TABLE "UserArticle" ADD CONSTRAINT "UserArticle_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserArticle" ADD CONSTRAINT "UserArticle_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE SET NULL ON UPDATE CASCADE;

