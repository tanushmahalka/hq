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
} from "lucide-react";
import { TASK_STATUSES, STATUS_LABELS, type TaskStatus } from "@shared/types";
import { trpc } from "@/lib/trpc";
import { useApprovals } from "@/hooks/use-approvals";
import { useTaskSessions } from "@/hooks/use-task-sessions";
import { useTaskNotify, formatTaskNotification } from "@/hooks/use-task-notify";
import { useGateway } from "@/hooks/use-gateway";
import {
  SessionMessageList,
} from "@/components/chat/session-blocks";
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
const TABS = [
  { id: "comments", label: "Comments", icon: MessageSquare },
  { id: "session", label: "Session", icon: Bot },
] as const;

type TabId = (typeof TABS)[number]["id"];

// -- Main component --

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
    { enabled: !!taskId }
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignor, setAssignor] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [important, setImportant] = useState(false);

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

  const updateTask = trpc.task.update.useMutation({
    onSuccess: (updated) => {
      utils.task.list.invalidate();
      utils.task.get.invalidate({ id: taskId! });
      if (updated?.assignee) {
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
      if (task?.assignee) {
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
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                onBlur={() => save("assignee", assignee || null)}
                placeholder="Who's doing this"
                className="text-sm font-mono bg-transparent border-none outline-none placeholder:text-muted-foreground/50 placeholder:font-sans w-full"
              />
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
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
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
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden">
            {activeTab === "comments" && task && (
              <CommentsPanel
                taskId={task.id}
                comments={task.comments ?? []}
                assignee={task.assignee}
                taskTitle={task.title}
                notifyTask={notifyTask}
              />
            )}
            {activeTab === "session" && task && (
              <SessionPanel taskId={task.id} assignee={task.assignee} />
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
  id: string;
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

// -- Session panel --

function SessionPanel({
  taskId,
  assignee,
}: {
  taskId: string;
  assignee: string | null;
}) {
  const { agents, connected } = useGateway();
  const fallbackAgentId = assignee || agents[0]?.id;
  const agent = assignee ? agents.find((a) => a.id === assignee) : agents[0];
  const emoji = agent?.identity?.emoji;

  return (
    <SessionChat
      taskId={taskId}
      fallbackAgentId={fallbackAgentId}
      agentEmoji={emoji}
      connected={connected}
    />
  );
}

function SessionChat({
  taskId,
  fallbackAgentId,
  agentEmoji,
  connected,
}: {
  taskId: string;
  fallbackAgentId?: string;
  agentEmoji?: string;
  connected: boolean;
}) {
  const { approvals } = useApprovals();
  const { messages, sessionKeys, stream, isStreaming, loading, error, sendMessage } =
    useTaskSessions(taskId, fallbackAgentId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionApprovals = approvals.filter((approval) => {
    return (
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
              boxShadow: "0 0 12px color-mix(in oklab, var(--swarm-violet) 65%, transparent)",
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
