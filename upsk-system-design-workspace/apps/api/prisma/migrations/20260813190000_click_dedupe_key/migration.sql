ALTER TABLE "ClickEvent" ADD COLUMN "dedupeKey" TEXT;
CREATE UNIQUE INDEX "ClickEvent_dedupeKey_key" ON "ClickEvent"("dedupeKey");
