import { router, mergeRouters } from "./init";
import { taskRouter } from "./procedures/task";
import { commentRouter } from "./procedures/comment";
import { dbRouter } from "./procedures/db";
import { exampleRouter } from "./procedures/custom/example";
import { missionRouter } from "./procedures/custom/mission";
import { objectiveRouter } from "./procedures/custom/objective";
import { campaignRouter } from "./procedures/custom/campaign";

export const appRouter = router({
  task: mergeRouters(
    taskRouter,
    router({ comment: commentRouter })
  ),
  db: dbRouter,
  custom: router({
    example: exampleRouter,
    mission: missionRouter,
    objective: objectiveRouter,
    campaign: campaignRouter,
  }),
});

export type AppRouter = typeof appRouter;
