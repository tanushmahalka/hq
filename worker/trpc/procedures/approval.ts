import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { router, orgProcedure } from "../init";

function resolveErrorCode(status: number): "NOT_FOUND" | "BAD_REQUEST" | "INTERNAL_SERVER_ERROR" {
  if (status === 404) {
    return "NOT_FOUND";
  }
  if (status >= 400 && status < 500) {
    return "BAD_REQUEST";
  }
  return "INTERNAL_SERVER_ERROR";
}

export const approvalRouter = router({
  resolve: orgProcedure
    .input(
      z.object({
        id: z.string().min(1),
        decision: z.enum(["approve", "deny"]),
        feedback: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.hooksUrl || !ctx.hooksToken) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "OpenClaw approval hooks are not configured.",
        });
      }

      const resolvedBy = ctx.user?.name?.trim() || ctx.user?.email?.trim() || "hq user";
      const response = await fetch(
        `${ctx.hooksUrl}/plugins/hq-approvals/approval/resolve`,
        {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.hooksToken}`,
        },
        body: JSON.stringify({
          id: input.id,
          decision: input.decision,
          feedback: input.feedback?.trim() || null,
          resolvedBy,
        }),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string; approval?: unknown }
        | null;

      if (!response.ok || payload?.ok !== true) {
        throw new TRPCError({
          code: resolveErrorCode(response.status),
          message: payload?.error || "Failed to resolve approval.",
        });
      }

      return payload.approval ?? null;
    }),
});
