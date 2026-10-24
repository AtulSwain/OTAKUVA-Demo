-- Custom lists: random share token for "anyone with the link" sharing (/l/<token>).
-- Additive and nullable — existing lists are unaffected until their owner shares them.
-- Hand-written (see CLAUDE.md: never `migrate dev` here; AnimeTitle.searchVector).

-- AlterTable
ALTER TABLE "UserList" ADD COLUMN "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "UserList_shareToken_key" ON "UserList"("shareToken");
