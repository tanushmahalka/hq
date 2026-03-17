import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { appRouter } from "./trpc/router.ts";
import { createContext, createAuthInstance, type Env } from "./trpc/context.ts";
import { createDb } from "./db/client.ts";
import {
  invitation as invitationTable,
  organization as organizationTable,
  user as userTable,
} from "../drizzle/schema/auth.ts";
import {
  MarketingAssetServiceError,
  createMarketingAsset,
  getMarketingAsset,
  listMarketingAssets,
  marketingAssetCreateInputSchema,
  marketingAssetUpdateInputSchema,
  resolveMarketingAssetStorageRoot,
  updateMarketingAsset,
} from "./lib/marketing-asset.ts";
import {
  MarketingAssetPdfError,
  buildMarketingAssetPdfFilename,
  renderMarketingAssetPdf,
} from "./lib/marketing-asset-pdf.ts";
import {
  ChatImageUploadError,
  uploadChatImageToS3,
} from "./lib/chat-image-upload.ts";
import {
  createMarketingEbook,
  getMarketingEbook,
  listMarketingEbooks,
  marketingEbookCreateInputSchema,
  marketingEbookUpdateInputSchema,
  updateMarketingEbook,
} from "./lib/marketing-ebook.ts";
import { subscribeToMarketingAsset } from "./lib/marketing-asset-events.ts";
import { subscribeToMarketingEbook } from "./lib/marketing-ebook-events.ts";

interface AppOptions {
  env: Env;
  waitUntil: (promise: Promise<unknown>) => void;
}

