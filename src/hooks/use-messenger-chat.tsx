/* eslint-disable react-refresh/only-export-components */

import { useChat as useVercelChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type FileUIPart,
  type UIMessage,
} from "ai";
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { parseHqWebchatSessionKey } from "@shared/hq-webchat-session";
import {
  hasBlockingAttachmentState,
  normalizePendingAttachments,
  type ContentBlock,
  type PendingImageAttachment,
  type RawMessage,
  type SendOutcome,
} from "@/hooks/use-chat";

const DEFAULT_CHAT_API_URL = "/api/chat";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getChatApiUrl(): string {
  const envValue = import.meta.env.VITE_CHAT_API_URL;
  return typeof envValue === "string" && envValue.trim().length > 0
    ? envValue.trim()
    : DEFAULT_CHAT_API_URL;
}

function getMessageTimestamp(
  timestamps: Map<string, number>,
  messageId: string,
): number {
  const existing = timestamps.get(messageId);
  if (existing != null) {
    return existing;
  }

  const next = Date.now();
  timestamps.set(messageId, next);
  return next;
}

function toToolArguments(input: unknown): Record<string, unknown> {
  return isRecord(input) ? input : {};
}

function inferHermesInlineToolName(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) {
    return "tool";
  }

  if (
    trimmed.includes("/") ||
    trimmed.includes(".") ||
    trimmed.includes("read_file")
  ) {
    return "read";
  }

  return "exec";
}

function inferHermesInlineToolArguments(
  toolName: string,
  label: string,
): Record<string, unknown> {
  const trimmed = label.trim();
  if (!trimmed) {
    return {};
  }

  if (toolName === "read") {
    return { file_path: trimmed };
  }

  return { command: trimmed };
}

