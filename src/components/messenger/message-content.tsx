import { useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Code, ExternalLink, FileText, Globe } from "lucide-react";
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
  | { type: "link"; url: string; label: string };

/* ── URL regex: matches http/https URLs ── */
const URL_RE =
  /https?:\/\/[^\s<>)"'\]]+/g;

/* ── Known domain icons ── */
const DOMAIN_ICONS: Record<string, string> = {
  "docs.google.com": "📄",
  "drive.google.com": "📁",
  "sheets.google.com": "📊",
  "slides.google.com": "📽️",
  "github.com": "🐙",
  "figma.com": "🎨",
  "notion.so": "📝",
  "linear.app": "📋",
  "slack.com": "💬",
  "youtube.com": "▶️",
  "youtu.be": "▶️",
};

function getDomainIcon(hostname: string): string | null {
  for (const [domain, icon] of Object.entries(DOMAIN_ICONS)) {
    if (hostname === domain || hostname.endsWith("." + domain)) return icon;
  }
  return null;
}

function friendlyLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");

    // Google Docs
    if (host === "docs.google.com") {
      const match = u.pathname.match(/\/document\/d\/([^/]+)/);
      if (match) return "Google Document";
      if (u.pathname.includes("/spreadsheets/")) return "Google Sheet";
      if (u.pathname.includes("/presentation/")) return "Google Slides";
      return "Google Docs";
    }
    if (host === "drive.google.com") return "Google Drive";
    if (host === "sheets.google.com") return "Google Sheet";
    if (host === "slides.google.com") return "Google Slides";

    // GitHub
    if (host === "github.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) return `${parts[0]}/${parts[1]}`;
      return "GitHub";
    }

    // Fallback: show domain + first path segment
    const firstPath = u.pathname.split("/").filter(Boolean)[0];
    if (firstPath) return `${host}/${firstPath}`;
    return host;
  } catch {
    return url.slice(0, 40);
  }
}

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

/** Parse text into text, JSON, and link segments. */
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

  // Second pass: split remaining text into text + link segments
  function pushTextAndLinks(str: string) {
    if (!str) return;
    let lastIdx = 0;
    const re = new RegExp(URL_RE.source, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(str)) !== null) {
      if (match.index > lastIdx) {
        segments.push({ type: "text", content: str.slice(lastIdx, match.index) });
      }
      const url = match[0].replace(/[.,;:!?)]+$/, ""); // strip trailing punctuation
      segments.push({
        type: "link",
        url,
        label: friendlyLabel(url),
      });
      lastIdx = match.index + url.length;
    }
    if (lastIdx < str.length) {
      segments.push({ type: "text", content: str.slice(lastIdx) });
    }
  }

  if (jsonRanges.length === 0) {
    pushTextAndLinks(text);
  } else {
    for (let i = 0; i < jsonRanges.length; i++) {
      const range = jsonRanges[i];
      const before = text.slice(cursor, range.start);
      pushTextAndLinks(before);
      segments.push({ type: "json", content: range.formatted });
      cursor = range.end;
    }
    const remaining = text.slice(cursor);
    pushTextAndLinks(remaining);
  }

  return segments;
}

export function MessageContent({ text }: { text: string }) {
  const segments = parseSegments(text);

  return (
    <div className="break-words overflow-hidden">
      {segments.map((seg, i) => {
        if (seg.type === "json") {
          return <JsonButton key={i} content={seg.content} />;
        }
        if (seg.type === "link") {
          return <LinkCard key={i} url={seg.url} label={seg.label} />;
        }
        return (
          <div
            key={i}
            className="prose prose-sm dark:prose-invert max-w-none text-inherit break-words prose-headings:text-inherit prose-strong:text-inherit prose-a:text-inherit prose-p:my-1 prose-headings:my-2 prose-ul:my-1 prose-ol:my-1 prose-pre:my-1 prose-pre:overflow-x-auto prose-li:my-0 prose-table:my-2 [&_table]:block [&_table]:overflow-x-auto [&_table]:w-full [&_pre]:whitespace-pre-wrap [&_code]:break-all"
          >
            <Markdown remarkPlugins={[remarkGfm]}>{seg.content}</Markdown>
          </div>
        );
      })}
    </div>
  );
}

/* ── Link embed card ── */
function LinkCard({ url, label }: { url: string; label: string }) {
  let hostname = "";
  let icon: string | null = null;
  try {
    const u = new URL(url);
    hostname = u.hostname.replace(/^www\./, "");
    icon = getDomainIcon(hostname);
  } catch {
    hostname = url.slice(0, 30);
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/80 hover:bg-muted/40 px-3 py-2.5 my-1.5 transition-colors group no-underline"
    >
      <div className="size-9 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
        {icon ? (
          <span className="text-base">{icon}</span>
        ) : hostname.includes("google") ? (
          <FileText className="size-4 text-muted-foreground/60" />
        ) : (
          <Globe className="size-4 text-muted-foreground/60" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground truncate">
          {label}
        </div>
        <div className="text-[11px] text-muted-foreground/40 font-mono truncate">
          {hostname}
        </div>
      </div>
      <ExternalLink className="size-3.5 text-muted-foreground/25 group-hover:text-muted-foreground/50 shrink-0 transition-colors" />
    </a>
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
