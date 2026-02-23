/**
 * Server-side mention extraction and agent notification.
 */

const MENTION_RE = /@\[([^\]]+)\]/g;

/** Extract unique agent IDs from `@[agentId]` tokens in content. */
export function extractMentions(content: string): string[] {
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = MENTION_RE.exec(content)) !== null) {
    ids.add(match[1]);
  }
  return [...ids];
}

interface NotifyCtx {
  hooksUrl?: string;
  hooksToken?: string;
}

/**
 * POST to `/hooks/agent` for each mentioned agent (fire-and-forget).
 * No sessionKey — the hook runs in the agent's default/hook session.
 */
export async function notifyMentionedAgents(
  ctx: NotifyCtx,
  agentIds: string[],
  taskId: string,
  taskTitle: string,
  author: string,
  comment: string
) {
  if (!ctx.hooksUrl || !ctx.hooksToken || agentIds.length === 0) return;

  const url = `${ctx.hooksUrl}/hooks/agent`;
  const promises = agentIds.map(async (agentId) => {
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ctx.hooksToken}`,
        },
        body: JSON.stringify({
          agentId,
          message: JSON.stringify({
            type: "task.mentioned",
            task: { id: taskId, title: taskTitle },
            comment: { author, content: comment },
          }),
          deliver: false,
          name: "task-mention",
        }),
      });
    } catch (err) {
      console.error(`[notifyMentionedAgents] failed for ${agentId}:`, err);
    }
  });

  await Promise.all(promises);
}
