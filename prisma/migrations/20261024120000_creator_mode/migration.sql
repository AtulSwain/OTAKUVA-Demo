-- Creator Mode (2026-10-24): creator role details, creator reviews + drafts,
-- hashed invitation keys. Additive only. Hand-written from `prisma migrate diff`
-- with the AnimeTitle searchVector DROP INDEX / DROP COLUMN lines removed
-- (raw-SQL full-text index that schema.prisma deliberately omits — see CLAUDE.md).

-- AlterTable
ALTER TABLE "CommunityInvite" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "keyHash" TEXT,
ADD COLUMN     "keyHint" TEXT,
ADD COLUMN     "lastUsedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "isCreatorReview" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "creatorChannelName" TEXT,
ADD COLUMN     "creatorChannelUrl" TEXT,
ADD COLUMN     "creatorSince" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "CommunityInvite_keyHash_key" ON "CommunityInvite"("keyHash");

-- CreateIndex
CREATE INDEX "CommunityInvite_communityId_revokedAt_idx" ON "CommunityInvite"("communityId", "revokedAt");

-- CreateIndex
CREATE INDEX "Review_animeId_isCreatorReview_status_idx" ON "Review"("animeId", "isCreatorReview", "status");

