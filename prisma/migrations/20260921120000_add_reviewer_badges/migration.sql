-- Reviewer badges (expand-only: new nullable/defaulted columns and new tables; nothing dropped).
-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "countRemovalReason" TEXT,
ADD COLUMN     "countState" TEXT,
ADD COLUMN     "countedAt" TIMESTAMP(3),
ADD COLUMN     "wordCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "showJoinedCommunities" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "UserBadgeStats" (
    "userId" TEXT NOT NULL,
    "countedReviewCount" INTEGER NOT NULL DEFAULT 0,
    "currentTier" TEXT NOT NULL DEFAULT 'shoshinsha',
    "helpfulVotes" INTEGER NOT NULL DEFAULT 0,
    "lastCountedReviewAt" TIMESTAMP(3),
    "hasConfirmedSpam" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBadgeStats_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeKey" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "tierKey" TEXT,
    "count" INTEGER NOT NULL DEFAULT 0,
    "dedupeKey" TEXT,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BadgeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimeBadgeAggregate" (
    "animeId" TEXT NOT NULL,
    "tierKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AnimeBadgeAggregate_pkey" PRIMARY KEY ("animeId","tierKey")
);

-- CreateTable
CREATE TABLE "CommunityBadgeAggregate" (
    "communityId" TEXT NOT NULL,
    "tierKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CommunityBadgeAggregate_pkey" PRIMARY KEY ("communityId","tierKey")
);

-- CreateIndex
CREATE INDEX "UserBadgeStats_currentTier_idx" ON "UserBadgeStats"("currentTier");

-- CreateIndex
CREATE INDEX "UserBadge_badgeKey_idx" ON "UserBadge"("badgeKey");

-- CreateIndex
CREATE UNIQUE INDEX "UserBadge_userId_badgeKey_key" ON "UserBadge"("userId", "badgeKey");

-- CreateIndex
CREATE INDEX "BadgeEvent_userId_seenAt_idx" ON "BadgeEvent"("userId", "seenAt");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeEvent_userId_dedupeKey_key" ON "BadgeEvent"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "Review_countState_createdAt_idx" ON "Review"("countState", "createdAt");

-- CreateIndex
CREATE INDEX "Review_userId_countState_countedAt_idx" ON "Review"("userId", "countState", "countedAt");

-- CreateIndex
CREATE INDEX "Review_animeId_countState_idx" ON "Review"("animeId", "countState");

-- AddForeignKey
ALTER TABLE "UserBadgeStats" ADD CONSTRAINT "UserBadgeStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBadge" ADD CONSTRAINT "UserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeEvent" ADD CONSTRAINT "BadgeEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimeBadgeAggregate" ADD CONSTRAINT "AnimeBadgeAggregate_animeId_fkey" FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityBadgeAggregate" ADD CONSTRAINT "CommunityBadgeAggregate_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

