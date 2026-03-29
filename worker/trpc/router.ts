import { router, mergeRouters } from "./init.ts";
import { approvalRouter } from "./procedures/approval.ts";
import { taskRouter } from "./procedures/task.ts";
import { commentRouter } from "./procedures/comment.ts";
import { dbRouter } from "./procedures/db.ts";
import { seoRouter } from "./procedures/seo.ts";
import { marketingAssetRouter } from "./procedures/marketing/asset.ts";
import { marketingEbookRouter } from "./procedures/marketing/ebook.ts";
import { exampleRouter } from "./procedures/custom/example.ts";
import { missionRouter } from "./procedures/custom/mission.ts";
import { objectiveRouter } from "./procedures/custom/objective.ts";
import { campaignRouter } from "./procedures/custom/campaign.ts";

export const appRouter = router({
  approval: approvalRouter,
  task: mergeRouters(
    taskRouter,
    router({
      comment: commentRouter,
    })
  ),
  db: dbRouter,
  seo: seoRouter,
  marketing: router({
    asset: marketingAssetRouter,
    ebook: marketingEbookRouter,
  }),
  custom: router({
    example: exampleRouter,
    mission: missionRouter,
    objective: objectiveRouter,
    campaign: campaignRouter,
  }),
});

export type AppRouter = typeof appRouter;
