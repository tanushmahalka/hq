import { z } from "zod";
import { router, orgProcedure } from "../init.ts";
import {
  captureBacklinkFootprints,
  getAnalyticsSummary,
  getBacklinksData,
  getBacklinksByDomain,
  getKeywordsData,
  getSeoOverview,
  updateOpportunityStatus,
} from "../../lib/seo.ts";
import { getGeoOverview } from "../../lib/geo.ts";

export const seoRouter = router({
  overview: orgProcedure.query(async ({ ctx }) => {
    return getSeoOverview(ctx.db);
  }),
  analytics: orgProcedure
    .input(
      z.object({
        siteId: z.number(),
        startDate: z.string(),
        endDate: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getAnalyticsSummary(ctx.db, input.siteId, input.startDate, input.endDate);
    }),
  backlinks: orgProcedure
    .input(
      z.object({
        siteId: z.number(),
        subview: z.enum(["existing", "competitors", "opportunities"]),
        search: z.string().optional(),
        statusFilter: z.string().optional(),
        page: z.number().int().min(1).optional(),
        pageSize: z.number().int().min(1).max(100).optional(),
        sortBy: z.string().optional(),
        sortDirection: z.enum(["asc", "desc"]).optional(),
        summaryOnly: z.boolean().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getBacklinksData(ctx.db, input);
    }),
  keywords: orgProcedure
    .input(
      z.object({
        siteId: z.number(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(50),
        search: z.string().optional(),
        sortBy: z
          .enum(["keyword", "searchVolume", "keywordDifficulty", "ourPosition", "bestCompetitorRank"])
          .default("searchVolume"),
        sortDirection: z.enum(["asc", "desc"]).default("desc"),
        intentFilter: z.string().optional(),
        sourceFilter: z.enum(["all", "ours", "shared", "competitor_only"]).default("all"),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getKeywordsData(ctx.db, input);
    }),
  geoOverview: orgProcedure
    .input(
      z.object({
        siteId: z.number(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return getGeoOverview(ctx.db, input.siteId);
    }),
  backlinksByDomain: orgProcedure
    .input(z.object({
      siteId: z.number(),
      kind: z.enum(["existing", "competitors"]),
      page: z.number().int().min(1).default(1),
      search: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return getBacklinksByDomain(ctx.db, input.siteId, input.kind, input.page, input.search);
    }),
  captureBacklinkSnapshot: orgProcedure
    .input(z.object({ siteId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return captureBacklinkFootprints(ctx.db, input.siteId);
    }),
  updateOpportunityStatus: orgProcedure
    .input(
      z.object({
        opportunityId: z.number(),
        status: z.enum(["new", "reviewed", "approved", "rejected", "thread_open", "won", "lost"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await updateOpportunityStatus(ctx.db, input.opportunityId, input.status);
      return { success: true };
    }),
});
