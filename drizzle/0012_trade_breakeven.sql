ALTER TABLE "trades"
  ADD COLUMN IF NOT EXISTS "isBreakeven" boolean NOT NULL DEFAULT false;
