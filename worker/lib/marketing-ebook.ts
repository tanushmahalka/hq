import path from "node:path";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";
import type { Database } from "../db/client.ts";
import {
  marketingEbookRevisions,
  marketingEbooks,
} from "../../shared/schema.ts";
import { publishMarketingEbookEvent } from "./marketing-ebook-events.ts";

const MARKETING_EBOOK_STATUSES = ["draft", "published", "archived"] as const;
const MARKETING_EBOOK_SOURCES = ["user", "agent", "cli"] as const;

export const marketingEbookCreateInputSchema = z.object({
  organizationId: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4_000).optional(),
  html: z.string().optional(),
  status: z.enum(MARKETING_EBOOK_STATUSES).optional(),
  summary: z.string().trim().max(1_000).optional(),
  updatedBy: z.string().trim().max(200).optional(),
  source: z.enum(MARKETING_EBOOK_SOURCES).optional(),
});

export const marketingEbookUpdateInputSchema = z.object({
  id: z.number().int().positive(),
  organizationId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  slug: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4_000).nullable().optional(),
  html: z.string().optional(),
  status: z.enum(MARKETING_EBOOK_STATUSES).optional(),
  summary: z.string().trim().max(1_000).optional(),
  updatedBy: z.string().trim().max(200).optional(),
  source: z.enum(MARKETING_EBOOK_SOURCES).optional(),
});

export type MarketingEbookRecord = typeof marketingEbooks.$inferSelect;
export type MarketingEbookRevisionRecord =
  typeof marketingEbookRevisions.$inferSelect;
type MarketingEbookStatus = (typeof MARKETING_EBOOK_STATUSES)[number];
type MarketingEbookSource = (typeof MARKETING_EBOOK_SOURCES)[number];

export class MarketingEbookServiceError extends Error {
  readonly code: "bad_request" | "not_found" | "conflict";

