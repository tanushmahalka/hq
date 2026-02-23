import { useState } from "react";
import {
  Terminal,
  ChevronRight,
  Brain,
  Info,
  BrainCircuit,
  Bot,
} from "lucide-react";
import { MessageContent } from "@/components/messenger/message-content";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { RawMessage, ContentBlock } from "@/hooks/use-chat";
import { useAdminView } from "@/hooks/use-admin-view";
import {
  parseNotification,
  TaskNotificationCard,
} from "@/components/chat/task-notification-card";

function formatTimestamp(ts: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  const date = d.toLocaleDateString("en-CA"); // YYYY-MM-DD
  const time = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${day} ${date} ${time}`;
}

const CONTEXT_OPEN = "<supermemory-context>";
const CONTEXT_CLOSE = "</supermemory-context>";

/** Matches date prefixes like [Sat 2026-02-21 01:54 UTC] or [Fri 2026-02-21 01:50] */
const DATE_PREFIX_RE =
  /^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?:\s+\w+)?\]\s*/;

/** Matches session key patterns like agent:name:subagent:uuid */
const SESSION_KEY_RE =
  /agent:([a-zA-Z0-9_.-]+):subagent:([a-f0-9]{8})[a-f0-9-]*/g;

/** Shorten session keys in text for UX mode: agent:jessica:subagent:474fbe38-... → jessica */
function shortenSessionKeys(text: string): string {
  return text.replace(SESSION_KEY_RE, "$1");
}

/** Strip <supermemory-context> blocks and [date] prefixes from message text */
function cleanMessageText(text: string): {
  cleaned: string;
  contexts: string[];
} {
  const contexts: string[] = [];
  let cleaned = text;

  // Extract all <supermemory-context>…</supermemory-context> blocks
  let openIdx = cleaned.indexOf(CONTEXT_OPEN);
  while (openIdx !== -1) {
    const closeIdx = cleaned.indexOf(
      CONTEXT_CLOSE,
      openIdx + CONTEXT_OPEN.length
    );
    if (closeIdx === -1) {
      contexts.push(cleaned.slice(openIdx + CONTEXT_OPEN.length).trim());
      cleaned = cleaned.slice(0, openIdx);
      break;
    }
    contexts.push(
      cleaned.slice(openIdx + CONTEXT_OPEN.length, closeIdx).trim()
    );
    cleaned =
      cleaned.slice(0, openIdx) +
      cleaned.slice(closeIdx + CONTEXT_CLOSE.length);
    openIdx = cleaned.indexOf(CONTEXT_OPEN);
  }

  // Strip gateway wrappers from user messages in session history.
  // These are prepended by the gateway and should not be shown to the user.
  cleaned = cleaned.trim();

  // 1. Remove "Conversation info (untrusted metadata):\n```json\n{...}\n```"
  //    The metadata is wrapped in markdown code fences, not plain JSON.
  const metaIdx = cleaned.indexOf("Conversation info");
  if (metaIdx !== -1) {
    const fenceStart = cleaned.indexOf("```", metaIdx);
    if (fenceStart !== -1) {
      const fenceEnd = cleaned.indexOf("```", fenceStart + 3);
      if (fenceEnd !== -1) {
        cleaned = cleaned.slice(0, metaIdx) + cleaned.slice(fenceEnd + 3);
      }
    } else {
      // Fallback: plain JSON without code fences
      const braceStart = cleaned.indexOf("{", metaIdx);
      if (braceStart !== -1) {
        let depth = 0;
        let end = -1;
        for (let i = braceStart; i < cleaned.length; i++) {
          if (cleaned[i] === "{") depth++;
          else if (cleaned[i] === "}") {
            depth--;
            if (depth === 0) { end = i + 1; break; }
          }
        }
        if (end !== -1) {
          cleaned = cleaned.slice(0, metaIdx) + cleaned.slice(end);
        }
      }
    }
  }

  // 2. Strip date prefixes like [Mon 2026-02-23 03:44 UTC] or [Mon 2026-02-23 03:44]
  cleaned = cleaned.trim();
  cleaned = cleaned.replace(DATE_PREFIX_RE, "");

  return { cleaned, contexts };
}

