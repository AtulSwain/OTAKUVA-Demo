-- Adds a persistent per-anime live chat room to the existing Conversation
-- model (type = 'ANIME_ROOM'). Nullable + unique so DIRECT/GROUP rows
-- (animeId always NULL) never collide, while every anime gets at most one
-- room conversation.
ALTER TABLE "Conversation" ADD COLUMN "animeId" TEXT;

CREATE UNIQUE INDEX "Conversation_animeId_key" ON "Conversation"("animeId");

ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_animeId_fkey"
  FOREIGN KEY ("animeId") REFERENCES "Anime"("id") ON DELETE CASCADE ON UPDATE CASCADE;
