/**
 * Shared mention parsing utilities for the frontend.
 */

const MENTION_RE = /@\[([^\]]+)\]/g;

/** Extract unique agent IDs from `@[agentId]` tokens in content. */
export function extractMentions(content: string): string[] {
  const ids = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = MENTION_RE.exec(content)) !== null) {
    ids.add(match[1]);
  }
  return [...ids];
}

export type ContentSegment =
  | { type: "text"; text: string }
  | { type: "mention"; agentId: string };

/** Split content into text and mention segments for rendering. */
export function parseContentSegments(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const re = new RegExp(MENTION_RE.source, "g");
  while ((match = re.exec(content)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", text: content.slice(lastIndex, match.index) });
    }
    segments.push({ type: "mention", agentId: match[1] });
    lastIndex = re.lastIndex;
  }

  if (lastIndex < content.length) {
    segments.push({ type: "text", text: content.slice(lastIndex) });
  }

  return segments;
}

/**
 * Detect an active `@query` at the cursor position.
 * Returns the query string (after `@`) or null if no active mention trigger.
 */
export function getAtQuery(value: string, cursorPos: number): string | null {
  // Look backwards from cursor for an unmatched `@`
  const before = value.slice(0, cursorPos);
  const atIdx = before.lastIndexOf("@");
  if (atIdx === -1) return null;

  // Must be at start of string or preceded by whitespace
  if (atIdx > 0 && !/\s/.test(before[atIdx - 1])) return null;

  const query = before.slice(atIdx + 1);

  // Abort if there's a space in the query (user moved on) or if it's a completed mention
  if (query.includes("\n")) return null;
  // Check if this @ is part of a completed `@[...]` mention
  if (query.startsWith("[") && query.includes("]")) return null;

  return query;
}

/** Parse agent display name, extracting optional role in parentheses. */
export function parseAgentName(raw: string): { name: string; role?: string } {
  const match = raw.match(/^(.+?)\s*\((.+?)\)\s*$/);
  if (match) return { name: match[1].trim(), role: match[2].trim() };
  return { name: raw };
}