/**
 * Detects [System Message] delivery messages (sub-agent results forwarded to parent).
 * These should be hidden in UX mode since the assistant delivers the result naturally.
 */
function isSystemDeliveryMessage(text: string): boolean {
  const stripped = text.replace(DATE_PREFIX_RE, "").trim();
  return stripped.startsWith("[System Message]");
}

/**
 * Extract the task description from a sub-agent user message.
 * Format: "[Subagent Context] ... \n\n[Subagent Task]: actual task here"
 */
function extractSubagentTask(text: string): string | null {
  const marker = "[Subagent Task]:";
  const idx = text.indexOf(marker);
  if (idx === -1) return null;
  return text.slice(idx + marker.length).trim();
}

/**
 * Checks if a user message is a sub-agent system preamble
 * (contains [Subagent Context] instructions for the agent).
 */
function isSubagentPreamble(text: string): boolean {
  const stripped = text.replace(DATE_PREFIX_RE, "").trim();
  return stripped.startsWith("[Subagent Context]");
}

export function SessionMessageRow({
  msg,
}: {
  msg: RawMessage;
  agentEmoji?: string;
}) {
  const { isAdminView } = useAdminView();

  if (msg.role === "user") {
    const text = msg.blocks
      .filter((b): b is ContentBlock & { type: "text" } => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (!text) return null;

    if (!isAdminView) {
      // UX mode: try to render structured notifications as cards
      const notification = parseNotification(text);
      if (notification) {
        return (
          <div className="flex justify-end px-4 py-1.5">
            <TaskNotificationCard notification={notification} />
          </div>
        );
      }

      // Clean the text for further checks
      const { cleaned } = cleanMessageText(text);

      // Hide [System Message] delivery messages — the assistant delivers these
      if (isSystemDeliveryMessage(cleaned)) return null;

      // Sub-agent preamble: extract just the task description
      if (isSubagentPreamble(cleaned)) {
        const task = extractSubagentTask(cleaned);
        if (task) {
          return (
            <div className="px-4 py-1.5">
              <div className="flex items-start gap-2 text-[11px] text-muted-foreground/50">
                <span className="shrink-0 font-mono text-[var(--swarm-blue)] opacity-60">task</span>
                <span className="leading-relaxed">{task}</span>
              </div>
            </div>
          );
        }
        // No task marker found — hide the preamble entirely
        return null;
      }
    }

    return <UserMessage text={text} timestamp={msg.timestamp} />;
  }

  if (msg.role === "toolResult") {
    // UX mode: hide tool results
    if (!isAdminView) return null;
    const block = msg.blocks[0];
    if (!block || block.type !== "toolResult") return null;
    return (
      <div className="px-4 py-0.5">
        <ToolResultBlock block={block} />
      </div>
    );
  }

  // Non-admin: render assistant messages as a minimal timeline
  if (!isAdminView) {
    return <AssistantTimeline blocks={msg.blocks} timestamp={msg.timestamp} />;
  }

  // Admin: merge consecutive text blocks for raw view
  const merged: Array<
    | { type: "text"; text: string; startIndex: number }
    | { type: "other"; block: ContentBlock; index: number }
  > = [];
  for (let i = 0; i < msg.blocks.length; i++) {
    const block = msg.blocks[i];
    if (block.type === "text") {
      const last = merged[merged.length - 1];
      if (last && last.type === "text") {
        last.text += "\n" + block.text;
      } else {
        merged.push({ type: "text", text: block.text, startIndex: i });
      }
    } else {
      merged.push({ type: "other", block, index: i });
    }
  }

  return (
    <div>
      {merged.map((item) => {
        if (item.type === "text") {
          if (!item.text.trim()) return null;
          return (
            <AssistantMessage
              key={`t${item.startIndex}`}
              text={item.text}
              timestamp={msg.timestamp}
              isFirst={item.startIndex === 0}
            />
          );
        }
        const { block, index } = item;
        switch (block.type) {
          case "thinking":
            return (
              <div key={index} className="px-4 py-0.5">
                <ThinkingBlock text={block.thinking} />
              </div>
            );
          case "toolCall":
            return (
              <div key={index} className="px-4 py-0.5">
                <ToolCallBlock name={block.name} args={block.arguments} />
              </div>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

/* ── User message (right-aligned) ── */
function UserMessage({ text, timestamp }: { text: string; timestamp: number }) {
  const { cleaned, contexts } = cleanMessageText(text);
  if (!cleaned) return null;

  return (
    <div className="flex justify-end px-4 py-1.5">
      <div className="max-w-[85%]">
        <div className="rounded-2xl rounded-br-sm bg-foreground text-background px-3.5 py-2.5">
          <div className="text-sm leading-relaxed">
            <MessageContent text={cleaned} />
          </div>
        </div>
        {(timestamp > 0 || contexts.length > 0) && (
          <div className="flex items-center justify-end gap-1.5 mt-1 pr-1">
            {contexts.length > 0 && <ContextInfoButton contexts={contexts} />}
            {timestamp > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground/30">
                {formatTimestamp(timestamp)}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Assistant message (left-aligned) ── */
function AssistantMessage({
  text,
  timestamp,
  isFirst,
}: {
  text: string;
  timestamp: number;
  isFirst: boolean;
}) {
  const { isAdminView } = useAdminView();
  const { cleaned, contexts } = cleanMessageText(text);
  if (!cleaned) return null;

  const displayText = isAdminView ? cleaned : shortenSessionKeys(cleaned);

  return (
    <div className="px-4 py-1.5">
      <div className="max-w-[90%]">
        <div className="text-sm text-foreground/90 leading-relaxed">
          <MessageContent text={displayText} />
        </div>
        {isFirst && (timestamp > 0 || contexts.length > 0) && (
          <div className="flex items-center gap-1.5 mt-1">
            {timestamp > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground/30">
                {formatTimestamp(timestamp)}
              </span>
            )}
            {contexts.length > 0 && <ContextInfoButton contexts={contexts} />}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Memory context info button (beside the date) ── */
function ContextInfoButton({ contexts }: { contexts: string[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center size-4 rounded text-muted-foreground/25 hover:text-muted-foreground/60 hover:bg-muted/40 transition-colors"
        title="Memory context used"
      >
        <Info className="size-3" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-4 py-3 border-b border-border/50">
            <DialogTitle className="text-sm font-normal flex items-center gap-2">
              <BrainCircuit className="size-4 text-[var(--swarm-violet)]" />
              Memory Context
            </DialogTitle>
            <DialogDescription className="sr-only">
              Supermemory context used for this response
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4 min-h-0 space-y-3">
            {contexts.map((ctx, i) => (
              <p
                key={i}
                className="text-sm leading-relaxed whitespace-pre-wrap break-words text-muted-foreground"
              >
                {ctx}
              </p>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ── Thinking ── */
function ThinkingBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <button onClick={() => setOpen(!open)} className="w-full text-left">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors">
        <Brain className="size-3" />
        <span>Thinking</span>
        <ChevronRight
          className={`size-3 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </div>
      {open && (
        <div className="mt-1.5 ml-[18px] text-xs text-muted-foreground/40 leading-relaxed whitespace-pre-wrap border-l border-border/30 pl-3 max-h-40 overflow-y-auto scrollbar-hide">
          {text}
        </div>
      )}
    </button>
  );
}

/* ── Tool call ── */
function ToolCallBlock({
  name,
  args,
}: {
  name: string;
  args: Record<string, unknown>;
}) {
  const [open, setOpen] = useState(false);
  const summary =
    name === "exec"
      ? String(args.command ?? "")
      : name === "read"
      ? String(args.file_path ?? "")
      : Object.keys(args).length > 0
      ? JSON.stringify(args).slice(0, 80)
      : "";

  return (
    <button onClick={() => setOpen(!open)} className="w-full text-left">
      <div className="flex items-center gap-1.5 rounded-md border border-border/30 bg-muted/20 px-2.5 py-1.5 hover:bg-muted/30 transition-colors">
        <Terminal className="size-3 text-muted-foreground/40 shrink-0" />
        <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">
          {name}
        </span>
        {summary && (
          <>
            <span className="text-muted-foreground/20">·</span>
            <span className="text-[11px] text-muted-foreground/35 truncate font-mono">
              {summary}
            </span>
          </>
        )}
        <ChevronRight
          className={`size-3 text-muted-foreground/25 ml-auto shrink-0 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
      </div>
      {open && (
        <div className="mt-1 ml-2 border-l border-border/30 pl-3">
          <pre className="text-[11px] text-muted-foreground/40 font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto leading-relaxed scrollbar-hide">
            {JSON.stringify(args, null, 2)}
          </pre>
        </div>
      )}
    </button>
  );
}

/* ── Tool result ── */
function ToolResultBlock({
  block,
}: {
  block: ContentBlock & { type: "toolResult" };
}) {
  const [open, setOpen] = useState(false);
  const lines = block.content.split("\n");
  const preview = lines.slice(0, 2).join("\n");
  const hasMore = lines.length > 2;
  const isSuccess = block.exitCode === 0 || block.exitCode === undefined;

  return (
    <button onClick={() => setOpen(!open)} className="w-full text-left">
      <div
        className={`rounded-md border px-2.5 py-1.5 ${
          block.isError
            ? "border-red-400/20 bg-red-400/5"
            : "border-border/30 bg-muted/10"
        }`}
      >
        <div className="flex items-center gap-1.5 mb-1">
          <span
            className={`text-[10px] font-mono px-1 py-0.5 rounded ${
              block.isError
                ? "bg-red-400/10 text-red-400"
                : "bg-[var(--swarm-mint-dim)] text-[var(--swarm-mint)]"
            }`}
          >
            {isSuccess ? "ok" : `exit ${block.exitCode}`}
          </span>
          {block.durationMs !== undefined && (
            <span className="text-[10px] text-muted-foreground/30 font-mono">
              {block.durationMs}ms
            </span>
          )}
          {hasMore && (
            <ChevronRight
              className={`size-3 text-muted-foreground/25 ml-auto shrink-0 transition-transform ${
                open ? "rotate-90" : ""
              }`}
            />
          )}
        </div>
        <pre className="text-[11px] text-muted-foreground/50 font-mono whitespace-pre-wrap break-all leading-relaxed max-h-48 overflow-y-auto scrollbar-hide">
          {open ? block.content : preview}
          {!open && hasMore && "…"}
        </pre>
      </div>
    </button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Non-admin: Minimal timeline view for assistant messages
   ═══════════════════════════════════════════════════════════════ */

const TOOL_LABELS: Record<string, string> = {
  exec: "Ran command",
  read: "Read file",
  write: "Wrote file",
  edit: "Edited file",
  glob: "Searched files",
  grep: "Searched code",
  list: "Listed directory",
};

type TLEntry =
  | { kind: "thinking"; text: string }
  | { kind: "tools"; summary: string }
  | { kind: "text"; text: string };

function buildTimeline(blocks: ContentBlock[]): TLEntry[] {
  const entries: TLEntry[] = [];
  let toolNames: string[] = [];

  const flushTools = () => {
    if (!toolNames.length) return;
    const counts = new Map<string, number>();
    for (const t of toolNames) counts.set(t, (counts.get(t) ?? 0) + 1);
    const summary = [...counts.entries()]
      .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name))
      .join(", ");
    entries.push({ kind: "tools", summary });
    toolNames = [];
  };

  for (const block of blocks) {
    if (block.type === "thinking") {
      flushTools();
      const line = block.thinking.split(/[.\n]/)[0]?.trim();
      if (line) entries.push({ kind: "thinking", text: line });
    } else if (block.type === "toolCall") {
      toolNames.push(TOOL_LABELS[block.name] ?? block.name);
    } else if (block.type === "text" && block.text.trim()) {
      flushTools();
      entries.push({ kind: "text", text: block.text });
    }
  }
  flushTools();
  return entries;
}

function AssistantTimeline({
  blocks,
  timestamp,
}: {
  blocks: ContentBlock[];
  timestamp: number;
}) {
  const entries = buildTimeline(blocks);
  if (!entries.length) return null;

  // Only text? Render normally without timeline chrome.
  if (entries.every((e) => e.kind === "text")) {
    return (
      <>
        {entries.map((e, i) =>
          e.kind === "text" ? (
            <AssistantMessage
              key={i}
              text={e.text}
              timestamp={timestamp}
              isFirst={i === 0}
            />
          ) : null
        )}
      </>
    );
  }

  // Group consecutive non-text entries into timeline sections,
  // text entries stand alone between them.
  type Seg =
    | { t: "tl"; items: Array<{ kind: "thinking" | "tools"; text: string }> }
    | { t: "txt"; text: string };

  const segs: Seg[] = [];
  for (const e of entries) {
    if (e.kind === "text") {
      segs.push({ t: "txt", text: e.text });
    } else {
      const last = segs[segs.length - 1];
      const item = {
        kind: e.kind as "thinking" | "tools",
        text: e.kind === "tools" ? e.summary : e.text,
      };
      if (last?.t === "tl") {
        last.items.push(item);
      } else {
        segs.push({ t: "tl", items: [item] });
      }
    }
  }

  // Flatten everything into one list for a single continuous timeline
  type FlatEntry =
    | { kind: "thinking"; text: string }
    | { kind: "tools"; text: string }
    | { kind: "text"; text: string; isFirstText: boolean };

  const flat: FlatEntry[] = [];
  let firstText = true;
  for (const seg of segs) {
    if (seg.t === "txt") {
      flat.push({ kind: "text", text: seg.text, isFirstText: firstText });
      firstText = false;
    } else {
      for (const item of seg.items) {
        flat.push({ kind: item.kind, text: item.text });
      }
    }
  }

  return (
    <div className="px-4 py-1">
      {/* border-left IS the timeline line — no absolute positioning needed */}
      <div
        className="ml-[5px] border-l pl-4 space-y-0.5"
        style={{
          borderColor:
            "color-mix(in oklch, var(--swarm-violet) 25%, transparent)",
        }}
      >
        {flat.map((entry, i) => {
          if (entry.kind === "text") {
            const { cleaned } = cleanMessageText(entry.text);
            if (!cleaned) return null;
            return (
              <div key={i} className="py-1">
                <TimelineText text={cleaned} />
                {entry.isFirstText && timestamp > 0 && (
                  <span className="text-[10px] font-mono text-muted-foreground/30 mt-1 block">
                    {formatTimestamp(timestamp)}
                  </span>
                )}
              </div>
            );
          }

          const Icon = entry.kind === "thinking" ? Brain : Terminal;
          return (
            <div
              key={i}
              className="flex items-center gap-2 py-0.5 -ml-[calc(1rem+10px)]"
            >
              <div className="size-[20px] rounded-full bg-background flex items-center justify-center shrink-0">
                <Icon
                  className="size-[11px]"
                  style={{ color: "var(--swarm-violet)", opacity: 0.5 }}
                />
              </div>
              <p
                className={`text-[11px] leading-[1.7] min-w-0 ${
                  entry.kind === "thinking"
                    ? "text-muted-foreground/40"
                    : "text-muted-foreground/30 font-mono"
                }`}
              >
                {entry.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Timeline text block (UX mode — shorten session keys) ── */
function TimelineText({ text }: { text: string }) {
  return (
    <div className="max-w-[90%]">
      <div className="text-sm text-foreground/90 leading-[1.75]">
        <MessageContent text={shortenSessionKeys(text)} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   Sub-agent grouping — groups consecutive sub-agent messages
   into a collapsible, visually distinct section.
   ═══════════════════════════════════════════════════════════════ */

const SUBAGENT_RE = /subagent:/;

/** Extract the agent name from a session key like agent:jessica:subagent:uuid */
function extractAgentName(sessionKey: string): string {
  const match = sessionKey.match(/^agent:([^:]+)/);
  return match?.[1] ?? "sub-agent";
}

type MessageGroup =
  | { type: "message"; msg: RawMessage; index: number }
  | { type: "subagent"; label: string; sessionKey: string; msgs: RawMessage[]; startIndex: number };

function groupMessages(messages: RawMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const key = msg.sessionKey ?? "";

    if (SUBAGENT_RE.test(key)) {
      // Check if we can extend the current sub-agent group
      const last = groups[groups.length - 1];
      if (last?.type === "subagent" && last.sessionKey === key) {
        last.msgs.push(msg);
      } else {
        groups.push({
          type: "subagent",
          label: extractAgentName(key),
          sessionKey: key,
          msgs: [msg],
          startIndex: i,
        });
      }
    } else {
      groups.push({ type: "message", msg, index: i });
    }
  }
  return groups;
}

function SubAgentGroup({
  label,
  sessionKey,
  msgs,
  agentEmoji,
}: {
  label: string;
  sessionKey: string;
  msgs: RawMessage[];
  agentEmoji?: string;
}) {
  const [open, setOpen] = useState(false);
  const { isAdminView } = useAdminView();

  // Count meaningful content for the summary
  const textBlocks = msgs.filter(
    (m) => m.role === "assistant" && m.blocks.some((b) => b.type === "text"),
  ).length;
  const toolCalls = msgs.reduce(
    (n, m) => n + m.blocks.filter((b) => b.type === "toolCall").length,
    0,
  );

  const summary = [
    textBlocks > 0 && `${textBlocks} response${textBlocks > 1 ? "s" : ""}`,
    toolCalls > 0 && `${toolCalls} tool use${toolCalls > 1 ? "s" : ""}`,
  ]
    .filter(Boolean)
    .join(", ");

  // Extract the sub-agent task description for UX mode collapsed view
  const taskExcerpt = (() => {
    for (const m of msgs) {
      if (m.role !== "user") continue;
      const text = m.blocks
        .filter((b): b is ContentBlock & { type: "text" } => b.type === "text")
        .map((b) => b.text)
        .join("");
      const task = extractSubagentTask(text);
      if (task) return task.length > 80 ? task.slice(0, 80) + "…" : task;
    }
    return null;
  })();

  if (isAdminView) {
    // Admin: show all messages with a header label
    return (
      <div className="mx-4 my-1 rounded-lg border border-[var(--swarm-blue-dim)] overflow-hidden">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] hover:bg-[var(--swarm-blue-dim)] transition-colors"
          style={{ color: "var(--swarm-blue)" }}
        >
          <Bot className="size-3" />
          <span className="font-mono font-medium">{label}</span>
          {summary && (
            <span className="text-muted-foreground/40 font-normal ml-1">
              {summary}
            </span>
          )}
          <ChevronRight
            className={`size-3 ml-auto transition-transform ${open ? "rotate-90" : ""}`}
          />
        </button>
        {open && (
          <div className="border-t border-[var(--swarm-blue-dim)]">
            {msgs.map((msg, i) => (
              <SessionMessageRow key={i} msg={msg} agentEmoji={agentEmoji} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // UX mode: card-style accordion
  return (
    <div className="mx-4 my-2 rounded-lg border border-border/40 bg-card overflow-hidden swarm-card">
      {/* Card header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left flex items-center gap-3 px-3.5 py-3 hover:bg-muted/20 transition-colors"
      >
        <div
          className="size-6 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: "var(--swarm-blue-dim)" }}
        >
          <Bot
            className="size-3"
            style={{ color: "var(--swarm-blue)" }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-normal">Sub-agent</span>
            <span
              className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-border/40"
              style={{ color: "var(--swarm-blue)", opacity: 0.5 }}
            >
              {label}
            </span>
          </div>
          {!open && taskExcerpt && (
            <p className="text-[11px] text-muted-foreground/40 leading-relaxed mt-0.5 truncate">
              {taskExcerpt}
            </p>
          )}
        </div>
        {summary && (
          <span className="text-[10px] text-muted-foreground/30 font-mono shrink-0">
            {summary}
          </span>
        )}
        <ChevronRight
          className={`size-3.5 text-muted-foreground/25 shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-border/30 py-2">
          {msgs.map((msg, i) => (
            <SessionMessageRow key={i} msg={msg} agentEmoji={agentEmoji} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Renders a list of messages, grouping consecutive sub-agent messages
 * into collapsible sections. Use this instead of mapping SessionMessageRow directly.
 */
export function SessionMessageList({
  messages,
  agentEmoji,
}: {
  messages: RawMessage[];
  agentEmoji?: string;
}) {
  const groups = groupMessages(messages);

  return (
    <>
      {groups.map((group) => {
        if (group.type === "subagent") {
          return (
            <SubAgentGroup
              key={`sub-${group.startIndex}`}
              label={group.label}
              sessionKey={group.sessionKey}
              msgs={group.msgs}
              agentEmoji={agentEmoji}
            />
          );
        }
        return (
          <SessionMessageRow
            key={group.index}
            msg={group.msg}
            agentEmoji={agentEmoji}
          />
        );
      })}
    </>
  );
}
