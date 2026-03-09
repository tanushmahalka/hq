import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Code } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  ChoiceCard,
  isChoicesPayload,
} from "@/components/chat/choice-card";

type Segment =
  | { type: "text"; content: string }
  | { type: "json"; content: string };

/* ── JSON extraction ── */

function extractJsonEnd(text: string, start: number): number {
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
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

/** Parse text into text and JSON segments. */
function parseSegments(text: string): Segment[] {
  // Fast path: entire text is JSON
  const trimmed = text.trim();
  if (trimmed[0] === "{" || trimmed[0] === "[") {
    const formatted = tryParseJson(trimmed);
    if (formatted) return [{ type: "json", content: formatted }];
  }

  const segments: Segment[] = [];
  let cursor = 0;

  // First pass: extract JSON blocks
  const jsonRanges: Array<{ start: number; end: number; formatted: string }> =
    [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{" || text[i] === "[") {
      if (i === 0 || /\s/.test(text[i - 1])) {
        const end = extractJsonEnd(text, i);
        if (end !== -1) {
          const candidate = text.slice(i, end);
          const formatted = tryParseJson(candidate);
          if (formatted) {
            jsonRanges.push({ start: i, end, formatted });
            i = end - 1;
          }
        }
      }
    }
  }

  // Second pass: preserve remaining text so markdown can render plain links.
  function pushText(str: string) {
    if (!str) return;
    segments.push({ type: "text", content: str });
  }

  if (jsonRanges.length === 0) {
    pushText(text);
  } else {
    for (let i = 0; i < jsonRanges.length; i++) {
      const range = jsonRanges[i];
      const before = text.slice(cursor, range.start);
      pushText(before);
      segments.push({ type: "json", content: range.formatted });
      cursor = range.end;
    }
    const remaining = text.slice(cursor);
    pushText(remaining);
  }

  return segments;
}

export function MessageContent({ text }: { text: string }) {
  const segments = parseSegments(text);

  return (
    <div className="break-words overflow-hidden">
      {segments.map((seg, i) => {
        if (seg.type === "json") {
          // Check if the JSON is a choices payload — render as interactive card
          try {
            const parsed = JSON.parse(seg.content);
            if (isChoicesPayload(parsed)) {
              return <ChoiceCard key={i} payload={parsed} />;
            }
          } catch {
            /* not parseable, fall through to JsonButton */
          }
          return <JsonButton key={i} content={seg.content} />;
        }
        return (
          <div
            key={i}
            className="prose prose-sm dark:prose-invert max-w-none text-inherit break-words prose-headings:text-inherit prose-strong:text-inherit prose-a:text-inherit prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-pre:my-1 prose-pre:overflow-x-auto prose-li:my-0 prose-table:my-2 [&_table]:block [&_table]:overflow-x-auto [&_table]:w-full [&_pre]:whitespace-pre-wrap [&_code]:break-all"
          >
            <Markdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: (props) => (
                  <a
                    {...props}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  />
                ),
              }}
            >
              {seg.content}
            </Markdown>
          </div>
        );
      })}
    </div>
  );
}

/* ── JSON expand button ── */
function JsonButton({ content }: { content: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="xs"
        className="mx-1 my-0.5 h-6 gap-1.5 text-[11px] font-medium border border-current/20 bg-current/5 hover:bg-current/10 hover:text-current transition-colors inline-flex"
        onClick={() => setOpen(true)}
      >
        <Code className="size-3" />
        Open Code Block
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col gap-0 p-0">
          <DialogHeader className="px-4 py-3 border-b border-border/50">
            <DialogTitle className="text-sm font-normal">JSON</DialogTitle>
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