function extractHermesInlineToolBlocks(
  text: string,
  timestamp: number,
): {
  blocks: ContentBlock[];
  toolResults: RawMessage[];
  remainingText: string;
} {
  const blocks: ContentBlock[] = [];
  const toolResults: RawMessage[] = [];
  let remaining = text;
  let toolIndex = 1;

  const compactToolPattern =
    /^\s*`([^`\n]+)`\s*→\s*`([^`\n]+)`\s*(?:\n+|$)?/;
  const markerOnlyPattern = /^\s*`([^`\n]+)`\s*(?:\n+|$)/;

  while (true) {
    const compactMatch = remaining.match(compactToolPattern);
    if (compactMatch) {
      const label = compactMatch[1]?.trim() ?? "";
      const output = compactMatch[2]?.trim() ?? "";
      const toolName = inferHermesInlineToolName(label);
      const toolCallId = `hermes-inline-${timestamp}-${toolIndex++}`;

      blocks.push({
        type: "toolCall",
        id: toolCallId,
        name: toolName,
        arguments: inferHermesInlineToolArguments(toolName, label),
      });

      toolResults.push({
        role: "toolResult",
        timestamp,
        blocks: [
          {
            type: "toolResult",
            toolName,
            content: output,
          },
        ],
      });

      remaining = remaining.slice(compactMatch[0].length);
      continue;
    }

    const markerOnlyMatch = remaining.match(markerOnlyPattern);
    if (markerOnlyMatch) {
      const label = markerOnlyMatch[1]?.trim() ?? "";
      const toolName = inferHermesInlineToolName(label);
      const toolCallId = `hermes-inline-${timestamp}-${toolIndex++}`;

      blocks.push({
        type: "toolCall",
        id: toolCallId,
        name: toolName,
        arguments: inferHermesInlineToolArguments(toolName, label),
      });

      remaining = remaining.slice(markerOnlyMatch[0].length);
      continue;
    }

    break;
  }

  return {
    blocks,
    toolResults,
    remainingText: remaining.trimStart(),
  };
}

type ToolLikePart = {
  type: string;
  toolName?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  state?: string;
  approval?: {
    reason?: string;
  };
};

function isToolLikePart(part: unknown): part is ToolLikePart {
  return (
    isRecord(part) &&
    typeof part.type === "string" &&
    (part.type === "dynamic-tool" || part.type.startsWith("tool-"))
  );
}

function toToolResultContent(part: ToolLikePart): string | null {
  if (!isToolLikePart(part)) {
    return null;
  }

  if (part.state === "output-error") {
    return part.errorText ?? "Tool call failed.";
  }

  if (part.state === "output-denied") {
    return part.approval?.reason?.trim() || "Tool call denied.";
  }

  if (part.state !== "output-available") {
    return null;
  }

  if (typeof part.output === "string") {
    return part.output;
  }

  try {
    return JSON.stringify(part.output, null, 2);
  } catch {
    return String(part.output);
  }
}

function filePartToImageBlock(part: FileUIPart): Extract<ContentBlock, { type: "image" }> | null {
  if (!part.mediaType.startsWith("image/")) {
    return null;
  }

  return {
    type: "image",
    url: part.url,
    mimeType: part.mediaType,
  };
}

function uiMessagesToRawMessages(
  messages: UIMessage[],
  timestamps: Map<string, number>,
): RawMessage[] {
  return messages.flatMap((message) => {
    if (message.role === "system") {
      return [];
    }

    const timestamp = getMessageTimestamp(timestamps, message.id);
    const role = message.role === "user" ? "user" : "assistant";
    const blocks: ContentBlock[] = [];
    const toolResults: RawMessage[] = [];

    for (const part of message.parts) {
      if (part.type === "text") {
        if (part.text) {
          if (role === "assistant") {
            const parsed = extractHermesInlineToolBlocks(part.text, timestamp);
            blocks.push(...parsed.blocks);
            toolResults.push(...parsed.toolResults);

            if (parsed.remainingText) {
              blocks.push({ type: "text", text: parsed.remainingText });
            }
          } else {
            blocks.push({ type: "text", text: part.text });
          }
        }
        continue;
      }

      if (part.type === "reasoning") {
        if (part.text) {
          blocks.push({ type: "thinking", thinking: part.text });
        }
        continue;
      }

      if (part.type === "file") {
        const imageBlock = filePartToImageBlock(part);
        if (imageBlock) {
          blocks.push(imageBlock);
        }
        continue;
      }

      if (!isToolLikePart(part)) {
        continue;
      }

      const rawToolType = String(part.type);
      const toolName =
        rawToolType === "dynamic-tool"
          ? (typeof part.toolName === "string" ? part.toolName : "tool")
          : rawToolType.slice(5);

      blocks.push({
        type: "toolCall",
        id: part.toolCallId ?? `${toolName}-${timestamp}`,
        name: toolName,
        arguments: toToolArguments(part.input),
      });

      const content = toToolResultContent(part);
      if (!content) {
        continue;
      }

      toolResults.push({
        role: "toolResult",
        timestamp,
        blocks: [
          {
            type: "toolResult",
            toolName,
            content,
            isError:
              part.state === "output-error" || part.state === "output-denied",
          },
        ],
      });
    }

    const rawMessage =
      blocks.length > 0
        ? [
            {
              role,
              timestamp,
              blocks,
              localId: message.id,
            } satisfies RawMessage,
          ]
        : [];

    return [...rawMessage, ...toolResults];
  });
}

function getStreamingText(message: UIMessage | undefined): string | null {
  if (!message || message.role !== "assistant") {
    return null;
  }

  const text = message.parts
    .flatMap((part) => {
      if (part.type === "text" || part.type === "reasoning") {
        return [part.text];
      }
      return [];
    })
    .join("")
    .trim();

  return text || null;
}

function attachmentToFilePart(attachment: PendingImageAttachment): FileUIPart {
  return {
    type: "file",
    mediaType: attachment.mimeType,
    filename: attachment.fileName,
    url: attachment.publicUrl ?? attachment.dataUrl,
  };
}

function buildInitialMessages(userName?: string): UIMessage[] {
  const trimmedUserName = userName?.trim();
  if (!trimmedUserName) {
    return [];
  }

  return [
    {
      id: `system-user-${trimmedUserName.toLowerCase().replace(/\s+/g, "-")}`,
      role: "system",
      parts: [
        {
          type: "text",
          text: `FYI, You are speaking with ${trimmedUserName}`,
        },
      ],
    },
  ];
}

export function MessengerChatProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useMessengerChat(sessionKey: string) {
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<PendingImageAttachment[]>([]);
  const parsedSession = useMemo(
    () => parseHqWebchatSessionKey(sessionKey),
    [sessionKey],
  );
  const initialMessages = useMemo(
    () => buildInitialMessages(parsedSession?.userName),
    [parsedSession?.userName],
  );
  const timestampsRef = useRef(new Map<string, number>());
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: getChatApiUrl(),
        credentials: "include",
        body: {
          sessionKey,
          agentId: parsedSession?.agentId,
          userSlug: parsedSession?.userSlug,
        },
      }),
    [parsedSession?.agentId, parsedSession?.userSlug, sessionKey],
  );

  const {
    messages,
    sendMessage: sendSdkMessage,
    stop,
    status,
    error,
    clearError,
  } = useVercelChat({
    id: sessionKey,
    messages: initialMessages,
    transport,
  });

  const rawMessages = useMemo(
    () => uiMessagesToRawMessages(messages, timestampsRef.current),
    [messages],
  );
  const stream = useMemo(
    () =>
      status === "streaming" ? getStreamingText(messages[messages.length - 1]) : null,
    [messages, status],
  );

  const addAttachments = useCallback((next: PendingImageAttachment[]) => {
    setAttachments((current) => [...current, ...next]);
  }, []);

  const updateAttachment = useCallback(
    (
      attachmentId: string,
      patch: Partial<
        Pick<PendingImageAttachment, "status" | "publicUrl" | "error">
      >,
    ) => {
      setAttachments((current) =>
        current.map((attachment) =>
          attachment.id === attachmentId ? { ...attachment, ...patch } : attachment,
        ),
      );
    },
    [],
  );

  const removeAttachment = useCallback((attachmentId: string) => {
    setAttachments((current) =>
      current.filter((attachment) => attachment.id !== attachmentId),
    );
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  const sendMessage = useCallback(
    async (
      text: string,
      pendingAttachments: PendingImageAttachment[] = [],
    ): Promise<SendOutcome> => {
      const trimmed = text.trim();
      const normalizedAttachments = normalizePendingAttachments(pendingAttachments);
      if (hasBlockingAttachmentState(normalizedAttachments)) {
        return "ignored";
      }

      const files = normalizedAttachments.map(attachmentToFilePart);
      if (!trimmed && files.length === 0) {
        return "ignored";
      }

      try {
        clearError();
        await sendSdkMessage(
          files.length > 0 ? { text: trimmed, files } : { text: trimmed },
        );
        return "sent";
      } catch {
        return "error";
      }
    },
    [clearError, sendSdkMessage],
  );

  const abortRun = useCallback(async () => {
    if (status !== "submitted" && status !== "streaming") {
      return false;
    }

    stop();
    return true;
  }, [status, stop]);

  return {
    messages: rawMessages
      .filter((message) => message.role !== "toolResult")
      .map((message) => ({
        role: message.role,
        content: message.blocks
          .filter((block): block is Extract<ContentBlock, { type: "text" }> => {
            return block.type === "text";
          })
          .map((block) => block.text)
          .join(""),
        timestamp: message.timestamp,
        localId: message.localId,
      })),
    rawMessages,
    stream,
    isBusy: status === "submitted" || status === "streaming",
    isStreaming: status === "streaming",
    loading: false,
    error: error?.message ?? null,
    sendMessage,
    queue: [],
    canAbort: status === "submitted" || status === "streaming",
    abortRun,
    removeQueuedMessage: () => {
      // Queueing is handled by the API endpoint when needed.
    },
    draft,
    setDraft,
    attachments,
    addAttachments,
    updateAttachment,
    removeAttachment,
    clearAttachments,
  };
}
