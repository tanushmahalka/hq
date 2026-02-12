import type { Context } from "../trpc/context";

interface NotifyOptions {
  action: "created" | "updated" | "deleted";
  task: {
    id: string;
    title: string;
    status?: string;
    assignee?: string | null;
    description?: string | null;
    urgent?: boolean;
    important?: boolean;
  };
}

export async function notifyAgent(
  ctx: Pick<Context, "hooksUrl" | "hooksToken">,
  opts: NotifyOptions
) {
  const { action, task } = opts;

  if (!ctx.hooksUrl || !ctx.hooksToken) return;

  const lines = [`Task was ${action}: "${task.title}" (${task.id})`];
  if (task.status) lines.push(`Status: ${task.status}`);
  if (task.assignee) lines.push(`Assignee: ${task.assignee}`);
  if (task.urgent) lines.push(`Urgent: yes`);
  if (task.important) lines.push(`Important: yes`);
  if (task.description) lines.push(`Description: ${task.description}`);

  const message = lines.join("\n");

  // Debug print all relevant variables before sending
  console.log("[notifyAgent] ctx:", ctx);
  console.debug("[notifyAgent] opts:", opts);
  console.debug("[notifyAgent] message:", message);
  console.debug("[notifyAgent] fetch url:", `${ctx.hooksUrl}/hooks/agent`);
  console.log(
    "[notifyAgent] payload:",
    JSON.stringify({
      message,
      name: "HQ Tasks",
      deliver: false,
    })
  );

  try {
    await fetch(`${ctx.hooksUrl}/hooks/agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.hooksToken}`,
      },
      body: JSON.stringify({
        message,
        name: "HQ Tasks",
        deliver: false,
      }),
    });
  } catch (err) {
    console.error("Failed to notify agent:", err);
  }
}
