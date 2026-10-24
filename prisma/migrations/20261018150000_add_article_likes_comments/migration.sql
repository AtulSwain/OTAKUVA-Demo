-- Member article likes + comments (2026-10-18). Additive: two new tables, no existing data touched.
-- Hand-written (see CLAUDE.md: never `migrate dev` here; AnimeTitle.searchVector).

-- CreateTable
CREATE TABLE "UserArticleLike" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserArticleLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserArticleComment" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "UserArticleComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserArticleLike_articleId_idx" ON "UserArticleLike"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "UserArticleLike_articleId_userId_key" ON "UserArticleLike"("articleId", "userId");

-- CreateIndex
CREATE INDEX "UserArticleComment_articleId_createdAt_idx" ON "UserArticleComment"("articleId", "createdAt");

-- CreateIndex
CREATE INDEX "UserArticleComment_userId_idx" ON "UserArticleComment"("userId");

-- AddForeignKey
ALTER TABLE "UserArticleLike" ADD CONSTRAINT "UserArticleLike_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "UserArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserArticleLike" ADD CONSTRAINT "UserArticleLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserArticleComment" ADD CONSTRAINT "UserArticleComment_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "UserArticle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserArticleComment" ADD CONSTRAINT "UserArticleComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

