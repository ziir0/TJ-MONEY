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
    try {
      await supabase.auth.signOut();
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
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
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAccessToken(data.session?.access_token ?? null);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAccessToken(session?.access_token ?? null);
        if (active) setAuthReady(true);
        void utils.auth.me.invalidate();
      },
    );

    return () => {
      active = false;
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
