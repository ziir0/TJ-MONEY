import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "./_core/context";
import { appRouter } from "./routers";

export function createApp() {
  const app = express();
  console.info("[TJ Server] Express app initialized", {
    nodeEnv: process.env.NODE_ENV ?? "undefined",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    supabaseConfigured: Boolean(process.env.SUPABASE_URL),
    supabaseSecretConfigured: Boolean(process.env.SUPABASE_SECRET_KEY),
  });

  app.use((req, _res, next) => {
    console.info("[TJ Server] Request received", {
      method: req.method,
      path: req.path,
      authorizationPresent: Boolean(req.headers.authorization),
    });
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  const trpcMiddleware = createExpressMiddleware({
    router: appRouter,
    createContext,
  });

  app.use("/api/trpc", trpcMiddleware);

  app.use((_error: unknown, _req: any, res: any, _next: any) => {
    console.error("[TJ Server] Unhandled Express error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return app;
}
