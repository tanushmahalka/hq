import { Hono } from "hono";
import { cors } from "hono/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "./trpc/router";
import { createContext, createAuthInstance, type Env } from "./trpc/context";
import { createDb } from "./db/client";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", async (c, next) => {
  const allowedOrigins = c.env.ALLOWED_ORIGINS
    ? c.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
    : [];

  return cors({
    origin: (origin) => {
      if (!origin) return null;
      if (allowedOrigins.length === 0) return origin;
      return allowedOrigins.includes(origin) ? origin : null;
    },
    credentials: true,
  })(c, next);
});

app.get("/api/health", (c) => c.json({ ok: true }));

// Better Auth routes
app.on(["POST", "GET"], "/api/auth/*", async (c) => {
  const db = createDb(c.env.DATABASE_URL);
  const auth = createAuthInstance(c.env, db);
  return auth.handler(c.req.raw);
});

app.all("/api/trpc/*", async (c) => {
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req: c.req.raw,
    router: appRouter,
    createContext: () => createContext(c.env, c.executionCtx, c.req.raw),
    onError: ({ error, path }) => {
      console.error(`tRPC error on '${path}':`, error);
    },
  });
});

export default app;
