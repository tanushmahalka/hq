import { z } from "zod";
import { router, orgProcedure } from "../init.ts";
import { getSeoOverview, getAnalyticsSummary } from "../../lib/seo.ts";

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
});
