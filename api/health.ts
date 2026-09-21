import { sql } from "drizzle-orm";
import { getDb } from "../server/db.js";

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

export default async function handler(_req: unknown, res: VercelResponse) {
  const result: {
    ok: boolean;
    databaseConfigured: boolean;
    databaseReachable: boolean;
    timestamp: string;
  } = {
    ok: false,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    databaseReachable: false,
    timestamp: new Date().toISOString(),
  };

  try {
    const db = await getDb();
    if (!db) {
      console.error("[TJ Health] Database client unavailable", {
        databaseConfigured: result.databaseConfigured,
      });
      return res.status(503).json(result);
    }

    await db.execute(sql`select 1 as ok`);
    result.databaseReachable = true;
    result.ok = true;
    console.info("[TJ Health] Database connectivity check succeeded");
    return res.status(200).json(result);
  } catch (error) {
    console.error("[TJ Health] Database connectivity check failed", {
      databaseConfigured: result.databaseConfigured,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(503).json(result);
  }
}
