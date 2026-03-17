import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { orgProcedure, router } from "../../init.ts";
import {
  MarketingAssetServiceError,
  createMarketingAsset,
  getMarketingAsset,
  listMarketingAssetRevisions,
  listMarketingAssets,
  marketingAssetCreateInputSchema,
  marketingAssetUpdateInputSchema,
  resolveMarketingAssetStorageRoot,
  updateMarketingAsset,
} from "../../../lib/marketing-asset.ts";

const createInputSchema = marketingAssetCreateInputSchema.extend({
  organizationId: z.string().trim().min(1).optional(),
});

const updateInputSchema = marketingAssetUpdateInputSchema.extend({
  organizationId: z.string().trim().min(1).optional(),
});

const listInputSchema = z
  .object({
    assetType: z
      .enum(["ebook", "email", "landing_page", "social"])
      .optional(),
  })
  .optional();

function resolveOrganizationId(
  ctx: { organizationId: string | null },
  explicitOrganizationId?: string,
): string {
  const organizationId = ctx.organizationId ?? explicitOrganizationId;
  if (!organizationId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "An organization is required for marketing asset operations.",
    });
  }

  return organizationId;
}

function throwAsTrpcError(error: unknown): never {
  if (!(error instanceof MarketingAssetServiceError)) {
    throw error;
  }

  switch (error.code) {
    case "bad_request":
      throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
    case "conflict":
      throw new TRPCError({ code: "CONFLICT", message: error.message });
    case "not_found":
      throw new TRPCError({ code: "NOT_FOUND", message: error.message });
  }
}

export const marketingAssetRouter = router({
  list: orgProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
    const organizationId = resolveOrganizationId(ctx);
    return listMarketingAssets(ctx.db, organizationId, input?.assetType);
  }),

  get: orgProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const organizationId = resolveOrganizationId(ctx);
      const asset = await getMarketingAsset(ctx.db, input.id, organizationId);
      return asset ?? null;
    }),

  revisions: orgProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        limit: z.number().int().positive().max(25).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      try {
        const organizationId = resolveOrganizationId(ctx);
        return await listMarketingAssetRevisions(
          ctx.db,
          input.id,
          organizationId,
          input.limit ?? 8,
        );
      } catch (error) {
        return throwAsTrpcError(error);
      }
    }),

  create: orgProcedure.input(createInputSchema).mutation(async ({ ctx, input }) => {
    try {
      const organizationId = resolveOrganizationId(ctx, input.organizationId);
      return await createMarketingAsset(
        ctx.db,
        {
          ...input,
          organizationId,
          source: input.source ?? (ctx.isAgent ? "agent" : "user"),
        },
        resolveMarketingAssetStorageRoot(ctx.ebookStorageRoot),
      );
    } catch (error) {
      return throwAsTrpcError(error);
    }
  }),

  update: orgProcedure.input(updateInputSchema).mutation(async ({ ctx, input }) => {
    try {
      return await updateMarketingAsset(
        ctx.db,
        {
          ...input,
          organizationId: resolveOrganizationId(ctx, input.organizationId),
          source: input.source ?? (ctx.isAgent ? "agent" : "user"),
        },
        resolveMarketingAssetStorageRoot(ctx.ebookStorageRoot),
      );
    } catch (error) {
      return throwAsTrpcError(error);
    }
  }),
});
