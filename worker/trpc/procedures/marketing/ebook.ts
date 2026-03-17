import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { orgProcedure, router } from "../../init.ts";
import {
  MarketingEbookServiceError,
  createMarketingEbook,
  getMarketingEbook,
  listMarketingEbookRevisions,
  listMarketingEbooks,
  marketingEbookCreateInputSchema,
  marketingEbookUpdateInputSchema,
  resolveMarketingEbookStorageRoot,
  updateMarketingEbook,
} from "../../../lib/marketing-ebook.ts";

const createInputSchema = marketingEbookCreateInputSchema.extend({
  organizationId: z.string().trim().min(1).optional(),
});

const updateInputSchema = marketingEbookUpdateInputSchema.extend({
  organizationId: z.string().trim().min(1).optional(),
});

function resolveOrganizationId(
  ctx: { organizationId: string | null },
  explicitOrganizationId?: string,
): string {
  const organizationId = ctx.organizationId ?? explicitOrganizationId;
  if (!organizationId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "An organization is required for ebook operations.",
    });
  }

  return organizationId;
}

function throwAsTrpcError(error: unknown): never {
  if (!(error instanceof MarketingEbookServiceError)) {
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

export const marketingEbookRouter = router({
  list: orgProcedure.query(async ({ ctx }) => {
    const organizationId = resolveOrganizationId(ctx);
    return listMarketingEbooks(ctx.db, organizationId);
  }),

  get: orgProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const organizationId = resolveOrganizationId(ctx);
      const ebook = await getMarketingEbook(ctx.db, input.id, organizationId);
      return ebook ?? null;
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
        return await listMarketingEbookRevisions(
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
      return await createMarketingEbook(
        ctx.db,
        {
          ...input,
          organizationId,
          source: input.source ?? (ctx.isAgent ? "agent" : "user"),
        },
        resolveMarketingEbookStorageRoot(ctx.ebookStorageRoot),
      );
    } catch (error) {
      return throwAsTrpcError(error);
    }
  }),

  update: orgProcedure.input(updateInputSchema).mutation(async ({ ctx, input }) => {
    try {
      return await updateMarketingEbook(
        ctx.db,
        {
          ...input,
          organizationId: resolveOrganizationId(ctx, input.organizationId),
          source: input.source ?? (ctx.isAgent ? "agent" : "user"),
        },
        resolveMarketingEbookStorageRoot(ctx.ebookStorageRoot),
      );
    } catch (error) {
      return throwAsTrpcError(error);
    }
  }),
});
