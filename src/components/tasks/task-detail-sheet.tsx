import { useState, useEffect, type FormEvent } from "react";
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
} from "lucide-react";
import { TASK_STATUSES, STATUS_LABELS, type TaskStatus } from "@shared/types";
import { trpc } from "@/lib/trpc";
import { useTaskNotify } from "@/hooks/use-task-notify";

const STATUS_DOT_COLORS: Record<TaskStatus, string> = {
  todo: "bg-gray-400",
  doing: "bg-blue-500",
  stuck: "bg-red-500",
  in_review: "bg-yellow-500",
  done: "bg-green-500",
};

// -- Tab definitions (extend this to add more right-panel tabs) --
const TABS = [
  { id: "comments", label: "Comments", icon: MessageSquare },
] as const;

type TabId = (typeof TABS)[number]["id"];

// -- Main component --

interface TaskDetailSheetProps {
  taskId: string | null;
  onClose: () => void;
}

export function TaskDetailSheet({ taskId, onClose }: TaskDetailSheetProps) {
  const utils = trpc.useUtils();
  const { notify } = useTaskNotify();
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
    onSuccess: (data) => {
      utils.task.list.invalidate();
      utils.task.get.invalidate({ id: taskId! });
      notify("updated", data);
    },
  });

  const deleteTask = trpc.task.delete.useMutation({
    onSuccess: () => {
      if (task) notify("deleted", task);
      utils.task.list.invalidate();
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
                  className="w-full flex-1 text-2xl font-normal! bg-transparent border-none outline-none resize-none placeholder:text-muted-foreground wrap-break-word"
                  placeholder="Task title"
                  rows={1}
                  style={{ minHeight: "4rem", overflowWrap: "break-word" }}
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
                <span className="text-sm">
                  {new Date(task.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                  {"  "}
                  <span className="text-muted-foreground">
                    {new Date(task.createdAt).toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
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
                className="text-sm bg-transparent border-none outline-none"
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
                className="text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50 w-full"
              />
            </PropertyRow>

            <PropertyRow icon={<User className="size-4" />} label="Assignee">
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                onBlur={() => save("assignee", assignee || null)}
                placeholder="Who's doing this"
                className="text-sm bg-transparent border-none outline-none placeholder:text-muted-foreground/50 w-full"
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
          <div className="flex-1 overflow-y-auto">
            {activeTab === "comments" && task && (
              <CommentsPanel taskId={task.id} comments={task.comments ?? []} onComment={(text) => notify("commented", task, text)} />
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
  onComment,
}: {
  taskId: string;
  comments: Comment[];
  onComment: (text: string) => void;
}) {
  const [content, setContent] = useState("");
  const utils = trpc.useUtils();

  const addComment = trpc.task.comment.add.useMutation({
    onSuccess: (_, variables) => {
      utils.task.list.invalidate();
      utils.task.get.invalidate({ id: taskId });
      onComment(variables.content);
      setContent("");
    },
  });

  const deleteComment = trpc.task.comment.delete.useMutation({
    onSuccess: () => {
      utils.task.list.invalidate();
      utils.task.get.invalidate({ id: taskId });
    },
  });

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
          <p className="text-xs text-muted-foreground text-center">
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
                <span className="text-[11px] text-muted-foreground">
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
                  className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                >
                  <Trash2 className="size-3 text-muted-foreground" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground opacity-60 mt-0.5 whitespace-pre-wrap">
                {c.content}
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
        <textarea
          placeholder="Write a comment..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
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
