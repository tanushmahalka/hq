import { useState } from "react";
import { Code, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Segment =
  | { type: "text"; content: string }
  | { type: "json"; content: string }
  | { type: "context"; content: string };

/**
 * Try to extract a balanced JSON value (object or array) starting at `start`.
 * Returns the end index (exclusive) or -1 if it doesn't parse.
 */
function extractJsonEnd(text: string, start: number): number {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === "\\") {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i + 1;
    }
  }

  return -1;
}

function tryParseJson(text: string): string | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed !== "object" || parsed === null) return null;
    return JSON.stringify(parsed, null, 2);
  } catch {
    return null;
  }
}

const CONTEXT_OPEN = "<supermemory-context>";
const CONTEXT_CLOSE = "</supermemory-context>";

/**
 * First pass: extract <supermemory-context> blocks, then parse remaining
 * chunks for JSON segments.
 */
export function parseSegments(text: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;

  // Split on supermemory-context tags first
  while (cursor < text.length) {
    const openIdx = text.indexOf(CONTEXT_OPEN, cursor);

    if (openIdx === -1) {
      // No more context tags — parse rest for JSON
      const rest = text.slice(cursor);
      if (rest) segments.push(...parseJsonSegments(rest));
      break;
    }

    // Text before the tag
    if (openIdx > cursor) {
      const before = text.slice(cursor, openIdx);
      segments.push(...parseJsonSegments(before));
    }

    const contentStart = openIdx + CONTEXT_OPEN.length;
    const closeIdx = text.indexOf(CONTEXT_CLOSE, contentStart);

    if (closeIdx === -1) {
      // Unclosed tag — treat rest as context
      segments.push({
        type: "context",
        content: text.slice(contentStart).trim(),
      });
      cursor = text.length;
      break;
    }

    segments.push({
      type: "context",
      content: text.slice(contentStart, closeIdx).trim(),
    });
    cursor = closeIdx + CONTEXT_CLOSE.length;
  }

  return segments;
}

/** Parse a chunk of text for JSON segments (no context tags present). */
function parseJsonSegments(text: string): Segment[] {
  // Fast path: entire chunk is JSON
  const trimmed = text.trim();
  if (trimmed[0] === "{" || trimmed[0] === "[") {
    const formatted = tryParseJson(trimmed);
    if (formatted) return [{ type: "json", content: formatted }];
  }

  const segments: Segment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    let nextJson = -1;
    for (let i = cursor; i < text.length; i++) {
      if (text[i] === "{" || text[i] === "[") {
        if (i === 0 || /\s/.test(text[i - 1])) {
          const end = extractJsonEnd(text, i);
          if (end !== -1) {
            const candidate = text.slice(i, end);
            if (tryParseJson(candidate)) {
              nextJson = i;
              break;
            }
          }
        }
      }
    }

    if (nextJson === -1) {
      const remaining = text.slice(cursor);
      if (remaining) segments.push({ type: "text", content: remaining });
      break;
    }

    if (nextJson > cursor) {
      segments.push({ type: "text", content: text.slice(cursor, nextJson) });
    }

    const end = extractJsonEnd(text, nextJson);
    const raw = text.slice(nextJson, end);
    const formatted = tryParseJson(raw)!;
    segments.push({ type: "json", content: formatted });
    cursor = end;
  }

  return segments;
}

export function MessageContent({ text }: { text: string }) {
  const segments = parseSegments(text);

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === "json") {
          return <JsonButton key={i} content={seg.content} />;
        }
        if (seg.type === "context") {
          return <ContextButton key={i} content={seg.content} />;
        }
        return (
          <span key={i} className="whitespace-pre-wrap break-words">
            {seg.content}
          </span>
        );
      })}
    </>
  );
}

function JsonButton({ content }: { content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="xs"
        className="mx-1 my-0.5 h-6 gap-1.5 text-[11px] font-medium bg-muted/30 border-border/50 text-foreground hover:bg-muted/60 hover:text-foreground transition-colors inline-flex"
        onClick={() => setOpen(true)}
      >
        <Code className="size-3" />
        Open Code Block
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="text-sm font-medium">JSON</DialogTitle>
            <DialogDescription className="sr-only">
              Code block content
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4 min-h-0">
            <pre className="text-xs font-mono leading-relaxed whitespace-pre-wrap break-words">
              <code>{content}</code>
            </pre>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ContextButton({ content }: { content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="xs"
        className="mx-1 my-0.5 h-6 gap-1.5 text-[11px] font-medium bg-muted/30 border-border/50 text-foreground hover:bg-muted/60 hover:text-foreground transition-colors inline-flex"
        onClick={() => setOpen(true)}
      >
        <BrainCircuit className="size-3" />
        Memory Context
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-4 py-3 border-b">
            <DialogTitle className="text-sm font-medium flex items-center gap-2">
              <BrainCircuit className="size-4" />
              Memory Context
            </DialogTitle>
            <DialogDescription className="sr-only">
              Supermemory context content
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4 min-h-0">
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {content}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
