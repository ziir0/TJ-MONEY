import { trpc } from "@/lib/trpc";
import { setAccessToken, supabase } from "@/lib/supabase";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useState } from "react";

export function useAuth() {
  const utils = trpc.useUtils();
  const [authReady, setAuthReady] = useState(false);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
    enabled: authReady,
  });

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    console.info("[TJ Auth] Logout started");
    try {
      await supabase.auth.signOut();
      console.info("[TJ Auth] Supabase signOut completed");
      await logoutMutation.mutateAsync();
      console.info("[TJ Auth] Server logout completed");
    } catch (error: unknown) {
      console.error("[TJ Auth] Logout failed", error);
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      setAccessToken(null);
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
    }
  }, [logoutMutation, utils]);

  useEffect(() => {
    let active = true;
    console.info("[TJ Auth] Loading current session");
    void supabase.auth.getSession().then(({ data, error }) => {
      console.info("[TJ Auth] Current session loaded", {
        sessionPresent: Boolean(data.session),
        userIdPresent: Boolean(data.session?.user?.id),
        error: error?.message ?? null,
      });
      if (!active) return;
      setAccessToken(data.session?.access_token ?? null);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        console.info("[TJ Auth] Hook received auth event", {
          event: _event,
          sessionPresent: Boolean(session),
          userIdPresent: Boolean(session?.user?.id),
        });
        setAccessToken(session?.access_token ?? null);
        if (active) setAuthReady(true);
        void utils.auth.me.invalidate();
      },
    );

    return () => {
      active = false;
      console.info("[TJ Auth] Auth hook cleanup");
      listener.subscription.unsubscribe();
    };
  }, [utils]);

  return {
    user: meQuery.data ?? null,
    loading: !authReady || meQuery.isLoading || logoutMutation.isPending,
    error: meQuery.error ?? logoutMutation.error ?? null,
    isAuthenticated: Boolean(meQuery.data),
    refresh: () => meQuery.refetch(),
    logout,
  };
}
