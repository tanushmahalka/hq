import { router, orgProcedure } from "../init.ts";
import { getSeoOverview } from "../../lib/seo.ts";

export const seoRouter = router({
  overview: orgProcedure.query(async ({ ctx }) => {
    return getSeoOverview(ctx.db);
  }),
});
