import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { Context } from "./context.ts";

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const mergeRouters = t.mergeRouters;

/** Requires either a session user OR agent bearer token */
export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user && !ctx.isAgent) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx });
});

/** Requires session user with admin role (no agent access) */
export const adminProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user || ctx.user.role !== "admin") {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx });
});

/** Requires authed + active org for users. Agents bypass org check. */
export const orgProcedure = t.procedure.use(({ ctx, next }) => {
  if (ctx.isAgent) {
    return next({ ctx });
  }
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (!ctx.organizationId) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active organization. Please select or create an organization.",
    });
  }
  return next({ ctx });
});
