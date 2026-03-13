import {
  useState,
  useEffect,
  useRef,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApprovalCard } from "@/components/approvals/approval-card";
import {
  Clock,
  Sparkles,
  CircleAlert,
  Star,
  Calendar,
  User,
  UserCheck,
  Trash2,
  Send,
  MessageSquare,
  Bot,
  ListTodo,
} from "lucide-react";
import { TASK_STATUSES, STATUS_LABELS, type TaskStatus } from "@shared/types";
import {
  TASK_SUBTASK_STATUS_LABELS,
  TASK_WORKFLOW_STATUS_LABELS,
  type TaskSubtaskStatus,
} from "@shared/task-workflow";
import { trpc } from "@/lib/trpc";
import { useApprovals } from "@/hooks/use-approvals";
import { useTaskSessions } from "@/hooks/use-task-sessions";
import { useTaskNotify, formatTaskNotification } from "@/hooks/use-task-notify";
import { useGateway } from "@/hooks/use-gateway";
import { SessionMessageList } from "@/components/chat/session-blocks";
import { MessageContent } from "@/components/messenger/message-content";
import { ChatSendProvider } from "@/hooks/use-chat-send";
import {
  getAtQuery,
  parseContentSegments,
  parseAgentName,
} from "@/lib/mentions";
import { MentionDropdown, getFilteredAgents } from "./mention-dropdown";
import { LoaderFive } from "@/components/ui/loader";

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  todo: "bg-gray-400",
  doing: "bg-[var(--swarm-violet)]",
  stuck: "bg-red-400",
  done: "bg-[var(--swarm-mint)]",
};

// -- Tab definitions (extend this to add more right-panel tabs) --
const ALL_TABS = [
  { id: "comments", label: "Comments", icon: MessageSquare },
  { id: "session", label: "Session", icon: Bot },
  { id: "workflow", label: "Workflow", icon: ListTodo },
] as const;

type TabId = (typeof ALL_TABS)[number]["id"];

type TaskSheetTask = {
  id: string;
  title: string;
  description: string | null;
  assignee: string | null;
  workflowMode?: "simple" | "complex";
  workflowSummary?: {
    sessionKeys: string[];
  } | null;
};

type TaskWorkflowDetailData = {
  workflow: {
    status: string;
    planPath: string | null;
    planSummary: string | null;
  } | null;
  subtasks: Array<{
    id: number;
    position: number;
    title: string;
    instructions: string | null;
    acceptanceCriteria: string | null;
    status: TaskSubtaskStatus;
    latestWorkerSummary: string | null;
    latestValidatorSummary: string | null;
    latestFeedback: string | null;
  }>;
  sessions: Array<{
    id: number;
    sessionKey: string;
    role: "root" | "planner" | "worker" | "validator";
    subtaskId: number | null;
    agentId: string | null;
    parentSessionKey: string | null;
    startedAt: Date | string | null;
    completedAt: Date | string | null;
    endedAt: Date | string | null;
  }>;
  summary: {
    status: keyof typeof TASK_WORKFLOW_STATUS_LABELS | null;
    planPath: string | null;
    planSummary: string | null;
    totalSubtasks: number;
    completedSubtasks: number;
    activeSubtaskId: number | null;
    blockedSubtaskId: number | null;
    rootAgentId: string | null;
    sessionKeys: string[];
  };
};

// -- Main component --

interface TaskDetailSheetProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailSheet({ taskId, onClose }: TaskDetailSheetProps) {
  const utils = trpc.useUtils();
  const notifyTask = useTaskNotify();
  const [activeTab, setActiveTab] = useState<TabId>("comments");
  const { agents } = useGateway();

  const { data: task } = trpc.task.get.useQuery(
    { id: taskId! },
    { enabled: !!taskId }
  );
  const { data: workflowDetail, isLoading: workflowLoading } =
    trpc.task.workflow.get.useQuery(
      { taskId: taskId! },
      {
        enabled: Boolean(taskId && task?.workflowMode === "complex"),
      }
    );

