-- CreateTable
CREATE TABLE "CommentMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "commentId" TEXT,
    "uploaderId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "providerMediaId" TEXT,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "mimeType" TEXT,
    "isSpoiler" BOOLEAN NOT NULL DEFAULT false,
    "assetId" TEXT,
    "attachedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CommentMedia_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "DiscussionComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommentMedia_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CommentMedia_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "MediaAsset" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CommentMedia_commentId_idx" ON "CommentMedia"("commentId");

-- CreateIndex
CREATE INDEX "CommentMedia_uploaderId_commentId_idx" ON "CommentMedia"("uploaderId", "commentId");

-- CreateIndex
CREATE INDEX "CommentMedia_createdAt_idx" ON "CommentMedia"("createdAt");

