import path from "node:path";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/client.ts";
import {
  marketingAssetRevisions,
  marketingAssets,
} from "../../drizzle/schema/marketing.ts";
import { publishMarketingAssetEvent } from "./marketing-asset-events.ts";

const MARKETING_ASSET_TYPES = [
  "ebook",
  "email",
  "landing_page",
  "social",
] as const;
const MARKETING_ASSET_STATUSES = ["draft", "published", "archived"] as const;
const MARKETING_ASSET_SOURCES = ["user", "agent", "cli"] as const;

export const marketingAssetCreateInputSchema = z.object({
  organizationId: z.string().trim().min(1),
  assetType: z.enum(MARKETING_ASSET_TYPES),
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4_000).optional(),
  html: z.string().optional(),
  status: z.enum(MARKETING_ASSET_STATUSES).optional(),
  summary: z.string().trim().max(1_000).optional(),
  updatedBy: z.string().trim().max(200).optional(),
  source: z.enum(MARKETING_ASSET_SOURCES).optional(),
});

export const marketingAssetUpdateInputSchema = z.object({
  id: z.number().int().positive(),
  organizationId: z.string().trim().min(1).optional(),
  assetType: z.enum(MARKETING_ASSET_TYPES).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4_000).nullable().optional(),
  html: z.string().optional(),
  status: z.enum(MARKETING_ASSET_STATUSES).optional(),
  summary: z.string().trim().max(1_000).optional(),
  updatedBy: z.string().trim().max(200).optional(),
  source: z.enum(MARKETING_ASSET_SOURCES).optional(),
});

export type MarketingAssetType = (typeof MARKETING_ASSET_TYPES)[number];
export type MarketingAssetStatus = (typeof MARKETING_ASSET_STATUSES)[number];
export type MarketingAssetSource = (typeof MARKETING_ASSET_SOURCES)[number];
export type MarketingAssetRecord = typeof marketingAssets.$inferSelect;
export type MarketingAssetRevisionRecord =
  typeof marketingAssetRevisions.$inferSelect;

export class MarketingAssetServiceError extends Error {
  readonly code: "bad_request" | "not_found" | "conflict";

  constructor(
    code: "bad_request" | "not_found" | "conflict",
    message: string,
  ) {
    super(message);
    this.name = "MarketingAssetServiceError";
    this.code = code;
  }
}

function slugifyValue(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return slug || "asset";
}

