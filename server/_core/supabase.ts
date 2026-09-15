import { createClient } from "@supabase/supabase-js";
import type { Request } from "express";
import * as db from "../db";
import type { User } from "../../drizzle/schema";

const supabaseUrl = process.env.SUPABASE_URL ?? "";
const supabaseKey =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? "";

const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
    : null;

export async function authenticateSupabaseRequest(
  req: Request
): Promise<User> {
  const authorization = req.headers.authorization;
  const token =
    typeof authorization === "string" && authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : null;

  if (!supabase || !token) {
    throw new Error("Supabase authentication is not configured");
  }

  const {
    data: { user: authUser },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !authUser) {
    throw new Error("Invalid Supabase session");
  }

  const openId = authUser.id;
  const signedInAt = new Date();
  let user = await db.getUserByOpenId(openId);

  if (!user) {
    await db.upsertUser({
      openId,
      name: authUser.user_metadata?.name ?? authUser.email ?? null,
      email: authUser.email ?? null,
      loginMethod: "email",
      lastSignedIn: signedInAt,
    });
    user = await db.getUserByOpenId(openId);
  }

  if (!user) {
    throw new Error("User could not be synchronized");
  }

  await db.upsertUser({ openId, lastSignedIn: signedInAt });
  return user;
}