  constructor(
    code: "bad_request" | "not_found" | "conflict",
    message: string,
  ) {
    super(message);
    this.name = "MarketingEbookServiceError";
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

  return slug || "ebook";
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

export function buildDefaultEbookHtml(title: string): string {
  const safeTitle = escapeHtml(title);

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

      * {
        box-sizing: border-box;
      }

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
        <div class="eyebrow">Draft ebook</div>
        <h1>${safeTitle}</h1>
        <p>
          This preview is live. The agent can keep replacing this HTML, and the
          viewer in HQ will refresh in place as new revisions arrive.
        </p>
      </div>

      <section>
        <h2>Start Writing</h2>
        <p>
          Replace this template with your real ebook layout. The server stores
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

export function resolveMarketingEbookStorageRoot(
  configuredRoot?: string,
): string {
  return configuredRoot
    ? path.resolve(configuredRoot)
    : path.resolve(process.cwd(), ".hq-storage", "ebooks");
}

function buildRelativeStoragePath(
  organizationId: string,
  ebookId: number,
): string {
  return path.posix.join(
    sanitizePathSegment(organizationId),
    String(ebookId),
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
  ebookId: number,
) {
  if (!organizationId) {
    return eq(marketingEbooks.id, ebookId);
  }

  return and(
    eq(marketingEbooks.id, ebookId),
    eq(marketingEbooks.organizationId, organizationId),
  );
}

async function ensureUniqueSlug(
  db: Database,
  organizationId: string,
  requestedSlug: string,
  currentEbookId?: number,
): Promise<string> {
  const baseSlug = slugifyValue(requestedSlug);
  let slugCandidate = baseSlug;
  let suffix = 2;

  while (true) {
    const conditions = [
      eq(marketingEbooks.organizationId, organizationId),
      eq(marketingEbooks.slug, slugCandidate),
    ];

    if (typeof currentEbookId === "number") {
      conditions.push(ne(marketingEbooks.id, currentEbookId));
    }

    const [existing] = await db
      .select()
      .from(marketingEbooks)
      .where(conditions.length > 1 ? and(...conditions) : conditions[0])
      .limit(1);

    if (!existing) {
      return slugCandidate;
    }

    slugCandidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

function createRevisionPayload(
  ebook: MarketingEbookRecord,
  summary: string | null,
): typeof marketingEbookRevisions.$inferInsert {
  return {
    ebookId: ebook.id,
    version: ebook.currentVersion,
    title: ebook.title,
    slug: ebook.slug,
    description: ebook.description,
    status: ebook.status,
    html: ebook.currentHtml,
    summary,
    updatedBy: ebook.lastUpdatedBy,
    source: ebook.lastUpdateSource,
  };
}

export async function listMarketingEbooks(
  db: Database,
  organizationId: string,
): Promise<MarketingEbookRecord[]> {
  return db
    .select()
    .from(marketingEbooks)
    .where(eq(marketingEbooks.organizationId, organizationId))
    .orderBy(desc(marketingEbooks.updatedAt));
}

export async function getMarketingEbook(
  db: Database,
  ebookId: number,
  organizationId?: string,
): Promise<MarketingEbookRecord | null> {
  const [ebook] = await db
    .select()
    .from(marketingEbooks)
    .where(buildScopedWhere(organizationId, ebookId))
    .limit(1);

  return ebook ?? null;
}

export async function listMarketingEbookRevisions(
  db: Database,
  ebookId: number,
  organizationId?: string,
  limit = 10,
): Promise<MarketingEbookRevisionRecord[]> {
  const ebook = await getMarketingEbook(db, ebookId, organizationId);
  if (!ebook) {
    throw new MarketingEbookServiceError("not_found", "Ebook not found.");
  }

  return db
    .select()
    .from(marketingEbookRevisions)
    .where(eq(marketingEbookRevisions.ebookId, ebook.id))
    .orderBy(desc(marketingEbookRevisions.version))
    .limit(limit);
}

export async function createMarketingEbook(
  db: Database,
  input: z.infer<typeof marketingEbookCreateInputSchema>,
  storageRoot: string,
): Promise<MarketingEbookRecord> {
  const title = input.title.trim();
  const slug = await ensureUniqueSlug(
    db,
    input.organizationId,
    input.slug ?? title,
  );
  const html = input.html ?? buildDefaultEbookHtml(title);
  const description = normalizeOptionalText(input.description);
  const summary = normalizeOptionalText(input.summary);
  const source: MarketingEbookSource = input.source ?? "user";
  const updatedBy = normalizeOptionalText(input.updatedBy);
  const status: MarketingEbookStatus = input.status ?? "draft";

  const [created] = await db
    .insert(marketingEbooks)
    .values({
      organizationId: input.organizationId,
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

  const storagePath = buildRelativeStoragePath(created.organizationId, created.id);

  try {
    await writeHtmlSnapshot(storageRoot, storagePath, html);
  } catch (error) {
    await db.delete(marketingEbooks).where(eq(marketingEbooks.id, created.id));
    throw error;
  }

  const [ebook] = await db
    .update(marketingEbooks)
    .set({ storagePath, updatedAt: new Date() })
    .where(eq(marketingEbooks.id, created.id))
    .returning();

  await db.insert(marketingEbookRevisions).values(
    createRevisionPayload(ebook, summary),
  );

  publishMarketingEbookEvent({
    ebookId: ebook.id,
    version: ebook.currentVersion,
    updatedAt: new Date(ebook.updatedAt).toISOString(),
  });

  return ebook;
}

export async function updateMarketingEbook(
  db: Database,
  input: z.infer<typeof marketingEbookUpdateInputSchema>,
  storageRoot: string,
): Promise<MarketingEbookRecord> {
  const existing = await getMarketingEbook(db, input.id, input.organizationId);
  if (!existing) {
    throw new MarketingEbookServiceError("not_found", "Ebook not found.");
  }

  const nextTitle = input.title?.trim() ?? existing.title;
  const nextSlug = input.slug
    ? await ensureUniqueSlug(
        db,
        existing.organizationId,
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
  const source: MarketingEbookSource = input.source ?? "user";
  const storagePath =
    existing.storagePath ??
    buildRelativeStoragePath(existing.organizationId, existing.id);

  const [ebook] = await db
    .update(marketingEbooks)
    .set({
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
    .where(eq(marketingEbooks.id, existing.id))
    .returning();

  await writeHtmlSnapshot(storageRoot, storagePath, nextHtml);

  await db.insert(marketingEbookRevisions).values(
    createRevisionPayload(ebook, normalizeOptionalText(input.summary)),
  );

  publishMarketingEbookEvent({
    ebookId: ebook.id,
    version: ebook.currentVersion,
    updatedAt: new Date(ebook.updatedAt).toISOString(),
  });

  return ebook;
}
