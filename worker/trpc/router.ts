import { router, mergeRouters } from "./init";
import { taskRouter } from "./procedures/task";
import { commentRouter } from "./procedures/comment";

export const appRouter = router({
  task: mergeRouters(
    taskRouter,
    router({ comment: commentRouter })
  ),
});

export type AppRouter = typeof appRouter;
