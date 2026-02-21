import { router, mergeRouters } from "./init";
import { taskRouter } from "./procedures/task";
import { commentRouter } from "./procedures/comment";
import { dbRouter } from "./procedures/db";

export const appRouter = router({
  task: mergeRouters(
    taskRouter,
    router({ comment: commentRouter })
  ),
  db: dbRouter,
});

export type AppRouter = typeof appRouter;
