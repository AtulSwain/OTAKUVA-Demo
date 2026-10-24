-- Collections (2026-10-22): a banner per user list + an index for listing
-- public collections. Additive only. Hand-written (no searchVector drops —
-- see CLAUDE.md "Migration hazard").
ALTER TABLE "UserList" ADD COLUMN "bannerUrl" TEXT;

CREATE INDEX "UserList_visibility_updatedAt_idx" ON "UserList"("visibility", "updatedAt");
