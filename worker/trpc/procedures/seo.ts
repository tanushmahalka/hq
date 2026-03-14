import { z } from "zod";
import { router, orgProcedure } from "../init.ts";
import {
  captureBacklinkFootprints,
  getAnalyticsSummary,
  getBacklinksData,
  getSeoOverview,
  updateOpportunityStatus,
} from "../../lib/seo.ts";

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
    .input(z.object({ siteId: z.number() }))
    .query(async ({ ctx, input }) => {
      return getBacklinksData(ctx.db, input.siteId);
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
