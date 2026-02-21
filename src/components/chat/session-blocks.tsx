import { useState } from "react";
import { Terminal, ChevronRight, Brain, Info, BrainCircuit } from "lucide-react";
import { MessageContent } from "@/components/messenger/message-content";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { RawMessage, ContentBlock } from "@/hooks/use-chat";

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
const DATE_PREFIX_RE = /^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?:\s+\w+)?\]\s*/;

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
      contexts.push(
        cleaned.slice(openIdx + CONTEXT_OPEN.length).trim()
      );
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

  // Strip leading date prefix
  cleaned = cleaned.trim().replace(DATE_PREFIX_RE, "");

  return { cleaned: cleaned.trim(), contexts };
}

export function SessionMessageRow({
  msg,
}: {
  msg: RawMessage;
  agentEmoji?: string;
}) {
  if (msg.role === "user") {
    const text = msg.blocks
      .filter(
        (b): b is ContentBlock & { type: "text" } => b.type === "text"
      )
      .map((b) => b.text)
      .join("");
    if (!text) return null;
    return <UserMessage text={text} timestamp={msg.timestamp} />;
  }

  if (msg.role === "toolResult") {
    const block = msg.blocks[0];
    if (!block || block.type !== "toolResult") return null;
    return (
      <div className="px-4 py-0.5">
        <ToolResultBlock block={block} />
      </div>
    );
  }

  // assistant — merge consecutive text blocks
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
function UserMessage({
  text,
  timestamp,
}: {
  text: string;
  timestamp: number;
}) {
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
            {contexts.length > 0 && (
              <ContextInfoButton contexts={contexts} />
            )}
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
  const { cleaned, contexts } = cleanMessageText(text);
  if (!cleaned) return null;

  return (
    <div className="px-4 py-1.5">
      <div className="max-w-[90%]">
        <div className="text-sm text-foreground/90 leading-relaxed">
          <MessageContent text={cleaned} />
        </div>
        {isFirst && (timestamp > 0 || contexts.length > 0) && (
          <div className="flex items-center gap-1.5 mt-1">
            {timestamp > 0 && (
              <span className="text-[10px] font-mono text-muted-foreground/30">
                {formatTimestamp(timestamp)}
              </span>
            )}
            {contexts.length > 0 && (
              <ContextInfoButton contexts={contexts} />
            )}
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
          className={`size-3 text-muted-foreground/25 ml-auto shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
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
              className={`size-3 text-muted-foreground/25 ml-auto shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
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
