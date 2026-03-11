import type { Context } from "../trpc/context.ts";

interface HookPayload {
  action: string;
  taskId: string;
  [key: string]: unknown;
}

/**
 * POST to OpenClaw's hook mapping endpoint.
 * The hook mapping config on the gateway side templates sessionKey
 * and message from the body fields (e.g. `task:{{taskId}}`).
 */
export async function notifyHook(
  ctx: Pick<Context, "hooksUrl" | "hooksToken">,
  payload: HookPayload,
) {
  if (!ctx.hooksUrl || !ctx.hooksToken) return;

  try {
    await fetch(`${ctx.hooksUrl}/hooks/tasks`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.hooksToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("[notifyHook] failed:", err);
  }
}