export function createApp({ env, waitUntil }: AppOptions) {
  const app = new Hono();
  const marketingAssetStorageRoot = resolveMarketingAssetStorageRoot(
    env.HQ_EBOOK_STORAGE_DIR,
  );

  async function getRequestContext(request: Request) {
    return createContext(env, { waitUntil }, request);
  }

  function unauthorizedResponse(c: Context) {
    return c.json({ message: "Unauthorized." }, 401);
  }

  function handleMarketingError(c: Context, error: unknown) {
    if (error instanceof z.ZodError) {
      return c.json(
        { message: "Invalid request.", issues: error.flatten() },
        400,
      );
    }

    if (error instanceof MarketingAssetServiceError) {
      const status =
        error.code === "not_found"
          ? 404
          : error.code === "conflict"
            ? 409
            : 400;
      return c.json({ message: error.message }, status);
    }

    throw error;
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

  app.get("/api/marketing/assets/:id/preview", async (c) => {
    const requestContext = await getRequestContext(c.req.raw);
    if (!requestContext.user && !requestContext.isAgent) {
      return unauthorizedResponse(c);
    }

    const assetId = Number.parseInt(c.req.param("id"), 10);
    if (!Number.isInteger(assetId) || assetId <= 0) {
      return c.json({ message: "Invalid asset id." }, 400);
    }

    const organizationId = requestContext.isAgent
      ? c.req.query("organizationId") ?? undefined
      : requestContext.organizationId ?? undefined;
    const asset = await getMarketingAsset(
      requestContext.db,
      assetId,
      organizationId,
    );

    if (!asset) {
      return c.json({ message: "Asset not found." }, 404);
    }

    return c.body(asset.currentHtml, 200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "x-content-type-options": "nosniff",
    });
  });

  app.get("/api/marketing/assets/:id/pdf", async (c) => {
    const requestContext = await getRequestContext(c.req.raw);
    if (!requestContext.user && !requestContext.isAgent) {
      return unauthorizedResponse(c);
    }

    const assetId = Number.parseInt(c.req.param("id"), 10);
    if (!Number.isInteger(assetId) || assetId <= 0) {
      return c.json({ message: "Invalid asset id." }, 400);
    }

    const organizationId = requestContext.isAgent
      ? c.req.query("organizationId") ?? undefined
      : requestContext.organizationId ?? undefined;
    const asset = await getMarketingAsset(
      requestContext.db,
      assetId,
      organizationId,
    );

    if (!asset) {
      return c.json({ message: "Asset not found." }, 404);
    }

    try {
      const pdf = await renderMarketingAssetPdf(asset.currentHtml);
      const filename = buildMarketingAssetPdfFilename(asset);

      return new Response(Uint8Array.from(pdf), {
        status: 200,
        headers: {
          "content-type": "application/pdf",
          "content-disposition": `attachment; filename="${filename}"`,
          "cache-control": "no-store, no-cache, must-revalidate",
          "x-content-type-options": "nosniff",
        },
      });
    } catch (error) {
      if (error instanceof MarketingAssetPdfError) {
        return c.json({ message: error.message }, 500);
      }

      throw error;
    }
  });

  app.get("/api/marketing/assets/:id/stream", async (c) => {
    const requestContext = await getRequestContext(c.req.raw);
    if (!requestContext.user && !requestContext.isAgent) {
      return unauthorizedResponse(c);
    }

    const assetId = Number.parseInt(c.req.param("id"), 10);
    if (!Number.isInteger(assetId) || assetId <= 0) {
      return c.json({ message: "Invalid asset id." }, 400);
    }

    const organizationId = requestContext.isAgent
      ? c.req.query("organizationId") ?? undefined
      : requestContext.organizationId ?? undefined;
    const asset = await getMarketingAsset(
      requestContext.db,
      assetId,
      organizationId,
    );

    if (!asset) {
      return c.json({ message: "Asset not found." }, 404);
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        };

        send({
          assetId: asset.id,
          version: asset.currentVersion,
          updatedAt: new Date(asset.updatedAt).toISOString(),
        });

        const unsubscribe = subscribeToMarketingAsset(asset.id, (event) => {
          send(event);
        });

        const keepAlive = setInterval(() => {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        }, 15_000);

        const closeStream = () => {
          clearInterval(keepAlive);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // Stream may already be closed.
          }
        };

        c.req.raw.signal.addEventListener("abort", closeStream, { once: true });
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  });

  app.get("/api/marketing/agent/assets", async (c) => {
    const requestContext = await getRequestContext(c.req.raw);
    if (!requestContext.isAgent) {
      return unauthorizedResponse(c);
    }

    const organizationId = c.req.query("organizationId");
    if (!organizationId) {
      return c.json({ message: "organizationId is required." }, 400);
    }

    const assetType = c.req.query("assetType");
    const assets = await listMarketingAssets(
      requestContext.db,
      organizationId,
      assetType === "ebook" ||
        assetType === "email" ||
        assetType === "landing_page" ||
        assetType === "social"
        ? assetType
        : undefined,
    );
    return c.json({ items: assets });
  });

  app.get("/api/marketing/agent/assets/:id", async (c) => {
    const requestContext = await getRequestContext(c.req.raw);
    if (!requestContext.isAgent) {
      return unauthorizedResponse(c);
    }

    const assetId = Number.parseInt(c.req.param("id"), 10);
    if (!Number.isInteger(assetId) || assetId <= 0) {
      return c.json({ message: "Invalid asset id." }, 400);
    }

    const asset = await getMarketingAsset(requestContext.db, assetId);
    if (!asset) {
      return c.json({ message: "Asset not found." }, 404);
    }

    return c.json({ item: asset });
  });

  app.post("/api/marketing/agent/assets", async (c) => {
    const requestContext = await getRequestContext(c.req.raw);
    if (!requestContext.isAgent) {
      return unauthorizedResponse(c);
    }

    try {
      const rawBody = await c.req.json();
      const body = rawBody && typeof rawBody === "object" ? rawBody : {};
      const input = marketingAssetCreateInputSchema.parse({
        ...body,
        source: "source" in body ? body.source : "cli",
      });
      const asset = await createMarketingAsset(
        requestContext.db,
        input,
        marketingAssetStorageRoot,
      );
      return c.json({ item: asset }, 201);
    } catch (error) {
      return handleMarketingError(c, error);
    }
  });

  app.patch("/api/marketing/agent/assets/:id", async (c) => {
    const requestContext = await getRequestContext(c.req.raw);
    if (!requestContext.isAgent) {
      return unauthorizedResponse(c);
    }

    const assetId = Number.parseInt(c.req.param("id"), 10);
    if (!Number.isInteger(assetId) || assetId <= 0) {
      return c.json({ message: "Invalid asset id." }, 400);
    }

    try {
      const rawBody = await c.req.json();
      const body = rawBody && typeof rawBody === "object" ? rawBody : {};
      const input = marketingAssetUpdateInputSchema.parse({
        ...body,
        id: assetId,
        source: "source" in body ? body.source : "cli",
      });
      const asset = await updateMarketingAsset(
        requestContext.db,
        input,
        marketingAssetStorageRoot,
      );
      return c.json({ item: asset });
    } catch (error) {
      return handleMarketingError(c, error);
    }
  });

  app.get("/api/marketing/ebooks/:id/preview", async (c) => {
    const requestContext = await getRequestContext(c.req.raw);
    if (!requestContext.user && !requestContext.isAgent) {
      return unauthorizedResponse(c);
    }

    const ebookId = Number.parseInt(c.req.param("id"), 10);
    if (!Number.isInteger(ebookId) || ebookId <= 0) {
      return c.json({ message: "Invalid ebook id." }, 400);
    }

    const organizationId = requestContext.isAgent
      ? c.req.query("organizationId") ?? undefined
      : requestContext.organizationId ?? undefined;
    const ebook = await getMarketingEbook(
      requestContext.db,
      ebookId,
      organizationId,
    );

    if (!ebook) {
      return c.json({ message: "Ebook not found." }, 404);
    }

    return c.body(ebook.currentHtml, 200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store, no-cache, must-revalidate",
      "x-content-type-options": "nosniff",
    });
  });

  app.get("/api/marketing/ebooks/:id/stream", async (c) => {
    const requestContext = await getRequestContext(c.req.raw);
    if (!requestContext.user && !requestContext.isAgent) {
      return unauthorizedResponse(c);
    }

    const ebookId = Number.parseInt(c.req.param("id"), 10);
    if (!Number.isInteger(ebookId) || ebookId <= 0) {
      return c.json({ message: "Invalid ebook id." }, 400);
    }

    const organizationId = requestContext.isAgent
      ? c.req.query("organizationId") ?? undefined
      : requestContext.organizationId ?? undefined;
    const ebook = await getMarketingEbook(
      requestContext.db,
      ebookId,
      organizationId,
    );

    if (!ebook) {
      return c.json({ message: "Ebook not found." }, 404);
    }

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        };

        send({
          ebookId: ebook.id,
          version: ebook.currentVersion,
          updatedAt: new Date(ebook.updatedAt).toISOString(),
        });

        const unsubscribe = subscribeToMarketingEbook(ebook.id, (event) => {
          send(event);
        });

        const keepAlive = setInterval(() => {
          controller.enqueue(encoder.encode(": keep-alive\n\n"));
        }, 15_000);

        const closeStream = () => {
          clearInterval(keepAlive);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // Stream may already be closed.
          }
        };

        c.req.raw.signal.addEventListener("abort", closeStream, { once: true });
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store, no-cache, must-revalidate",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      },
    });
  });

  app.get("/api/marketing/agent/ebooks", async (c) => {
    const requestContext = await getRequestContext(c.req.raw);
    if (!requestContext.isAgent) {
      return unauthorizedResponse(c);
    }

    const organizationId = c.req.query("organizationId");
    if (!organizationId) {
      return c.json({ message: "organizationId is required." }, 400);
    }

    const ebooks = await listMarketingEbooks(requestContext.db, organizationId);
    return c.json({ items: ebooks });
  });

  app.get("/api/marketing/agent/ebooks/:id", async (c) => {
    const requestContext = await getRequestContext(c.req.raw);
    if (!requestContext.isAgent) {
      return unauthorizedResponse(c);
    }

    const ebookId = Number.parseInt(c.req.param("id"), 10);
    if (!Number.isInteger(ebookId) || ebookId <= 0) {
      return c.json({ message: "Invalid ebook id." }, 400);
    }

    const ebook = await getMarketingEbook(requestContext.db, ebookId);
    if (!ebook) {
      return c.json({ message: "Ebook not found." }, 404);
    }

    return c.json({ item: ebook });
  });

  app.post("/api/marketing/agent/ebooks", async (c) => {
    const requestContext = await getRequestContext(c.req.raw);
    if (!requestContext.isAgent) {
      return unauthorizedResponse(c);
    }

    try {
      const rawBody = await c.req.json();
      const body = rawBody && typeof rawBody === "object" ? rawBody : {};
      const input = marketingEbookCreateInputSchema.parse({
        ...body,
        source: "source" in body ? body.source : "cli",
      });
      const ebook = await createMarketingEbook(
        requestContext.db,
        input,
        marketingAssetStorageRoot,
      );
      return c.json({ item: ebook }, 201);
    } catch (error) {
      return handleMarketingError(c, error);
    }
  });

  app.patch("/api/marketing/agent/ebooks/:id", async (c) => {
    const requestContext = await getRequestContext(c.req.raw);
    if (!requestContext.isAgent) {
      return unauthorizedResponse(c);
    }

    const ebookId = Number.parseInt(c.req.param("id"), 10);
    if (!Number.isInteger(ebookId) || ebookId <= 0) {
      return c.json({ message: "Invalid ebook id." }, 400);
    }

    try {
      const rawBody = await c.req.json();
      const body = rawBody && typeof rawBody === "object" ? rawBody : {};
      const input = marketingEbookUpdateInputSchema.parse({
        ...body,
        id: ebookId,
        source: "source" in body ? body.source : "cli",
      });
      const ebook = await updateMarketingEbook(
        requestContext.db,
        input,
        marketingAssetStorageRoot,
      );
      return c.json({ item: ebook });
    } catch (error) {
      return handleMarketingError(c, error);
    }
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
