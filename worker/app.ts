import { Hono } from "hono";
import { cors } from "hono/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { eq } from "drizzle-orm";
import { appRouter } from "./trpc/router";
import { createContext, createAuthInstance, type Env } from "./trpc/context";
import { createDb } from "./db/client";
import {
  invitation as invitationTable,
  organization as organizationTable,
  user as userTable,
} from "../shared/auth-schema";

interface AppOptions {
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
}

export function createApp({ env, waitUntil }: AppOptions) {
  const app = new Hono();

  app.use("/api/*", async (c, next) => {
    const allowedOrigins = env.ALLOWED_ORIGINS
      ? env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
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

  app.get("/api/public/invitations/:id", async (c) => {
    const db = createDb(env.DATABASE_URL);
    const invitationId = c.req.param("id");

    const row = await db
      .select({
        id: invitationTable.id,
        email: invitationTable.email,
        role: invitationTable.role,
        status: invitationTable.status,
        expiresAt: invitationTable.expiresAt,
        organizationId: invitationTable.organizationId,
        organizationName: organizationTable.name,
        organizationSlug: organizationTable.slug,
        inviterEmail: userTable.email,
        inviterName: userTable.name,
      })
      .from(invitationTable)
      .innerJoin(
        organizationTable,
        eq(invitationTable.organizationId, organizationTable.id)
      )
      .innerJoin(userTable, eq(invitationTable.inviterId, userTable.id))
      .where(eq(invitationTable.id, invitationId))
      .limit(1);

    const invitation = row[0];

    if (!invitation) {
      return c.json({ message: "Invitation not found." }, 404);
    }

    const hasExistingAccount = Boolean(
      await db.query.user.findFirst({
        where: eq(userTable.email, invitation.email.toLowerCase()),
      })
    );

    return c.json({
      ...invitation,
      hasExistingAccount,
      isExpired: invitation.expiresAt < new Date(),
    });
  });

  app.on(["POST", "GET"], "/api/auth/*", async (c) => {
    const db = createDb(env.DATABASE_URL);
    const auth = createAuthInstance(env, db);
    return auth.handler(c.req.raw);
  });

  app.all("/api/trpc/*", async (c) => {
    return fetchRequestHandler({
      endpoint: "/api/trpc",
      req: c.req.raw,
      router: appRouter,
      createContext: () => createContext(env, { waitUntil }, c.req.raw),
      onError: ({ error, path }) => {
        console.error(`tRPC error on '${path}':`, error);
      },
    });
  });

  return app;
}
