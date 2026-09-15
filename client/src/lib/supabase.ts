import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublishableKey = import.meta.env
  .VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const authLog = (...args: unknown[]) => console.info("[TJ Auth]", ...args);

authLog("Supabase client initialization", {
  urlConfigured: Boolean(supabaseUrl),
  publishableKeyConfigured: Boolean(supabasePublishableKey),
  url: supabaseUrl ?? "missing",
});

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY."
  );
}

export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabasePublishableKey ?? "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  authLog("Access token state changed", {
    present: Boolean(token),
    length: token?.length ?? 0,
  });
}

export function getAccessToken() {
  return accessToken;
}

supabase.auth.onAuthStateChange((event, session) => {
  authLog("Auth state event", {
    event,
    sessionPresent: Boolean(session),
    userIdPresent: Boolean(session?.user?.id),
  });
  setAccessToken(session?.access_token ?? null);
});
