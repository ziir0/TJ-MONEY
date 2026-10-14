import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema.js";
import { authenticateSupabaseRequest } from "./supabase.js";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  const authorization = opts.req.headers.authorization;
  if (typeof authorization === "string" && authorization.startsWith("Bearer ")) {
    try {
      user = await authenticateSupabaseRequest(opts.req);
    } catch (error) {
      console.warn("[TJ Auth] Bearer token rejected", {
        errorType: error instanceof Error ? error.name : "Unknown authentication error",
      });
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
