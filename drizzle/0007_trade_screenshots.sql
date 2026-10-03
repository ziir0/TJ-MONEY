ALTER TABLE "trades"
  ADD COLUMN IF NOT EXISTS "screenshot1" varchar(512),
  ADD COLUMN IF NOT EXISTS "screenshot2" varchar(512);