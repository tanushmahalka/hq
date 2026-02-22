import type { AnyRouter } from "@trpc/server";

export interface CustomRouterEntry {
  key: string;
  router: AnyRouter;
}
