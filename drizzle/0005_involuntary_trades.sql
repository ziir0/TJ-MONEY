ALTER TABLE "trades"
  ADD COLUMN IF NOT EXISTS "isInvoluntary" boolean NOT NULL DEFAULT false;

UPDATE "trades"
SET "isInvoluntary" = true,
    "notes" = 'Trade involuntário: ordem executada sem intenção, provavelmente por clique involuntário na corretora. Mantido para consistência com o histórico da corretora.'
WHERE "id" IN (21, 22, 23, 24, 25);

-- Down migration:
-- ALTER TABLE "trades" DROP COLUMN IF EXISTS "isInvoluntary";
