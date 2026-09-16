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
  const request = opts.req as unknown as {
    method?: string;
    path?: string;
    headers: { authorization?: string };
  };
  console.info("[TJ Auth Server] Creating tRPC context", {
    method: request.method,
    path: request.path,
    authorizationPresent: Boolean(request.headers.authorization),
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
