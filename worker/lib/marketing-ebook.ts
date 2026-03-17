import { z } from "zod";
import type { Database } from "../db/client.ts";
import {
  MarketingAssetServiceError,
  buildDefaultMarketingAssetHtml,
  createMarketingAsset,
  getMarketingAsset,
  listMarketingAssetRevisions,
  listMarketingAssets,
  marketingAssetCreateInputSchema,
  marketingAssetUpdateInputSchema,
  resolveMarketingAssetStorageRoot,
  updateMarketingAsset,
  type MarketingAssetRecord,
  type MarketingAssetRevisionRecord,
} from "./marketing-asset.ts";

export type MarketingEbookRecord = MarketingAssetRecord;
export type MarketingEbookRevisionRecord = MarketingAssetRevisionRecord;
export class MarketingEbookServiceError extends MarketingAssetServiceError {}

export const marketingEbookCreateInputSchema = marketingAssetCreateInputSchema
  .omit({ assetType: true });

export const marketingEbookUpdateInputSchema = marketingAssetUpdateInputSchema
  .omit({ assetType: true });

export function buildDefaultEbookHtml(title: string): string {
  return buildDefaultMarketingAssetHtml(title, "ebook");
}

export function resolveMarketingEbookStorageRoot(configuredRoot?: string): string {
  return resolveMarketingAssetStorageRoot(configuredRoot);
}

async function requireEbook(
  db: Database,
  ebookId: number,
  organizationId?: string,
): Promise<MarketingEbookRecord> {
  const ebook = await getMarketingEbook(db, ebookId, organizationId);
  if (!ebook) {
    throw new MarketingAssetServiceError("not_found", "Ebook not found.");
  }

  return ebook;
}

export async function listMarketingEbooks(
  db: Database,
  organizationId: string,
): Promise<MarketingEbookRecord[]> {
  return listMarketingAssets(db, organizationId, "ebook");
}

export async function getMarketingEbook(
  db: Database,
  ebookId: number,
  organizationId?: string,
): Promise<MarketingEbookRecord | null> {
  const asset = await getMarketingAsset(db, ebookId, organizationId);
  if (!asset || asset.assetType !== "ebook") {
    return null;
  }

  return asset;
}

export async function listMarketingEbookRevisions(
  db: Database,
  ebookId: number,
  organizationId?: string,
  limit = 10,
): Promise<MarketingEbookRevisionRecord[]> {
  await requireEbook(db, ebookId, organizationId);

  const revisions = await listMarketingAssetRevisions(
    db,
    ebookId,
    organizationId,
    limit,
  );

  return revisions.filter((revision) => revision.assetType === "ebook");
}

export async function createMarketingEbook(
  db: Database,
  input: z.infer<typeof marketingEbookCreateInputSchema>,
  storageRoot: string,
): Promise<MarketingEbookRecord> {
  return createMarketingAsset(
    db,
    {
      ...input,
      assetType: "ebook",
    },
    storageRoot,
  );
}

export async function updateMarketingEbook(
  db: Database,
  input: z.infer<typeof marketingEbookUpdateInputSchema>,
  storageRoot: string,
): Promise<MarketingEbookRecord> {
  await requireEbook(db, input.id, input.organizationId);

  return updateMarketingAsset(
    db,
    {
      ...input,
      assetType: "ebook",
    },
    storageRoot,
  );
}
