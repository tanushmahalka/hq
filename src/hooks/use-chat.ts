import { useMemo } from "react";

export type SendOutcome = "sent" | "ignored" | "error";

export type PendingImageAttachment = {
  id: string;
  dataUrl: string;
  mimeType: string;
  fileName: string;
  publicUrl?: string;
  error?: string;
  status: "uploading" | "uploaded" | "error";
};

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | { type: "image"; url: string; mimeType?: string }
  | { type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> }
  | { type: "toolResult"; toolName: string; content: string; isError?: boolean };

export type RawMessage = {
  role: "user" | "assistant" | "toolResult";
  timestamp: number;
  blocks: ContentBlock[];
  localId?: string;
};

export function normalizePendingAttachments(
  attachments: PendingImageAttachment[],
) {
  return attachments.filter(Boolean);
}

export function hasBlockingAttachmentState(
  attachments: PendingImageAttachment[],
) {
  return attachments.some((attachment) => attachment.status === "uploading");
}

export function useSessionChat(_sessionKey: string) {
  return useMemo(
    () => ({
      rawMessages: [] as RawMessage[],
      stream: null as string | null,
      isBusy: false,
      loading: false,
      error: null as string | null,
    }),
    [],
  );
}
