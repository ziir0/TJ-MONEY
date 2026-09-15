import { trpc } from "@/lib/trpc";
import { getAccessToken } from "@/lib/supabase";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

const apiLog = (...args: unknown[]) => console.info("[TJ API]", ...args);

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      headers() {
        const token = getAccessToken();
        apiLog("Preparing tRPC headers", {
          tokenPresent: Boolean(token),
          tokenLength: token?.length ?? 0,
        });
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      fetch(input, init) {
        const method = init?.method ?? "GET";
        apiLog("Request started", {
          method,
          url: String(input),
        });
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        }).then(async response => {
          apiLog("Response received", {
            method,
            url: String(input),
            status: response.status,
            ok: response.ok,
            contentType: response.headers.get("content-type"),
          });

          if (!response.ok) {
            const body = await response.clone().text().catch(() => "");
            apiLog("Non-OK response body preview", {
              preview: body.slice(0, 240),
            });
          }

          return response;
        }).catch(error => {
          console.error("[TJ API] Request failed", {
            method,
            url: String(input),
            message: error instanceof Error ? error.message : String(error),
          });
          throw error;
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