function sanitizePathSegment(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return sanitized || "default";
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatAssetLabel(assetType: MarketingAssetType): string {
  switch (assetType) {
    case "ebook":
      return "ebook";
    case "email":
      return "email";
    case "landing_page":
      return "landing page";
    case "social":
      return "social asset";
  }
}

export function buildDefaultMarketingAssetHtml(
  title: string,
  assetType: MarketingAssetType,
): string {
  const safeTitle = escapeHtml(title);
  const assetLabel = escapeHtml(formatAssetLabel(assetType));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f4ee;
        --surface: rgba(255, 255, 255, 0.78);
        --text: #1f1d29;
        --muted: #666171;
        --accent: #6f4ef6;
        --border: rgba(31, 29, 41, 0.08);
      }

      * { box-sizing: border-box; }

      body {
        margin: 0;
        min-height: 100vh;
        font-family: "Georgia", "Times New Roman", serif;
        background:
          radial-gradient(circle at top, rgba(111, 78, 246, 0.14), transparent 34%),
          linear-gradient(180deg, #fbfaf6 0%, var(--bg) 100%);
        color: var(--text);
      }

      main {
        width: min(860px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 72px 0 96px;
      }

      .eyebrow {
        letter-spacing: 0.18em;
        text-transform: uppercase;
        font-family: ui-sans-serif, system-ui, sans-serif;
        font-size: 12px;
        color: var(--muted);
      }

      .hero {
        padding: 48px;
        border: 1px solid var(--border);
        border-radius: 28px;
        background: var(--surface);
        backdrop-filter: blur(10px);
      }

      h1 {
        margin: 12px 0 16px;
        font-size: clamp(40px, 7vw, 74px);
        line-height: 0.95;
        font-weight: 400;
      }

      p {
        margin: 0;
        max-width: 60ch;
        color: var(--muted);
        font-size: 18px;
        line-height: 1.7;
      }

      section {
        margin-top: 28px;
        padding: 36px 40px;
        border-radius: 24px;
        border: 1px solid var(--border);
        background: rgba(255, 255, 255, 0.7);
      }

      h2 {
        margin: 0 0 14px;
        font-size: 28px;
        font-weight: 400;
      }

      .callout {
        margin-top: 24px;
        padding: 20px 24px;
        border-left: 3px solid var(--accent);
        background: rgba(111, 78, 246, 0.08);
        color: var(--text);
      }
    </style>
  </head>
  <body>
    <main>
      <div class="hero">
        <div class="eyebrow">Draft ${assetLabel}</div>
        <h1>${safeTitle}</h1>
        <p>
          This preview is live. The agent can keep replacing this HTML, and the
          viewer in HQ will refresh in place as new revisions arrive.
        </p>
      </div>

      <section>
        <h2>Start Writing</h2>
        <p>
          Replace this template with your real ${assetLabel} layout. The server stores
          every revision, writes the latest HTML to disk, and streams version
          changes back to the open preview.
        </p>
        <div class="callout">
          Treat this as the draft surface for AI-driven edits. Each update can
          replace the full document.
        </div>
      </section>
    </main>
  </body>
</html>`;
}

export function resolveMarketingAssetStorageRoot(configuredRoot?: string): string {
  return configuredRoot
    ? path.resolve(configuredRoot)
    : path.resolve(process.cwd(), ".hq-storage", "marketing-assets");
}

function buildRelativeStoragePath(
  organizationId: string,
  assetType: MarketingAssetType,
  assetId: number,
): string {
  return path.posix.join(
    sanitizePathSegment(organizationId),
    sanitizePathSegment(assetType),
    String(assetId),
    "index.html",
  );
}

function resolveStorageFilePath(storageRoot: string, relativeStoragePath: string): string {
  return path.resolve(storageRoot, relativeStoragePath);
}

async function writeHtmlSnapshot(
  storageRoot: string,
  relativeStoragePath: string,
  html: string,
): Promise<void> {
  const filePath = resolveStorageFilePath(storageRoot, relativeStoragePath);
  const tempFilePath = `${filePath}.tmp-${process.pid}-${Date.now()}`;

  await mkdir(path.dirname(filePath), { recursive: true });

  try {
    await writeFile(tempFilePath, html, "utf8");
    await rename(tempFilePath, filePath);
  } catch (error) {
    await unlink(tempFilePath).catch(() => {});
    throw error;
  }
}

function buildScopedWhere(
  organizationId: string | undefined,
  assetId: number,
) {
  if (!organizationId) {
    return eq(marketingAssets.id, assetId);
  }

  return and(
    eq(marketingAssets.id, assetId),
    eq(marketingAssets.organizationId, organizationId),
  );
}

async function ensureUniqueSlug(
  db: Database,
  organizationId: string,
  assetType: MarketingAssetType,
  requestedSlug: string,
  currentAssetId?: number,
): Promise<string> {
  const baseSlug = slugifyValue(requestedSlug);
  let slugCandidate = baseSlug;
  let suffix = 2;

  while (true) {
    const conditions = [
      eq(marketingAssets.organizationId, organizationId),
      eq(marketingAssets.assetType, assetType),
      eq(marketingAssets.slug, slugCandidate),
    ];

    if (typeof currentAssetId === "number") {
      conditions.push(ne(marketingAssets.id, currentAssetId));
    }

    const [existing] = await db
      .select()
      .from(marketingAssets)
      .where(and(...conditions))
      .limit(1);

    if (!existing) {
      return slugCandidate;
    }

    slugCandidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function createRevisionPayload(
  asset: MarketingAssetRecord,
  summary: string | null,
): typeof marketingAssetRevisions.$inferInsert {
  return {
    assetId: asset.id,
    version: asset.currentVersion,
    assetType: asset.assetType,
    title: asset.title,
    slug: asset.slug,
    description: asset.description,
    status: asset.status,
    html: asset.currentHtml,
    summary,
    updatedBy: asset.lastUpdatedBy,
    source: asset.lastUpdateSource,
  };
}

export async function listMarketingAssets(
  db: Database,
  organizationId: string,
  assetType?: MarketingAssetType,
): Promise<MarketingAssetRecord[]> {
  const conditions = [eq(marketingAssets.organizationId, organizationId)];
  if (assetType) {
    conditions.push(eq(marketingAssets.assetType, assetType));
  }

  return db
    .select()
    .from(marketingAssets)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .orderBy(desc(marketingAssets.updatedAt));
}

export async function getMarketingAsset(
  db: Database,
  assetId: number,
  organizationId?: string,
): Promise<MarketingAssetRecord | null> {
  const [asset] = await db
    .select()
    .from(marketingAssets)
    .where(buildScopedWhere(organizationId, assetId))
    .limit(1);

  return asset ?? null;
}

export async function listMarketingAssetRevisions(
  db: Database,
  assetId: number,
  organizationId?: string,
  limit = 10,
): Promise<MarketingAssetRevisionRecord[]> {
  const asset = await getMarketingAsset(db, assetId, organizationId);
  if (!asset) {
    throw new MarketingAssetServiceError("not_found", "Asset not found.");
  }

  return db
    .select()
    .from(marketingAssetRevisions)
    .where(eq(marketingAssetRevisions.assetId, asset.id))
    .orderBy(desc(marketingAssetRevisions.version))
    .limit(limit);
}

export async function createMarketingAsset(
  db: Database,
  input: z.infer<typeof marketingAssetCreateInputSchema>,
  storageRoot: string,
): Promise<MarketingAssetRecord> {
  const title = input.title.trim();
  const slug = await ensureUniqueSlug(
    db,
    input.organizationId,
    input.assetType,
    input.slug ?? title,
  );
  const html =
    input.html ?? buildDefaultMarketingAssetHtml(title, input.assetType);
  const description = normalizeOptionalText(input.description);
  const summary = normalizeOptionalText(input.summary);
  const source: MarketingAssetSource = input.source ?? "user";
  const updatedBy = normalizeOptionalText(input.updatedBy);
  const status: MarketingAssetStatus = input.status ?? "draft";

  const [created] = await db
    .insert(marketingAssets)
    .values({
      organizationId: input.organizationId,
      assetType: input.assetType,
      title,
      slug,
      description,
      status,
      currentHtml: html,
      currentVersion: 1,
      lastUpdatedBy: updatedBy,
      lastUpdateSource: source,
    })
    .returning();

  const storagePath = buildRelativeStoragePath(
    created.organizationId,
    created.assetType,
    created.id,
  );

  try {
    await writeHtmlSnapshot(storageRoot, storagePath, html);
  } catch (error) {
    await db.delete(marketingAssets).where(eq(marketingAssets.id, created.id));
    throw error;
  }

  const [asset] = await db
    .update(marketingAssets)
    .set({ storagePath, updatedAt: new Date() })
    .where(eq(marketingAssets.id, created.id))
    .returning();

  await db.insert(marketingAssetRevisions).values(
    createRevisionPayload(asset, summary),
  );

  publishMarketingAssetEvent({
    assetId: asset.id,
    version: asset.currentVersion,
    updatedAt: new Date(asset.updatedAt).toISOString(),
  });

  return asset;
}

export async function updateMarketingAsset(
  db: Database,
  input: z.infer<typeof marketingAssetUpdateInputSchema>,
  storageRoot: string,
): Promise<MarketingAssetRecord> {
  const existing = await getMarketingAsset(db, input.id, input.organizationId);
  if (!existing) {
    throw new MarketingAssetServiceError("not_found", "Asset not found.");
  }

  const assetType = input.assetType ?? existing.assetType;
  const nextTitle = input.title?.trim() ?? existing.title;
  const nextSlug = input.slug
    ? await ensureUniqueSlug(
        db,
        existing.organizationId,
        assetType,
        input.slug,
        existing.id,
      )
    : existing.slug;
  const nextDescription =
    input.description === undefined
      ? existing.description
      : normalizeOptionalText(input.description);
  const nextStatus = input.status ?? existing.status;
  const nextHtml = input.html ?? existing.currentHtml;
  const nextVersion = existing.currentVersion + 1;
  const updatedBy = normalizeOptionalText(input.updatedBy) ?? existing.lastUpdatedBy;
  const source: MarketingAssetSource = input.source ?? "user";
  const storagePath =
    existing.storagePath ??
    buildRelativeStoragePath(existing.organizationId, assetType, existing.id);

  const [asset] = await db
    .update(marketingAssets)
    .set({
      assetType,
      title: nextTitle,
      slug: nextSlug,
      description: nextDescription,
      status: nextStatus,
      currentHtml: nextHtml,
      currentVersion: nextVersion,
      storagePath,
      lastUpdatedBy: updatedBy,
      lastUpdateSource: source,
      updatedAt: new Date(),
    })
    .where(eq(marketingAssets.id, existing.id))
    .returning();

  await writeHtmlSnapshot(storageRoot, storagePath, nextHtml);

  await db.insert(marketingAssetRevisions).values(
    createRevisionPayload(asset, normalizeOptionalText(input.summary)),
  );

  publishMarketingAssetEvent({
    assetId: asset.id,
    version: asset.currentVersion,
    updatedAt: new Date(asset.updatedAt).toISOString(),
  });

  return asset;
}
