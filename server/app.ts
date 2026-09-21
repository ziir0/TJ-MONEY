import express from "express";
import type { NextFunction, Request, Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "./_core/context.js";
import { appRouter } from "./routers.js";

export function createApp() {
  const app = express();
  console.info("[TJ Server] Express app initialized", {
    nodeEnv: process.env.NODE_ENV ?? "undefined",
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    supabaseConfigured: Boolean(process.env.SUPABASE_URL),
    supabaseSecretConfigured: Boolean(process.env.SUPABASE_SECRET_KEY),
  });

  app.use((req: Request, _res: Response, next: NextFunction) => {
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

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    console.error("[TJ Server] Unhandled Express error", {
      method: req.method,
      path: req.path,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  });

  return app;
}
