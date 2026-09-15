import { createClient } from "@supabase/supabase-js";
import * as db from "../db.js";
import type { User } from "../../drizzle/schema.js";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

console.info("[TJ Supabase Server] Client configuration", {
  urlConfigured: Boolean(supabaseUrl),
  secretKeyConfigured: Boolean(process.env.SUPABASE_SECRET_KEY),
  publishableKeyConfigured: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
});

export async function authenticateSupabaseRequest(
  req: { headers: { authorization?: string } }
): Promise<User> {
  const authorization = req.headers.authorization;
  const token =
    typeof authorization === "string" && authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

  console.info("[TJ Supabase Server] Authenticating request", {
    bearerPresent: Boolean(token),
  });

  if (!supabase || !token) {
    throw new Error("Supabase authentication is not configured");
  }

  const getUser = (supabase.auth as any).getUser.bind(supabase.auth);
  const {
    data: { user: authUser },
    error,
  } = await getUser(token);

  console.info("[TJ Supabase Server] Supabase getUser completed", {
    authUserPresent: Boolean(authUser),
    error: error?.message ?? null,
  });

  if (error || !authUser) {
    throw new Error("Invalid Supabase session");
  }

  const openId = authUser.id;
  const signedInAt = new Date();
  let user = await db.getUserByOpenId(openId);
  console.info("[TJ Supabase Server] Local user lookup completed", {
    userPresent: Boolean(user),
  });

  if (!user) {
    await db.upsertUser({
      openId,
      name: authUser.user_metadata?.name ?? authUser.email ?? null,
      email: authUser.email ?? null,
      loginMethod: "email",
      lastSignedIn: signedInAt,
    });
    console.info("[TJ Supabase Server] Local user created or synchronized");
    user = await db.getUserByOpenId(openId);
  }

  if (!user) {
    throw new Error("User could not be synchronized");
  }

  await db.upsertUser({ openId, lastSignedIn: signedInAt });
  return user;
}
