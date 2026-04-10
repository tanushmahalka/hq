import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "../worker/app.ts";
import type { Env } from "../worker/trpc/context.ts";

type RequiredEnvKey = "DATABASE_URL" | "BETTER_AUTH_SECRET" | "BETTER_AUTH_URL";

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const contents = readFileSync(filePath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");
    process.env[key] ??= value;
  }
}

function loadLocalEnv() {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, ".env"));
  loadEnvFile(path.join(cwd, ".dev.vars"));
}

function getRequiredEnv(name: RequiredEnvKey): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getAppEnv(): Env {
  return {
    DATABASE_URL: getRequiredEnv("DATABASE_URL"),
    BETTER_AUTH_SECRET: getRequiredEnv("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: getRequiredEnv("BETTER_AUTH_URL"),
    HERMES_API_URL: process.env.HERMES_API_URL,
    HERMES_API_KEY: process.env.HERMES_API_KEY,
    HERMES_MODEL: process.env.HERMES_MODEL,
    OPENCLAW_HOOKS_URL: process.env.OPENCLAW_HOOKS_URL,
    OPENCLAW_HOOKS_TOKEN: process.env.OPENCLAW_HOOKS_TOKEN,
    LOCAL_PG_ADMIN_URL: process.env.LOCAL_PG_ADMIN_URL,
    S3_BUCKET: process.env.S3_BUCKET,
    S3_REGION: process.env.S3_REGION,
    S3_ENDPOINT_URL: process.env.S3_ENDPOINT_URL,
    S3_PUBLIC_BASE_URL: process.env.S3_PUBLIC_BASE_URL,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    SUPER_ADMIN_EMAILS: process.env.SUPER_ADMIN_EMAILS,
    ADMIN_EMAILS: process.env.ADMIN_EMAILS,
    AGENT_API_TOKEN: process.env.AGENT_API_TOKEN,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    LEAD_AGENT_ID: process.env.LEAD_AGENT_ID,
  };
}

function resolveStaticPath(distDir: string, requestPath: string) {
  const normalized = path.posix.normalize(requestPath);
  const relativePath = normalized.replace(/^\/+/, "");
  const diskPath = path.resolve(distDir, relativePath);

  if (path.relative(distDir, diskPath).startsWith("..")) {
    return null;
  }

  if (!existsSync(diskPath) || !statSync(diskPath).isFile()) {
    return null;
  }

  return relativePath;
}

loadLocalEnv();

const app = createApp({
  env: getAppEnv(),
  waitUntil: (promise: Promise<unknown>) => {
    void promise.catch((error: unknown) => {
      console.error("Background task failed:", error);
    });
  },
});

const distRoot = "dist";
const distDir = path.join(process.cwd(), distRoot);
const hasFrontendBuild = existsSync(path.join(distDir, "index.html"));

app.get("*", async (c, next) => {
  if (c.req.path.startsWith("/api/")) {
    return next();
  }

  if (!hasFrontendBuild) {
    return c.text("Frontend build not found. Run `pnpm build` first.", 503);
  }

  const staticPath = resolveStaticPath(distDir, c.req.path);
  if (staticPath) {
    return serveStatic({ root: distRoot, path: staticPath })(c, next);
  }

  return serveStatic({ root: distRoot, path: "index.html" })(c, next);
});

const port = Number.parseInt(process.env.PORT ?? "8787", 10);

serve({
  fetch: app.fetch,
  hostname: process.env.HOST ?? "127.0.0.1",
  port,
});

console.log(`HQ server listening on http://${process.env.HOST ?? "127.0.0.1"}:${port}`);
