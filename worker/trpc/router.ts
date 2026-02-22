import { router, mergeRouters } from "./init";
import { taskRouter } from "./procedures/task";
import { commentRouter } from "./procedures/comment";
import { dbRouter } from "./procedures/db";
import customRouters from "./procedures/custom/registry";

const customRouterMap = Object.fromEntries(
  customRouters.map((entry) => [entry.key, entry.router])
);

export const appRouter = router({
  task: mergeRouters(
    taskRouter,
    router({ comment: commentRouter })
  ),
  db: dbRouter,
  custom: router(customRouterMap),
});

export type AppRouter = typeof appRouter;
