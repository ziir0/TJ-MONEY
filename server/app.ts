import express from "express";
import type { ErrorRequestHandler, RequestHandler } from "express";
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

  const requestLogger: RequestHandler = (
    req: Parameters<RequestHandler>[0],
    _res: Parameters<RequestHandler>[1],
    next: Parameters<RequestHandler>[2]
  ) => {
    console.info("[TJ Server] Request received", {
      method: req.method,
      path: req.path,
      authorizationPresent: Boolean(req.headers.authorization),
    });
    next();
  };
  app.use(requestLogger);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  const trpcMiddleware = createExpressMiddleware({
    router: appRouter,
    createContext,
  });

  app.use("/api/trpc", trpcMiddleware);

  const errorHandler: ErrorRequestHandler = (
    error: Parameters<ErrorRequestHandler>[0],
    req: Parameters<ErrorRequestHandler>[1],
    res: Parameters<ErrorRequestHandler>[2],
    _next: Parameters<ErrorRequestHandler>[3]
  ) => {
    console.error("[TJ Server] Unhandled Express error", {
      method: req.method,
      path: req.path,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  };
  app.use(errorHandler);

  return app;
}
