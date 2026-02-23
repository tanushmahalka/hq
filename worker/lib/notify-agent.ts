/**
 * POST to /hooks/agent with an explicit sessionKey for task-scoped sessions.
 * Unlike notifyMentionedAgents (which omits sessionKey), this targets a
 * specific session so the conversation is trackable per-task.
 */
export async function notifyAgent(
  ctx: { hooksUrl?: string; hooksToken?: string },
  opts: {
    agentId: string;
    message: string;
    sessionKey: string;
    deliver?: boolean;
    wakeMode?: "now" | "next-heartbeat";
  }
) {
  if (!ctx.hooksUrl || !ctx.hooksToken) return;

  try {
    await fetch(`${ctx.hooksUrl}/hooks/agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.hooksToken}`,
      },
      body: JSON.stringify({
        agentId: opts.agentId,
        message: opts.message,
        sessionKey: opts.sessionKey,
        deliver: opts.deliver ?? false,
        wakeMode: opts.wakeMode ?? "now",
      }),
    });
  } catch (err) {
    console.error(`[notifyAgent] failed for ${opts.agentId}:`, err);
  }
}
