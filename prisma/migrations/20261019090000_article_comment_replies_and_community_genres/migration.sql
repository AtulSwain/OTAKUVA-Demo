-- Article comment replies + comment likes, and community genre links (2026-10-19).
-- Additive only. Generated with `migrate diff --script`; the AnimeTitle."searchVector"
-- drop (and its GIN index) it proposes were removed (raw-SQL search column, see docs/production/SEARCH.md).

-- AlterTable

-- AlterTable
ALTER TABLE "UserArticleComment" ADD COLUMN     "parentId" TEXT;

-- CreateTable
CREATE TABLE "UserArticleCommentLike" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserArticleCommentLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityGenre" (
    "communityId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,

    CONSTRAINT "CommunityGenre_pkey" PRIMARY KEY ("communityId","genreId")
);

-- CreateIndex
CREATE INDEX "UserArticleCommentLike_commentId_idx" ON "UserArticleCommentLike"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "UserArticleCommentLike_commentId_userId_key" ON "UserArticleCommentLike"("commentId", "userId");

-- CreateIndex
CREATE INDEX "CommunityGenre_genreId_idx" ON "CommunityGenre"("genreId");

-- CreateIndex
CREATE INDEX "UserArticleComment_parentId_idx" ON "UserArticleComment"("parentId");

-- AddForeignKey
ALTER TABLE "UserArticleComment" ADD CONSTRAINT "UserArticleComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "UserArticleComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserArticleCommentLike" ADD CONSTRAINT "UserArticleCommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "UserArticleComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserArticleCommentLike" ADD CONSTRAINT "UserArticleCommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityGenre" ADD CONSTRAINT "CommunityGenre_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityGenre" ADD CONSTRAINT "CommunityGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

