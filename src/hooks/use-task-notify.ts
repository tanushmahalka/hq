import { useCallback } from "react";
import { TASK_CATEGORY_LABELS, type TaskCategory } from "@shared/types";
import { useGateway } from "./use-gateway";

/**
 * Sends task notifications to agent sessions via chat.send (appends to
 * existing session instead of the /hooks endpoint which resets it).
 */
export function useTaskNotify() {
  const { client, connected } = useGateway();

  return useCallback(
    (agentId: string, taskId: string, message: string) => {
      if (!client || !connected || !agentId) return;

      const sessionKey = `agent:${agentId}:task:${taskId}`;
      client
        .request("chat.send", {
          sessionKey,
          message,
          deliver: false,
          idempotencyKey: crypto.randomUUID(),
        })
        .catch((err: unknown) => console.error("[taskNotify]", err));
    },
    [client, connected],
  );
}

/** Format a task-updated notification message. */
export function formatTaskNotification(
  action: string,
  task: {
    id: string;
    title: string;
    status?: string | null;
    category?: TaskCategory | null;
    assignee?: string | null;
    assignor?: string | null;
    urgent?: boolean;
    important?: boolean;
    description?: string | null;
  },
  extra?: { author?: string; comment?: string },
): string {
  const lines: string[] = [];

  lines.push(`Task ${action}: "${task.title}" (${task.id})`);

  if (task.status != null) lines.push(`Status: ${task.status}`);
  if (task.category) lines.push(`Category: ${TASK_CATEGORY_LABELS[task.category]}`);
  if (task.assignee) lines.push(`Assignee: ${task.assignee}`);
  if (task.assignor) lines.push(`Assignor: ${task.assignor}`);
  if (task.urgent) lines.push(`Urgent: true`);
  if (task.important) lines.push(`Important: true`);
  if (task.description) lines.push(`Description:\n  ${task.description}`);
  if (extra?.author) lines.push(`Author: ${extra.author}`);
  if (extra?.comment) lines.push(`Comment: ${extra.comment}`);

  return lines.join("\n");
}
