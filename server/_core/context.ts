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
  console.info("[TJ Auth Server] Creating tRPC context", {
    method: opts.req.method,
    path: opts.req.path,
    authorizationPresent: Boolean(opts.req.headers.authorization),
  });

  try {
    user = await authenticateSupabaseRequest(opts.req as any);
    console.info("[TJ Auth Server] Supabase authentication succeeded", {
      userIdPresent: Boolean(user?.id),
    });
  } catch (error) {
    console.warn("[TJ Auth Server] Supabase authentication unavailable", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
