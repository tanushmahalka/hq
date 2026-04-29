import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { and, eq, gt } from "drizzle-orm";
import { appRouter } from "./trpc/router.ts";
import { createContext, createAuthInstance, type Env } from "./trpc/context.ts";
import { createDb } from "./db/client.ts";
import {
  invitation as invitationTable,
  member as memberTable,
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
  requestHermesChatCompletion,
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

  function getSuperAdminEmails() {
    return [env.SUPER_ADMIN_EMAILS, env.ADMIN_EMAILS]
      .filter(Boolean)
      .flatMap((emails) => emails!.split(","))
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  }

  async function getSuperAdminSession(c: Context) {
    const db = createDb(env.DATABASE_URL);
    const auth = createAuthInstance(env, db);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });

    const isSuperAdmin =
      session?.user.role === "admin" ||
      getSuperAdminEmails().includes(session?.user.email.toLowerCase() ?? "");

    if (!session || !isSuperAdmin) {
      return null;
    }

    return { db, session };
  }

  function getActiveOrganizationId(
    c: Context,
    session: { session: { activeOrganizationId?: string | null } }
  ) {
    return c.req.query("organizationId") ?? session.session.activeOrganizationId ?? null;
  }

  function getInvitationExpiry() {
    return new Date(Date.now() + 1000 * 60 * 60 * 48);
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

  app.get("/api/auth/organization/list-members", async (c, next) => {
    const superAdmin = await getSuperAdminSession(c);
    if (!superAdmin) {
      return next();
    }

    const organizationId = getActiveOrganizationId(c, superAdmin.session);
    if (!organizationId) {
      return c.json({ message: "Organization ID is required." }, 400);
    }

    const members = await superAdmin.db
      .select({
        id: memberTable.id,
        organizationId: memberTable.organizationId,
        userId: memberTable.userId,
        role: memberTable.role,
        createdAt: memberTable.createdAt,
        user: {
          id: userTable.id,
          name: userTable.name,
          email: userTable.email,
          image: userTable.image,
        },
      })
      .from(memberTable)
      .innerJoin(userTable, eq(memberTable.userId, userTable.id))
      .where(eq(memberTable.organizationId, organizationId));

    return c.json({ members, total: members.length });
  });

  app.get("/api/auth/organization/list-invitations", async (c, next) => {
    const superAdmin = await getSuperAdminSession(c);
    if (!superAdmin) {
      return next();
    }

    const organizationId = getActiveOrganizationId(c, superAdmin.session);
    if (!organizationId) {
      return c.json({ message: "Organization ID is required." }, 400);
    }

    const invitations = await superAdmin.db.query.invitation.findMany({
      where: eq(invitationTable.organizationId, organizationId),
    });

    return c.json(invitations);
  });

  app.post("/api/auth/organization/invite-member", async (c, next) => {
    const superAdmin = await getSuperAdminSession(c);
    if (!superAdmin) {
      return next();
    }

    const body = (await c.req.json().catch(() => null)) as
      | { email?: unknown; role?: unknown; organizationId?: unknown }
      | null;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body?.role === "string" ? body.role : "member";
    const organizationId =
      typeof body?.organizationId === "string"
        ? body.organizationId
        : superAdmin.session.session.activeOrganizationId;

    if (!organizationId) {
      return c.json({ message: "Organization ID is required." }, 400);
    }

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ message: "Invalid email." }, 400);
    }

    if (!["member", "admin", "owner"].includes(role)) {
      return c.json({ message: "Role not found." }, 400);
    }

    const organization = await superAdmin.db.query.organization.findFirst({
      where: eq(organizationTable.id, organizationId),
    });
    if (!organization) {
      return c.json({ message: "Organization not found." }, 400);
    }

    const existingMember = await superAdmin.db
      .select({ id: memberTable.id })
      .from(memberTable)
      .innerJoin(userTable, eq(memberTable.userId, userTable.id))
      .where(
        and(
          eq(memberTable.organizationId, organizationId),
          eq(userTable.email, email)
        )
      )
      .limit(1);

    if (existingMember.length > 0) {
      return c.json({ message: "User is already a member of this organization." }, 400);
    }

    const existingInvite = await superAdmin.db.query.invitation.findFirst({
      where: and(
        eq(invitationTable.organizationId, organizationId),
        eq(invitationTable.email, email),
        eq(invitationTable.status, "pending"),
        gt(invitationTable.expiresAt, new Date())
      ),
    });

    if (existingInvite) {
      return c.json({ message: "User is already invited to this organization." }, 400);
    }

    const [invitation] = await superAdmin.db
      .insert(invitationTable)
      .values({
        id: crypto.randomUUID(),
        organizationId,
        email,
        role,
        inviterId: superAdmin.session.user.id,
        status: "pending",
        expiresAt: getInvitationExpiry(),
      })
      .returning();

    return c.json(invitation);
  });

  app.post("/api/auth/organization/cancel-invitation", async (c, next) => {
    const superAdmin = await getSuperAdminSession(c);
    if (!superAdmin) {
      return next();
    }

    const body = (await c.req.json().catch(() => null)) as
      | { invitationId?: unknown }
      | null;
    const invitationId =
      typeof body?.invitationId === "string" ? body.invitationId : "";

    if (!invitationId) {
      return c.json({ message: "Invitation ID is required." }, 400);
    }

    const [invitation] = await superAdmin.db
      .update(invitationTable)
      .set({ status: "canceled" })
      .where(eq(invitationTable.id, invitationId))
      .returning();

    if (!invitation) {
      return c.json({ message: "Invitation not found." }, 400);
    }

    return c.json(invitation);
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

    const upstream = await requestHermesChatCompletion({
      hermes,
      messages,
      sessionKey: sessionKey || undefined,
      signal: c.req.raw.signal,
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      const upstreamUrl = upstream.headers.get("x-hq-hermes-upstream-url");
      return new Response(
        JSON.stringify({
          message: detail || `Hermes request failed with status ${upstream.status}.`,
          upstreamUrl,
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
