import { Link } from "react-router";
import {
  ListTodo,
  UserPlus,
  AtSign,
  AlertTriangle,
  Star,
  ArrowRight,
} from "lucide-react";
import { STATUS_LABELS, type TaskStatus } from "@shared/types";

/* ── Notification payload types ── */

type TaskCreatedPayload = {
  type: "task.created";
  task: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    urgent: boolean;
    important: boolean;
    assignor: string;
    assignee: string | null;
  };
};

type TaskAssignedPayload = {
  type: "task.assigned";
  task: {
    id: string;
    title: string;
    description: string | null;
    status: string;
    urgent: boolean;
    important: boolean;
    assignor: string;
    assignee: string;
  };
};

type TaskMentionedPayload = {
  type: "task.mentioned";
  task: { id: string; title: string };
  comment: { author: string; content: string };
};

type NotificationPayload =
  | TaskCreatedPayload
  | TaskAssignedPayload
  | TaskMentionedPayload;

const NOTIFICATION_TYPES = ["task.created", "task.assigned", "task.mentioned"];

/**
 * Try to extract a known notification JSON from message text.
 * The gateway hook system wraps messages like:
 *   [cron:uuid Hook] {"type":"task.created",...} Current time: ...
 * So we scan for the first `{` and try to extract balanced JSON from there.
 */
export function parseNotification(text: string): NotificationPayload | null {
  const start = text.indexOf("{");
  if (start === -1) return null;

  // Find balanced closing brace
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          const parsed = JSON.parse(text.slice(start, i + 1));
          if (parsed && NOTIFICATION_TYPES.includes(parsed.type)) {
            return parsed as NotificationPayload;
          }
        } catch {
          /* not valid json, keep scanning */
        }
        return null;
      }
    }
  }
  return null;
}

/* ── Card component ── */

const TYPE_CONFIG = {
  "task.created": {
    icon: ListTodo,
    label: "New Task",
    accent: "var(--swarm-violet)",
    accentDim: "var(--swarm-violet-dim)",
  },
  "task.assigned": {
    icon: UserPlus,
    label: "Task Assigned",
    accent: "var(--swarm-blue)",
    accentDim: "var(--swarm-blue-dim)",
  },
  "task.mentioned": {
    icon: AtSign,
    label: "Mentioned",
    accent: "oklch(0.65 0.15 50)",
    accentDim: "oklch(0.65 0.15 50 / 10%)",
  },
} as const;

export function TaskNotificationCard({
  notification,
}: {
  notification: NotificationPayload;
}) {
  const config = TYPE_CONFIG[notification.type];
  const Icon = config.icon;

  return (
    <div className="my-1.5 rounded-lg border border-border/40 bg-card/80 overflow-hidden max-w-[340px]">
      {/* Header bar */}
      <div
        className="flex items-center gap-2 px-3 py-2 text-[11px] font-medium"
        style={{ backgroundColor: config.accentDim, color: config.accent }}
      >
        <Icon className="size-3.5" />
        {config.label}
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 space-y-2">
        {notification.type === "task.mentioned" ? (
          <MentionBody notification={notification} />
        ) : (
          <TaskBody notification={notification} />
        )}
      </div>
    </div>
  );
}

/* ── Task body (created / assigned) ── */

function TaskBody({
  notification,
}: {
  notification: TaskCreatedPayload | TaskAssignedPayload;
}) {
  const { task } = notification;
  const statusLabel =
    STATUS_LABELS[task.status as TaskStatus] ?? task.status;

  return (
    <>
      <Link
        to={`/tasks?task=${task.id}`}
        className="text-sm text-foreground hover:underline underline-offset-2 decoration-foreground/20 leading-snug block"
      >
        {task.title}
      </Link>

      {task.description && (
        <p className="text-[11px] text-muted-foreground/60 leading-relaxed line-clamp-2">
          {task.description}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        {/* Status */}
        <span className="text-[10px] font-mono text-muted-foreground/50">
          {statusLabel}
        </span>

        {/* Priority flags */}
        {task.urgent && (
          <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
            <AlertTriangle className="size-2.5" />
            Urgent
          </span>
        )}
        {task.important && (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-400">
            <Star className="size-2.5 fill-current" />
            Important
          </span>
        )}

        {/* Assignor / Assignee */}
        <span className="text-[10px] text-muted-foreground/40 font-mono ml-auto">
          {task.assignor}
          {task.assignee && (
            <>
              <ArrowRight className="size-2.5 inline mx-0.5" />
              {task.assignee}
            </>
          )}
        </span>
      </div>
    </>
  );
}

/* ── Mention body ── */

function MentionBody({
  notification,
}: {
  notification: TaskMentionedPayload;
}) {
  const { task, comment } = notification;

  return (
    <>
      <Link
        to={`/tasks?task=${task.id}`}
        className="text-sm text-foreground hover:underline underline-offset-2 decoration-foreground/20 leading-snug block"
      >
        {task.title}
      </Link>

      <div className="border-l-2 border-border/50 pl-2.5 mt-1">
        <span className="text-[10px] font-mono text-muted-foreground/50 block mb-0.5">
          {comment.author}
        </span>
        <p className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-3">
          {comment.content}
        </p>
      </div>
    </>
  );
}
