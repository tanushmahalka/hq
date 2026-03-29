import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  Calendar,
  CircleAlert,
  Clock,
  MessageSquare,
  Bot,
  Send,
  Sparkles,
  Star,
  Tag,
  Trash2,
  User,
  UserCheck,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
  TASK_STATUSES,
  STATUS_LABELS,
  type TaskCategory,
  type TaskStatus,
} from "@shared/types";
import { trpc } from "@/lib/trpc";
import { useTaskNotify, formatTaskNotification } from "@/hooks/use-task-notify";
import { useGateway } from "@/hooks/use-gateway";
import { Session } from "@/components/messenger/messenger-panel";
import {
  getAtQuery,
  parseContentSegments,
  parseAgentName,
} from "@/lib/mentions";
import { MentionDropdown, getFilteredAgents } from "./mention-dropdown";

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  todo: "bg-gray-400",
  doing: "bg-[var(--swarm-violet)]",
  stuck: "bg-red-400",
  done: "bg-[var(--swarm-mint)]",
};

const TABS = [
  { id: "comments", label: "Comments", icon: MessageSquare },
  { id: "session", label: "Session", icon: Bot },
] as const;

type TabId = (typeof TABS)[number]["id"];

interface TaskDetailSheetProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailSheet({ taskId, onClose }: TaskDetailSheetProps) {
  const utils = trpc.useUtils();
  const notifyTask = useTaskNotify();
  const [activeTab, setActiveTab] = useState<TabId>("comments");