  const tabs =
    task?.workflowMode === "complex"
      ? ALL_TABS
      : ALL_TABS.filter((tab) => tab.id !== "workflow");
  const resolvedActiveTab =
    task?.workflowMode === "complex"
      ? activeTab
      : activeTab === "workflow"
      ? "comments"
      : activeTab;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignor, setAssignor] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setAssignor(task.assignor ?? "");
      setAssignee(task.assignee ?? "");
      setDueDate(
        task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""
      );
      setUrgent(task.urgent);
      setImportant(task.important);
    }
  }, [task]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const updateTask = trpc.task.update.useMutation({
    onSuccess: (updated) => {
      utils.task.list.invalidate();
      utils.task.get.invalidate({ id: taskId! });
      utils.task.workflow.get.invalidate({ taskId: taskId! });
      if (updated?.workflowMode !== "complex" && updated?.assignee) {
        notifyTask(
          updated.assignee,
          updated.id,
          formatTaskNotification("updated", updated)
        );
      }
    },
  });

  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      if (task?.workflowMode !== "complex" && task?.assignee) {
        notifyTask(
          task.assignee,
          task.id,
          formatTaskNotification("deleted", task)
        );
      }
      onClose();
    },
  });

  const save = (field: string, value: string | boolean | Date | null) => {
    if (!taskId || !task) return;
    const current = task[field as keyof typeof task] ?? null;
    if (value instanceof Date) {
      if (current && new Date(current as string).getTime() === value.getTime())
        return;
    } else if (value === current) return;
    updateTask.mutate({ id: taskId, [field]: value });
  };

  if (!taskId) return null;

  return (
    <Sheet open={!!taskId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton
        className="w-full sm:max-w-[1000px] p-0 flex flex-row overflow-hidden gap-0"
      >
        <SheetDescription className="sr-only">
          View and edit task details
        </SheetDescription>

        {/* ── Left panel: Task details ── */}
        <div className="w-[540px] shrink-0 flex flex-col overflow-y-auto border-r">
          {/* Header */}
          <div className="px-6 pt-14 pb-4">
            <div className="flex items-start gap-2">
              <SheetTitle asChild>
                <textarea
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => save("title", title)}
                  className="w-full flex-1 text-4xl font-display font-normal! bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground wrap-break-word"
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
                className="mt-2 p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0"
                title="Delete task"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>

          {/* Properties */}
          <div className="px-6 space-y-0">
            {task?.createdAt && (
              <PropertyRow icon={<Clock className="size-4" />} label="Created">
                <span className="text-sm font-mono">
                  {new Date(task.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                  {"  "}
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
              <PropertyRow
                icon={<Sparkles className="size-4" />}
                label="Status"
              >
                <Select
                  value={task.status}
                  onValueChange={(v) => save("status", v)}
                  disabled={task.workflowMode === "complex"}
                >
                  <SelectTrigger className="h-7 w-auto gap-1.5 border-none shadow-none px-2 text-xs font-medium">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="flex items-center gap-2">
                          <span
                            className={`size-2 rounded-full ${STATUS_DOT_COLORS[s]}`}
                          />
                          {STATUS_LABELS[s]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {task.workflowMode === "complex" ? (
                  <p className="mt-1 text-[11px] text-muted-foreground/60">
                    Status is synced from the workflow state.
                  </p>
                ) : null}
              </PropertyRow>
            )}

            <PropertyRow
              icon={<CircleAlert className="size-4" />}
              label="Priority"
            >
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setUrgent(!urgent);
                    save("urgent", !urgent);
                  }}
                  className="transition-colors"
                >
                  <Badge
                    variant="secondary"
                    className={`text-[11px] px-2 py-0.5 cursor-pointer ${
                      urgent
                        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "opacity-40"
                    }`}
                  >
                    <CircleAlert className="size-3 mr-1" />
                    Urgent
                  </Badge>
                </button>
                <button
                  onClick={() => {
                    setImportant(!important);
                    save("important", !important);
                  }}
                  className="transition-colors"
                >
                  <Badge
                    variant="secondary"
                    className={`text-[11px] px-2 py-0.5 cursor-pointer ${
                      important
                        ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                        : "opacity-40"
                    }`}
                  >
                    <Star className="size-3 mr-1" />
                    Important
                  </Badge>
                </button>
              </div>
            </PropertyRow>

            <PropertyRow
              icon={<Calendar className="size-4" />}
              label="Due Date"
            >
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                onBlur={() =>
                  save("dueDate", dueDate ? new Date(dueDate) : null)
                }
                className="text-sm font-mono bg-transparent border-none outline-none"
              />
            </PropertyRow>

            <PropertyRow
              icon={<UserCheck className="size-4" />}
              label="Assignor"
            >
              <input
                value={assignor}
                onChange={(e) => setAssignor(e.target.value)}
                onBlur={() => save("assignor", assignor || null)}
                placeholder="Who assigned this"
                className="text-sm font-mono bg-transparent border-none outline-none placeholder:text-muted-foreground/50 placeholder:font-sans w-full"
              />
            </PropertyRow>

            <PropertyRow icon={<User className="size-4" />} label="Assignee">
              {task?.workflowMode === "complex" ? (
                <Select
                  value={assignee || "__unassigned__"}
                  onValueChange={(value) => {
                    const nextAssignee =
                      value === "__unassigned__" ? "" : value;
                    setAssignee(nextAssignee);
                    save("assignee", nextAssignee || null);
                  }}
                >
                  <SelectTrigger className="h-8 w-full border-none px-0 shadow-none text-sm font-mono">
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__">Unassigned</SelectItem>
                    {agents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.identity?.name ?? agent.name ?? agent.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <input
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  onBlur={() => save("assignee", assignee || null)}
                  placeholder="Who's doing this"
                  className="text-sm font-mono bg-transparent border-none outline-none placeholder:text-muted-foreground/50 placeholder:font-sans w-full"
                />
              )}
            </PropertyRow>
          </div>

          {/* Description — fills remaining vertical space */}
          <div className="mt-4 border-t bg-muted/30 px-6 py-4 flex-1 flex flex-col min-h-0">
            <h4 className="text-sm font-normal mb-2">Description</h4>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => save("description", description || null)}
              placeholder="Add a description..."
              className="w-full flex-1 text-sm bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground/50 leading-relaxed min-h-[80px]"
            />
          </div>
        </div>

        {/* ── Right panel: Tabs ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Tab bar */}
          <div className="flex items-center gap-0 border-b pt-14 shrink-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = resolvedActiveTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm transition-colors border-b-2 -mb-px ${
                    isActive
                      ? "border-foreground text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                  {tab.label}
                  {tab.id === "comments" &&
                    task?.comments &&
                    task.comments.length > 0 && (
                      <span className="text-[11px] text-muted-foreground font-normal">
                        {task.comments.length}
                      </span>
                    )}
                  {tab.id === "workflow" &&
                    workflowDetail?.subtasks &&
                    workflowDetail.subtasks.length > 0 && (
                      <span className="text-[11px] text-muted-foreground font-normal">
                        {workflowDetail.subtasks.length}
                      </span>
                    )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {resolvedActiveTab === "comments" && task && (
              <CommentsPanel
                taskId={task.id}
                comments={task.comments ?? []}
                assignee={task.assignee}
                taskTitle={task.title}
                notifyTask={notifyTask}
              />
            )}
            {resolvedActiveTab === "session" && task && (
              <SessionPanel task={task} workflowDetail={workflowDetail} />
            )}
            {resolvedActiveTab === "workflow" &&
              task?.workflowMode === "complex" && (
                <WorkflowPanel
                  task={task}
                  workflowDetail={workflowDetail}
                  loading={workflowLoading}
                />
              )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// -- Shared components --

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
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-b-0">
      <div className="flex items-center gap-2 text-muted-foreground w-28 shrink-0">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// -- Comments panel --

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
            }
          )
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
    const ta = textareaRef.current;
    if (!ta) return;
    const cursorPos = ta.selectionStart;
    const before = content.slice(0, cursorPos);
    const after = content.slice(cursorPos);
    const atIdx = before.lastIndexOf("@");
    if (atIdx === -1) return;
    const newContent = before.slice(0, atIdx) + `@[${agentId}] ` + after;
    setContent(newContent);
    setMentionQuery(null);
    setSelectedIdx(0);
    // Restore focus and cursor position after React re-render
    const newCursorPos = atIdx + agentId.length + 4; // @[ + id + ] + space
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCursorPos, newCursorPos);
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setContent(val);
    const cursorPos = e.target.selectionStart;
    const query = getAtQuery(val, cursorPos);
    setMentionQuery(query);
    if (query !== null) setSelectedIdx(0);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filteredAgents.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => (i + 1) % filteredAgents.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx(
          (i) => (i - 1 + filteredAgents.length) % filteredAgents.length
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
        return;
      }
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
    <div className="flex flex-col h-full">
      {/* Comment list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {comments.length === 0 && (
          <p className="text-xs text-muted-foreground/50 text-center py-8">
            No comments yet.
          </p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="group flex gap-4">
            <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-medium">
                {c.author.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-normal">
                  {c.author.charAt(0).toUpperCase() + c.author.slice(1)}
                </span>
                <span className="text-[11px] text-muted-foreground font-mono">
                  {new Date(c.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  <span>
                    {new Date(c.createdAt).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                </span>
                <button
                  onClick={() => deleteComment.mutate({ id: c.id })}
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground/60 mt-0.5 whitespace-pre-wrap">
                <CommentContent content={c.content} agents={agents} />
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Input pinned to bottom */}
      <form
        onSubmit={handleSubmit}
        className="relative border-t bg-muted/30 shrink-0"
      >
        {mentionQuery !== null && filteredAgents.length > 0 && (
          <MentionDropdown
            agents={agents}
            query={mentionQuery}
            selectedIdx={selectedIdx}
            onSelect={insertMention}
          />
        )}
        <textarea
          ref={textareaRef}
          placeholder="Write a comment... (@ to mention)"
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          rows={3}
          className="w-full bg-transparent px-4 py-3 pr-11 text-sm resize-none outline-none placeholder:text-muted-foreground/50"
        />
        <Button
          type="submit"
          size="icon"
          variant="ghost"
          className="absolute right-2 bottom-2 size-7"
          disabled={!content.trim() || addComment.isPending}
        >
          <Send className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}

