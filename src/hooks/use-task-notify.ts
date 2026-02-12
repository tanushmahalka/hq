import { useCallback } from "react";
import { useGateway } from "./use-gateway";

export interface TaskNotifyData {
  id: string;
  title: string;
  status?: string;
  assignee?: string | null;
  description?: string | null;
  urgent?: boolean;
  important?: boolean;
}

type NotifyAction = "created" | "updated" | "deleted" | "commented";

export function useTaskNotify() {
  const { client, connected, agents } = useGateway();

  const notify = useCallback(
    (action: NotifyAction, task: TaskNotifyData, comment?: string) => {
      if (!connected || !client) return;

      const agentId = task.assignee || agents[0]?.id;
      if (!agentId) return;

      let message: string;
      if (action === "commented" && comment) {
        message = `New comment on task "${task.title}" (${task.id}):\n${comment}`;
      } else {
        const lines = [`Task was ${action}: "${task.title}" (${task.id})`];
        if (task.status) lines.push(`Status: ${task.status}`);
        if (task.assignee) lines.push(`Assignee: ${task.assignee}`);
        if (task.urgent) lines.push(`Urgent: yes`);
        if (task.important) lines.push(`Important: yes`);
        if (task.description) lines.push(`Description: ${task.description}`);
        message = lines.join("\n");
      }

      const sessionKey = `agent:${agentId}:${task.id}`;

      client
        .request("chat.send", {
          sessionKey,
          message,
          deliver: false,
          idempotencyKey: crypto.randomUUID(),
        })
        .catch((err) => console.warn("[task-notify] send failed:", err));
    },
    [client, connected, agents],
  );

  return { notify };
}