  const { data: task } = trpc.task.get.useQuery(
    { id: taskId! },
    { enabled: !!taskId },
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignor, setAssignor] = useState("");
  const [assignee, setAssignee] = useState("");
  const [category, setCategory] = useState<TaskCategory | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setDescription(task.description ?? "");
    setAssignor(task.assignor ?? "");
    setAssignee(task.assignee ?? "");
    setCategory(task.category ?? null);
    setDueDate(
      task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
    );
    setUrgent(task.urgent);
    setImportant(task.important);
  }, [task]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const updateTask = trpc.task.update.useMutation({
    onSuccess: (updated) => {
      utils.task.list.invalidate();
      utils.task.get.invalidate({ id: taskId! });
      if (updated?.assignee) {
        notifyTask(
          updated.assignee,
          updated.id,
          formatTaskNotification("updated", updated),
        );
      }
    },
  });

  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      if (task?.assignee) {
        notifyTask(
          task.assignee,
          task.id,
          formatTaskNotification("deleted", task),
        );
      }
      onClose();
    },
  });

  const save = (field: string, value: string | boolean | Date | null) => {
    if (!taskId || !task) return;
    const current = task[field as keyof typeof task] ?? null;
    if (value instanceof Date) {
      if (current && new Date(current as string).getTime() === value.getTime()) {
        return;
      }
    } else if (value === current) {
      return;
    }
    updateTask.mutate({ id: taskId, [field]: value });
  };

  if (!taskId) return null;

  const taskSessionKey = task
    ? `agent:${task.assignee ?? "main"}:task:${task.id}`
    : "main";

  return (
    <Sheet open={!!taskId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton
        className="flex w-full flex-row gap-0 overflow-hidden p-0 sm:max-w-[1000px]"
      >
        <SheetDescription className="sr-only">
          View and edit task details
        </SheetDescription>

        <div className="flex w-[540px] shrink-0 flex-col overflow-y-auto border-r">
          <div className="px-6 pb-4 pt-14">
            <div className="flex items-start gap-2">
              <SheetTitle asChild>
                <textarea
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => save("title", title)}
                  className="w-full flex-1 resize-none bg-transparent text-4xl font-display font-normal! outline-none placeholder:text-muted-foreground"
                  placeholder="Task title"
                  rows={1}
                  style={{ minHeight: "6rem", overflowWrap: "break-word" }}
                />
              </SheetTitle>
              <button
                onClick={() => {
                  if (taskId) deleteTask.mutate({ id: taskId });
                }}
                disabled={deleteTask.isPending}
                className="mt-2 shrink-0 rounded p-1 text-muted-foreground/40 transition-colors hover:bg-destructive/10 hover:text-destructive"
                title="Delete task"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          <div className="space-y-0 px-6">
            {task?.createdAt && (
              <PropertyRow icon={<Clock className="size-4" />} label="Created">
                <span className="text-sm font-mono">
                  {new Date(task.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  <span className="text-muted-foreground">
                    {new Date(task.createdAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                </span>
              </PropertyRow>
            )}

            {task && (
              <PropertyRow icon={<Sparkles className="size-4" />} label="Status">
                <Select
                  value={task.status}
                  onValueChange={(value) => save("status", value)}
                >
                  <SelectTrigger className="h-7 w-auto gap-1.5 border-none px-2 text-xs font-medium shadow-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((taskStatus) => (
                      <SelectItem key={taskStatus} value={taskStatus}>
                        <span className="flex items-center gap-2">
                          <span
                            className={`size-2 rounded-full ${STATUS_DOT_COLORS[taskStatus]}`}
                          />
                          {STATUS_LABELS[taskStatus]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </PropertyRow>
            )}

            <PropertyRow icon={<CircleAlert className="size-4" />} label="Priority">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const next = !urgent;
                    setUrgent(next);
                    save("urgent", next);
                  }}
                  className="transition-colors"
                >
                  <Badge
                    variant="secondary"
                    className={`cursor-pointer px-2 py-0.5 text-[11px] ${
                      urgent
                        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "opacity-40"
                    }`}
                  >
                    <CircleAlert className="mr-1 size-3" />
                    Urgent
                  </Badge>
                </button>
                <button
                  onClick={() => {
                    const next = !important;
                    setImportant(next);
                    save("important", next);
                  }}
                  className="transition-colors"
                >
                  <Badge
                    variant="secondary"
                    className={`cursor-pointer px-2 py-0.5 text-[11px] ${
                      important
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : "opacity-40"
                    }`}
                  >
                    <Star className="mr-1 size-3" />
                    Important
                  </Badge>
                </button>
              </div>
            </PropertyRow>

            <PropertyRow icon={<Tag className="size-4" />} label="Category">
              <Select
                value={category ?? "__uncategorized__"}
                onValueChange={(value) => {
                  const nextCategory =
                    value === "__uncategorized__" ? null : (value as TaskCategory);
                  setCategory(nextCategory);
                  save("category", nextCategory);
                }}
              >
                <SelectTrigger className="h-8 w-full border-none px-0 text-sm shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__uncategorized__">Uncategorised</SelectItem>
                  {TASK_CATEGORIES.map((taskCategory) => (
                    <SelectItem key={taskCategory} value={taskCategory}>
                      {TASK_CATEGORY_LABELS[taskCategory]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </PropertyRow>

            <PropertyRow icon={<Calendar className="size-4" />} label="Due Date">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onBlur={() => save("dueDate", dueDate ? new Date(dueDate) : null)}
                className="bg-transparent text-sm font-mono outline-none"
              />
            </PropertyRow>

            <PropertyRow icon={<UserCheck className="size-4" />} label="Assignor">
              <input
                value={assignor}
                onChange={(e) => setAssignor(e.target.value)}
                onBlur={() => save("assignor", assignor || null)}
                placeholder="Who assigned this"
                className="w-full bg-transparent text-sm font-mono outline-none placeholder:font-sans placeholder:text-muted-foreground/50"
              />
            </PropertyRow>

            <PropertyRow icon={<User className="size-4" />} label="Assignee">
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                onBlur={() => save("assignee", assignee || null)}
                placeholder="Who's doing this"
                className="w-full bg-transparent text-sm font-mono outline-none placeholder:font-sans placeholder:text-muted-foreground/50"
              />
            </PropertyRow>
          </div>

          <div className="mt-4 flex min-h-0 flex-1 flex-col border-t bg-muted/30 px-6 py-4">
            <h4 className="mb-2 text-sm font-normal">Description</h4>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => save("description", description || null)}
              placeholder="Add a description..."
              className="min-h-[80px] w-full flex-1 resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted-foreground/50"
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-0 border-b pt-14">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "border-foreground font-medium text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  {tab.label}
                  {tab.id === "comments" && task?.comments?.length ? (
                    <span className="text-[11px] font-normal text-muted-foreground">
                      {task.comments.length}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {activeTab === "comments" && task ? (
              <CommentsPanel
                taskId={task.id}
                comments={task.comments ?? []}
                assignee={task.assignee}
                taskTitle={task.title}
                notifyTask={notifyTask}
              />
            ) : null}
            {activeTab === "session" && task ? (
              <div className="h-full min-h-0">
                <Session sessionKey={taskSessionKey} />
              </div>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PropertyRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/50 py-2.5 last:border-b-0">
      <div className="flex w-28 shrink-0 items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

interface Comment {
  id: number;
  author: string;
  content: string;
  createdAt: Date;
}

function CommentsPanel({
  taskId,
  comments,
  assignee,
  taskTitle,
  notifyTask,
}: {
  taskId: string;
  comments: Comment[];
  assignee: string | null;
  taskTitle: string;
  notifyTask: (agentId: string, taskId: string, message: string) => void;
}) {
  const [content, setContent] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const utils = trpc.useUtils();
  const { agents } = useGateway();

  const addComment = trpc.task.comment.add.useMutation({
    onSuccess: (_result, variables) => {
      utils.task.list.invalidate();
      utils.task.get.invalidate({ id: taskId });
      setContent("");
      setMentionQuery(null);
      if (assignee) {
        notifyTask(
          assignee,
          taskId,
          formatTaskNotification(
            "commented",
            { id: taskId, title: taskTitle },
            {
              author: variables.author,
              comment: variables.content,
            },
          ),
        );
      }
    },
  });

  const deleteComment = trpc.task.comment.delete.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.task.get.invalidate({ id: taskId });
    },
  });

  const filteredAgents =
    mentionQuery !== null ? getFilteredAgents(agents, mentionQuery) : [];

  const insertMention = (agentId: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const cursorPos = textarea.selectionStart;
    const before = content.slice(0, cursorPos);
    const after = content.slice(cursorPos);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1) return;
    const nextContent = before.slice(0, atIdx) + `@[${agentId}] ` + after;
    setContent(nextContent);
    setMentionQuery(null);
    setSelectedIdx(0);
    const nextCursorPos = atIdx + agentId.length + 4;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursorPos, nextCursorPos);
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextValue = e.target.value;
    setContent(nextValue);
    const query = getAtQuery(nextValue, e.target.selectionStart);
    setMentionQuery(query);
    if (query !== null) {
      setSelectedIdx(0);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery === null || filteredAgents.length === 0) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((idx) => (idx + 1) % filteredAgents.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx(
        (idx) => (idx - 1 + filteredAgents.length) % filteredAgents.length,
      );
      return;
    }
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filteredAgents[selectedIdx].id);
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setMentionQuery(null);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    addComment.mutate({
      taskId,
      author: "Tanush",
      content: content.trim(),
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {comments.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground/50">
            No comments yet.
          </p>
        ) : null}
        {comments.map((comment) => (
          <div key={comment.id} className="group flex gap-4">
            <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <span className="text-xs font-medium">
                {comment.author.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-normal">
                  {comment.author.charAt(0).toUpperCase() + comment.author.slice(1)}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {new Date(comment.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  <span>
                    {new Date(comment.createdAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                </span>
                <button
                  onClick={() => deleteComment.mutate({ id: comment.id })}
                  className="ml-auto rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="size-3 text-muted-foreground/40" />
                </button>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-muted-foreground/60">
                <CommentContent content={comment.content} agents={agents} />
              </p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="relative shrink-0 border-t bg-muted/30">
        {mentionQuery !== null && filteredAgents.length > 0 ? (
          <MentionDropdown
            agents={agents}
            query={mentionQuery}
            selectedIdx={selectedIdx}
            onSelect={insertMention}
          />
        ) : null}
        <textarea
          ref={textareaRef}
          placeholder="Write a comment... (@ to mention)"
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={3}
          className="w-full resize-none bg-transparent px-4 py-3 pr-11 text-sm outline-none placeholder:text-muted-foreground/50"
        />
        <Button
          type="submit"
          size="icon"
          variant="ghost"
          className="absolute bottom-2 right-2 size-7"
          disabled={!content.trim() || addComment.isPending}
        >
          <Send className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}

function CommentContent({
  content,
  agents,
}: {
  content: string;
  agents: {
    id: string;
    name?: string;
    identity?: { name?: string; emoji?: string };
  }[];
}) {
  const segments = parseContentSegments(content);
  if (segments.length === 1 && segments[0].type === "text") {
    return <>{content}</>;
  }

  return (
    <>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return <span key={index}>{segment.text}</span>;
        }
        const agent = agents.find((entry) => entry.id === segment.agentId);
        const raw = agent?.identity?.name ?? agent?.name ?? segment.agentId;
        const { name } = parseAgentName(raw);
        return (
          <span key={index} className="font-medium text-blue-500 dark:text-blue-400">
            @{name}
          </span>
        );
      })}
    </>
  );
}