/** Renders comment content with highlighted @mentions. */
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
      {segments.map((seg, i) => {
        if (seg.type === "text") return <span key={i}>{seg.text}</span>;
        const agent = agents.find((a) => a.id === seg.agentId);
        const raw = agent?.identity?.name ?? agent?.name ?? seg.agentId;
        const { name } = parseAgentName(raw);
        return (
          <span
            key={i}
            className="text-blue-500 dark:text-blue-400 font-medium"
          >
            @{name}
          </span>
        );
      })}
    </>
  );
}

function workflowStatusClasses(
  status: keyof typeof TASK_WORKFLOW_STATUS_LABELS | null
) {
  if (status === "blocked") {
    return "bg-red-500/10 text-red-700 dark:text-red-300";
  }
  if (status === "planning") {
    return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  }
  if (status === "completed") {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  return "bg-[var(--swarm-violet-dim)] text-[var(--swarm-violet)]";
}

function subtaskStatusClasses(status: TaskSubtaskStatus) {
  if (status === "needs_revision") {
    return "bg-red-500/10 text-red-700 dark:text-red-300";
  }
  if (status === "running") {
    return "bg-[var(--swarm-violet-dim)] text-[var(--swarm-violet)]";
  }
  if (status === "done") {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  return "bg-muted text-muted-foreground";
}

function WorkflowPanel({
  task,
  workflowDetail,
  loading,
}: {
  task: TaskSheetTask;
  workflowDetail?: TaskWorkflowDetailData;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoaderFive text="Loading workflow..." />
      </div>
    );
  }

  if (!workflowDetail) {
    return (
      <div className="flex h-full items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">
          Workflow details are not available yet.
        </p>
      </div>
    );
  }

  const workflowStatus = workflowDetail.summary.status;

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-6 p-6">
        <section className="rounded-2xl border bg-card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className={workflowStatusClasses(workflowStatus)}
            >
              {workflowStatus
                ? TASK_WORKFLOW_STATUS_LABELS[workflowStatus]
                : "Planning"}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {workflowDetail.summary.completedSubtasks}/
              {workflowDetail.summary.totalSubtasks || 0} subtasks done
            </Badge>
            {workflowDetail.summary.rootAgentId ? (
              <Badge variant="outline" className="text-[10px]">
                root {workflowDetail.summary.rootAgentId}
              </Badge>
            ) : null}
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60">
                Plan Path
              </p>
              <p className="mt-1 font-mono text-xs">
                {workflowDetail.summary.planPath ??
                  `.openclaw/tasks/${task.id}/plan.md`}
              </p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60">
                Plan Preview
              </p>
              <p className="mt-1 leading-relaxed text-muted-foreground">
                {workflowDetail.summary.planSummary ??
                  workflowDetail.workflow?.planSummary ??
                  "No plan summary has been recorded yet."}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-medium">Execution Steps</h4>
            <span className="text-[11px] text-muted-foreground/60">
              Sequential in v1
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {workflowDetail.subtasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No subtasks have been registered yet.
              </p>
            ) : (
              workflowDetail.subtasks.map((subtask) => (
                <div
                  key={subtask.id}
                  className="rounded-xl border border-border/60 bg-muted/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60">
                        Step {subtask.position}
                      </p>
                      <h5 className="mt-1 text-sm font-medium">
                        {subtask.title}
                      </h5>
                    </div>
                    <Badge
                      variant="secondary"
                      className={subtaskStatusClasses(subtask.status)}
                    >
                      {TASK_SUBTASK_STATUS_LABELS[subtask.status]}
                    </Badge>
                  </div>

                  {subtask.instructions ? (
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {subtask.instructions}
                    </p>
                  ) : null}

                  {subtask.acceptanceCriteria ? (
                    <div className="mt-3 rounded-lg border border-border/60 bg-background/80 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60">
                        Acceptance Criteria
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {subtask.acceptanceCriteria}
                      </p>
                    </div>
                  ) : null}

                  {subtask.latestWorkerSummary ? (
                    <div className="mt-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60">
                        Latest Worker Summary
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {subtask.latestWorkerSummary}
                      </p>
                    </div>
                  ) : null}

                  {subtask.latestValidatorSummary ? (
                    <div className="mt-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/60">
                        Latest Validator Summary
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {subtask.latestValidatorSummary}
                      </p>
                    </div>
                  ) : null}

                  {subtask.latestFeedback ? (
                    <div className="mt-3 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-red-700/80 dark:text-red-300/80">
                        Latest Feedback
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {subtask.latestFeedback}
                      </p>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h4 className="text-sm font-medium">Linked Sessions</h4>
            <span className="text-[11px] text-muted-foreground/60">
              {workflowDetail.sessions.length} tracked
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {workflowDetail.sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No sessions have been linked yet.
              </p>
            ) : (
              workflowDetail.sessions.map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl border border-border/60 bg-muted/20 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {session.role}
                    </Badge>
                    {session.agentId ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {session.agentId}
                      </Badge>
                    ) : null}
                    {session.subtaskId ? (
                      <Badge variant="outline" className="text-[10px]">
                        subtask:{session.subtaskId}
                      </Badge>
                    ) : null}
                    <span className="text-[11px] text-muted-foreground/60">
                      {session.endedAt
                        ? "Ended"
                        : session.completedAt
                        ? "Completed"
                        : "Active"}
                    </span>
                  </div>
                  <p className="mt-2 break-all font-mono text-[11px] text-muted-foreground">
                    {session.sessionKey}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// -- Session panel --

function SessionPanel({
  task,
  workflowDetail,
}: {
  task: TaskSheetTask;
  workflowDetail?: TaskWorkflowDetailData;
}) {
  const { agents, connected } = useGateway();
  const fallbackAgentId = task.assignee || agents[0]?.id;
  const agent = task.assignee
    ? agents.find((a) => a.id === task.assignee)
    : agents[0];
  const emoji = agent?.identity?.emoji;
  const primarySessionKey =
    workflowDetail?.sessions.find(
      (session) => session.role === "root" && !session.endedAt
    )?.sessionKey ??
    workflowDetail?.sessions.find((session) => session.role === "root")
      ?.sessionKey;

  return (
    <SessionChat
      taskId={task.id}
      fallbackAgentId={fallbackAgentId}
      linkedSessionKeys={workflowDetail?.summary.sessionKeys}
      primarySessionKey={primarySessionKey}
      agentEmoji={emoji}
      connected={connected}
    />
  );
}

function SessionChat({
  taskId,
  fallbackAgentId,
  linkedSessionKeys,
  primarySessionKey,
  agentEmoji,
  connected,
}: {
  taskId: string;
  fallbackAgentId?: string;
  linkedSessionKeys?: string[];
  primarySessionKey?: string;
  agentEmoji?: string;
  connected: boolean;
}) {
  const { approvals } = useApprovals();
  const {
    messages,
    sessionKeys,
    stream,
    isStreaming,
    loading,
    error,
    sendMessage,
  } = useTaskSessions(taskId, {
    fallbackAgentId,
    linkedSessionKeys,
    primarySessionKey,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionApprovals = approvals.filter((approval) => {
    return (
      linkedSessionKeys?.includes(approval.request.sessionKey) ||
      approval.request.sessionKey.includes(`:task:${taskId}`) ||
      sessionKeys.includes(approval.request.sessionKey)
    );
  });

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages, stream]);

  return (
    <ChatSendProvider sendMessage={(text) => void sendMessage(text)}>
      <div className="flex flex-col h-full">
        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {sessionApprovals.map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} />
          ))}

          {loading && (
            <div className="flex items-center justify-center py-8">
              <LoaderFive text="Thinking..." />
            </div>
          )}

          {!loading && messages.length === 0 && !error && (
            <p className="text-xs text-muted-foreground/50 text-center py-8">
              No messages in this session yet.
            </p>
          )}

          <SessionMessageList messages={messages} agentEmoji={agentEmoji} />

          {isStreaming && (
            <div className="flex gap-2.5">
              <div className="size-5 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[9px]">{agentEmoji ?? "🤖"}</span>
              </div>
              <div className="flex-1 min-w-0 space-y-1.5 pt-1">
                <LoaderFive text="Thinking..." />
                {stream ? (
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    <MessageContent text={stream} />
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-destructive text-center py-2">{error}</p>
          )}
        </div>

        {/* Input */}
        <div className="relative border-t bg-muted/30 shrink-0">
          <SessionComposer
            connected={connected}
            isStreaming={isStreaming}
            onSend={(text) => void sendMessage(text)}
          />
        </div>
      </div>
    </ChatSendProvider>
  );
}

function SessionComposer({
  connected,
  isStreaming,
  onSend,
}: {
  connected: boolean;
  isStreaming: boolean;
  onSend: (text: string) => void;
}) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const nextMessage = input.trim();
    if (!nextMessage || isStreaming) return;
    onSend(nextMessage);
    setInput("");
  };

  return (
    <form onSubmit={handleSubmit}>
      {isStreaming && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
          <div
            className="h-full w-full animate-pulse-soft"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, color-mix(in oklab, var(--swarm-violet) 55%, transparent) 18%, color-mix(in oklab, var(--swarm-violet) 92%, white 8%) 50%, color-mix(in oklab, var(--swarm-violet) 55%, transparent) 82%, transparent 100%)",
              boxShadow:
                "0 0 12px color-mix(in oklab, var(--swarm-violet) 65%, transparent)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, var(--swarm-violet) 50%, transparent 100%)",
              opacity: 0.9,
              animation: "swarm-shimmer 2s ease-in-out infinite",
            }}
          />
        </div>
      )}
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
        placeholder={connected ? "Message agent..." : "Connecting..."}
        disabled={!connected || isStreaming}
        rows={2}
        className="w-full bg-transparent px-4 py-3 pr-11 text-sm resize-none outline-none placeholder:text-muted-foreground/50 disabled:opacity-40"
      />
      <Button
        type="submit"
        size="icon"
        variant="ghost"
        className="absolute right-2 bottom-2 size-7"
        disabled={!connected || isStreaming || !input.trim()}
      >
        <Send className="size-3.5" />
      </Button>
    </form>
  );
}
