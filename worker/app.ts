import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { eq } from "drizzle-orm";
import { appRouter } from "./trpc/router.ts";
import { createContext, createAuthInstance, type Env } from "./trpc/context.ts";
import { createDb } from "./db/client.ts";
import {
  invitation as invitationTable,
  organization as organizationTable,
  user as userTable,
} from "../drizzle/schema/auth.ts";
import {
  ChatImageUploadError,
  uploadChatImageToS3,
} from "./lib/chat-image-upload.ts";
import {
  createHermesUiMessageStreamResponse,
  getHermesChatConfig,
  uiMessagesToHermesMessages,
} from "./lib/hermes-chat.ts";

interface AppOptions {
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
}

export function createApp({ env, waitUntil }: AppOptions) {
  const app = new Hono();

  async function getRequestContext(request: Request) {
    return createContext(env, { waitUntil }, request);
  }

  function unauthorizedResponse(c: Context) {
    return c.json({ message: "Unauthorized." }, 401);
  }

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

  app.post("/api/chat/uploads/image", async (c) => {
    const requestContext = await getRequestContext(c.req.raw);
    if (!requestContext.user && !requestContext.isAgent) {
      return unauthorizedResponse(c);
    }

    const formData = await c.req.raw.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return c.json({ message: "Image file is required." }, 400);
    }

    if (!file.type.startsWith("image/")) {
      return c.json({ message: "Only image uploads are supported." }, 400);
    }

    if (file.size <= 0) {
      return c.json({ message: "Image upload is empty." }, 400);
    }

    try {
      const result = await uploadChatImageToS3(env, file);
      return c.json(result, 200);
    } catch (error) {
      if (error instanceof ChatImageUploadError) {
        return new Response(JSON.stringify({ message: error.message }), {
          status: error.status,
          headers: {
            "content-type": "application/json; charset=utf-8",
          },
        });
      }

      throw error;
    }
  });

  app.post("/api/chat", async (c) => {
    const requestContext = await getRequestContext(c.req.raw);
    if (!requestContext.user && !requestContext.isAgent) {
      return unauthorizedResponse(c);
    }

    const hermes = getHermesChatConfig(env);
    if (!hermes) {
      return c.json(
        { message: "Hermes chat is not configured on the HQ server." },
        503,
      );
    }

    const body = (await c.req.json().catch(() => null)) as
      | {
          messages?: unknown;
          sessionKey?: unknown;
        }
      | null;

    const messages = uiMessagesToHermesMessages(body?.messages);
    const sessionKey =
      typeof body?.sessionKey === "string" ? body.sessionKey.trim() : "";
    if (messages.length === 0) {
      return c.json({ message: "Chat request did not include any messages." }, 400);
    }

    const upstream = await fetch(`${hermes.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(hermes.apiKey
          ? { authorization: `Bearer ${hermes.apiKey}` }
          : {}),
        ...(sessionKey
          ? { "X-Hermes-Session-Id": sessionKey }
          : {}),
      },
      body: JSON.stringify({
        model: hermes.model,
        stream: true,
        messages,
      }),
      signal: c.req.raw.signal,
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return new Response(
        JSON.stringify({
          message: detail || `Hermes request failed with status ${upstream.status}.`,
        }),
        {
          status: upstream.status,
          headers: {
            "content-type": "application/json; charset=utf-8",
          },
        },
      );
    }

    return createHermesUiMessageStreamResponse(upstream);
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
