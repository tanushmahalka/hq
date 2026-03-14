import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type SetStateAction,
} from "react";
import { useGateway } from "./use-gateway";
import type { EventFrame } from "@/lib/gateway-client";
import {
  markSessionPending,
  clearSessionPending,
} from "./use-any-agent-active";

export type PendingImageAttachment = {
  id: string;
  dataUrl: string;
  mimeType: string;
  fileName?: string;
};

export type SendOutcome = "sent" | "queued" | "error" | "ignored";

export type QueuedChatMessage = {
  id: string;
  text: string;
  attachments: PendingImageAttachment[];
  createdAt: number;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  localId?: string;
};

// Rich types for raw session messages (preserves all block types)
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | {
      type: "toolCall";
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }
  | {
      type: "toolResult";
      toolName: string;
      content: string;
      exitCode?: number;
      durationMs?: number;
      isError?: boolean;
    }
  | {
      type: "image";
      url?: string;
      dataUrl?: string;
      mimeType?: string;
      omitted?: boolean;
      bytes?: number;
    };

export type RawMessage = {
  role: "user" | "assistant" | "toolResult";
  blocks: ContentBlock[];
  timestamp: number;
  /** Session key this message belongs to (set by multi-session hooks). */
  sessionKey?: string;
  /** Client-side ID used for optimistic local rollback. */
  localId?: string;
};

type ChatEventPayload = {
  runId: string;
  sessionKey: string;
  state: "delta" | "final" | "aborted" | "error";
  message?: unknown;
  errorMessage?: string;
};

type FinalEventPayload = {
  state?: string;
  message?: unknown;
};

type ApiImageAttachment = {
  type: "image";
  mimeType: string;
  content: string;
};

const DATE_PREFIX_RE =
  /^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?:\s+\w+)?\]\s*/;
const HIDDEN_APPROVAL_CONTINUATION_MARKER =
  "[[openclaw_hidden_approval_continuation]]";
const SILENT_REPLY_PATTERN = /^\s*NO_REPLY\s*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isSilentReplyText(text: string): boolean {
  return SILENT_REPLY_PATTERN.test(text);
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .filter(
      (block: unknown) =>
        typeof block === "object" &&
        block !== null &&
        (block as { type: string }).type === "text"
    )
    .map((block: unknown) => String((block as { text?: unknown }).text ?? ""))
    .join("");
}

function dataUrlToBase64(
  dataUrl: string
): { content: string; mimeType: string } | null {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) {
    return null;
  }
  return { mimeType: match[1], content: match[2] };
}

function imageDataUrlFromParts(
  mimeType: string,
  content: string
): string | null {
  if (!mimeType || !content) {
    return null;
  }
  return `data:${mimeType};base64,${content}`;
}

function parseImageBlock(
  raw: Record<string, unknown>
): Extract<ContentBlock, { type: "image" }> | null {
  const source = isRecord(raw.source) ? raw.source : null;
  const blockMimeType =
    typeof raw.mimeType === "string"
      ? raw.mimeType
      : typeof raw.media_type === "string"
      ? raw.media_type
      : undefined;

  if (source) {
    if (source.type === "base64" && typeof source.data === "string") {
      if (source.data.startsWith("data:")) {
        return {
          type: "image",
          dataUrl: source.data,
          mimeType:
            typeof source.media_type === "string"
              ? source.media_type
              : typeof source.mimeType === "string"
              ? source.mimeType
              : blockMimeType,
        };
      }

      const mimeType =
        typeof source.media_type === "string"
          ? source.media_type
          : typeof source.mimeType === "string"
          ? source.mimeType
          : blockMimeType ?? "image/png";
      const dataUrl = imageDataUrlFromParts(mimeType, source.data);
      if (!dataUrl) {
        return null;
      }
      return {
        type: "image",
        dataUrl,
        mimeType,
      };
    }

    if (source.type === "url" && typeof source.url === "string") {
      return {
        type: "image",
        url: source.url,
        mimeType:
          typeof source.mimeType === "string" ? source.mimeType : blockMimeType,
      };
    }
  }

  if (typeof raw.dataUrl === "string") {
    return {
      type: "image",
      dataUrl: raw.dataUrl,
      mimeType: blockMimeType,
    };
  }

  if (typeof raw.url === "string") {
    return {
      type: "image",
      url: raw.url,
      mimeType: blockMimeType,
    };
  }

  if (raw.omitted === true) {
    return {
      type: "image",
      mimeType: blockMimeType,
      omitted: true,
      bytes: typeof raw.bytes === "number" ? raw.bytes : undefined,
    };
  }

  return null;
}

function parseImageUrlBlock(
  raw: Record<string, unknown>
): Extract<ContentBlock, { type: "image" }> | null {
  const imageUrl = isRecord(raw.image_url) ? raw.image_url : null;
  if (typeof imageUrl?.url !== "string") {
    return null;
  }
  return {
    type: "image",
    url: imageUrl.url,
  };
}

function normalizePendingAttachments(
  attachments?: PendingImageAttachment[]
): PendingImageAttachment[] {
  if (!attachments?.length) {
    return [];
  }

  return attachments.filter((attachment) => {
    const parsed = dataUrlToBase64(attachment.dataUrl);
    return Boolean(
      attachment.mimeType.startsWith("image/") &&
        attachment.dataUrl &&
        parsed?.content &&
        parsed.mimeType
    );
  });
}

function serializeAttachments(
  attachments: PendingImageAttachment[]
): ApiImageAttachment[] | undefined {
  const serialized = attachments
    .map((attachment) => {
      const parsed = dataUrlToBase64(attachment.dataUrl);
      if (!parsed) {
        return null;
      }
      return {
        type: "image" as const,
        mimeType: parsed.mimeType,
        content: parsed.content,
      };
    })
    .filter(
      (attachment): attachment is ApiImageAttachment => attachment !== null
    );

  return serialized.length > 0 ? serialized : undefined;
}

function buildOptimisticUserMessage(
  text: string,
  attachments: PendingImageAttachment[],
  timestamp: number,
  localId: string
): RawMessage {
  return {
    role: "user",
    blocks: [
      ...(text.trim() ? [{ type: "text", text } satisfies ContentBlock] : []),
      ...attachments.map((attachment) => ({
        type: "image" as const,
        dataUrl: attachment.dataUrl,
        mimeType: attachment.mimeType,
      })),
    ],
    timestamp,
    localId,
  };
}

function isHiddenApprovalContinuation(raw: unknown): boolean {
  if (!isRecord(raw)) {
    return false;
  }
  const msg = raw as {
    role?: string;
    content?: unknown;
  };
  if (msg.role !== "user" || !Array.isArray(msg.content)) {
    return false;
  }
  const text = extractTextFromContent(msg.content)
    .replace(DATE_PREFIX_RE, "")
    .trim();
  return text.startsWith(HIDDEN_APPROVAL_CONTINUATION_MARKER);
}

export function extractText(message: unknown): string {
  if (!message || typeof message !== "object") return "";
  const msg = message as { content?: unknown; text?: unknown };
  if (typeof msg.text === "string") return msg.text;
  return extractTextFromContent(msg.content);
}

export function isAssistantSilentReplyMessage(message: unknown): boolean {
  if (!isRecord(message)) {
    return false;
  }
  const role =
    typeof message.role === "string" ? message.role.toLowerCase() : "";
  if (role !== "assistant") {
    return false;
  }
  return isSilentReplyText(extractText(message));
}

export function parseRawMessage(raw: unknown): RawMessage | null {
  return parseRawMessages([raw])[0] ?? null;
}

export function buildAssistantTextMessage(
  text: string,
  timestamp = Date.now()
): RawMessage | null {
  if (!text.trim() || isSilentReplyText(text)) return null;
  return {
    role: "assistant",
    blocks: [{ type: "text", text }],
    timestamp,
  };
}

export function shouldReloadHistoryForFinalEvent(
  payload?: FinalEventPayload
): boolean {
  if (!payload || payload.state !== "final") {
    return false;
  }
  if (!payload.message || typeof payload.message !== "object") {
    return true;
  }
  const message = payload.message as { role?: unknown };
  const role =
    typeof message.role === "string" ? message.role.toLowerCase() : "";
  return Boolean(role && role !== "assistant");
}

export function parseRawMessages(raw: Array<unknown>): RawMessage[] {
  return raw.flatMap((m: unknown) => {
    if (!isRecord(m)) {
      return [];
    }
    if (isHiddenApprovalContinuation(m) || isAssistantSilentReplyMessage(m)) {
      return [];
    }
    const msg = m as {
      role?: string;
      content?: unknown;
      timestamp?: number;
      toolCallId?: string;
      toolName?: string;
      details?: { exitCode?: number; durationMs?: number; aggregated?: string };
      isError?: boolean;
    };

    const role =
      msg.role === "toolResult"
        ? ("toolResult" as const)
        : msg.role === "user"
        ? ("user" as const)
        : ("assistant" as const);

    const blocks: ContentBlock[] = [];

    if (role === "toolResult") {
      const text = (Array.isArray(msg.content) ? msg.content : [])
        .filter((b): b is Record<string, unknown> => isRecord(b))
        .filter((b) => b.type === "text")
        .map((b) => String(b.text ?? ""))
        .join("");
      blocks.push({
        type: "toolResult",
        toolName: (msg.toolName as string) ?? "tool",
        content: msg.details?.aggregated ?? text,
        exitCode: msg.details?.exitCode,
        durationMs: msg.details?.durationMs,
        isError: msg.isError,
      });
    } else {
      for (const block of Array.isArray(msg.content) ? msg.content : []) {
        if (!isRecord(block)) {
          continue;
        }
        switch (block.type) {
          case "text":
            if (block.text)
              blocks.push({ type: "text", text: String(block.text) });
            break;
          case "thinking":
            if (block.thinking)
              blocks.push({
                type: "thinking",
                thinking: String(block.thinking),
              });
            break;
          case "toolCall":
            blocks.push({
              type: "toolCall",
              id: (block.id as string) ?? "",
              name: (block.name as string) ?? "tool",
              arguments: (block.arguments as Record<string, unknown>) ?? {},
            });
            break;
          case "image": {
            const parsed = parseImageBlock(block);
            if (parsed) {
              blocks.push(parsed);
            }
            break;
          }
          case "image_url": {
            const parsed = parseImageUrlBlock(block);
            if (parsed) {
              blocks.push(parsed);
            }
            break;
          }
        }
      }
    }

    return [{ role, blocks, timestamp: msg.timestamp ?? 0 }];
  });
}

export function useChat(sessionKey: string) {
  const { client, connected, subscribe } = useGateway();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [rawMessages, setRawMessages] = useState<RawMessage[]>([]);
  const [stream, setStream] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueuedChatMessage[]>([]);
  const [sending, setSending] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const runIdRef = useRef<string | null>(null);
  const streamRef = useRef<string | null>(null);
  const streamStartedAtRef = useRef<number | null>(null);
  const queueRef = useRef<QueuedChatMessage[]>([]);
  const sendingRef = useRef(false);

  const setQueueState = useCallback(
    (updater: SetStateAction<QueuedChatMessage[]>) => {
      setQueue((prev) => {
        const next =
          typeof updater === "function"
            ? (updater as (value: QueuedChatMessage[]) => QueuedChatMessage[])(
                prev
              )
            : updater;
        queueRef.current = next;
        return next;
      });
    },
    []
  );

  const setSendingState = useCallback((value: boolean) => {
    sendingRef.current = value;
    setSending(value);
  }, []);

  const setActiveRunState = useCallback((value: string | null) => {
    runIdRef.current = value;
    setActiveRunId(value);
  }, []);

  function parseMessages(raw: Array<unknown>): ChatMessage[] {
    return raw.flatMap((m: unknown) => {
      if (
        !isRecord(m) ||
        isHiddenApprovalContinuation(m) ||
        isAssistantSilentReplyMessage(m)
      ) {
        return [];
      }
      const msg = m as {
        role?: string;
        content?: unknown;
        timestamp?: number;
      };
      const role =
        msg.role === "user" ? ("user" as const) : ("assistant" as const);
      return [
        {
          role,
          content: extractText(m),
          timestamp: msg.timestamp ?? 0,
        },
      ];
    });
  }

  const clearStreaming = useCallback(() => {
    clearSessionPending(sessionKey);
    streamRef.current = null;
    streamStartedAtRef.current = null;
    setActiveRunState(null);
    setStream(null);
  }, [sessionKey, setActiveRunState]);

  const rollbackOptimisticMessage = useCallback((localId: string) => {
    setRawMessages((prev) =>
      prev.filter((message) => message.localId !== localId)
    );
    setMessages((prev) =>
      prev.filter((message) => message.localId !== localId)
    );
  }, []);

  const applyHistory = useCallback(
    (raw: Array<unknown>) => {
      const parsedMessages = parseMessages(raw);
      const parsedRawMessages = parseRawMessages(raw);

      setMessages(parsedMessages);
      setRawMessages(parsedRawMessages);

      const streamStartedAt = streamStartedAtRef.current;
      if (
        streamStartedAt !== null &&
        parsedRawMessages.some(
          (message) =>
            message.role === "assistant" && message.timestamp >= streamStartedAt
        )
      ) {
        clearStreaming();
      }
    },
    [clearStreaming]
  );

  // Load history once when connected — uses cleanup flag to ignore stale responses
  useEffect(() => {
    if (!client || !connected) return;
    let stale = false;
    client
      .request<{ messages?: Array<unknown> }>("chat.history", {
        sessionKey,
        limit: 200,
      })
      .then((res) => {
        if (stale) return;
        applyHistory(res.messages ?? []);
      })
      .catch((err) => {
        if (stale) return;
        setError(String(err));
      })
      .finally(() => {
        if (!stale) setLoading(false);
      });
    return () => {
      stale = true;
    };
  }, [applyHistory, client, connected, sessionKey]);

  const appendAssistantMessage = useCallback(
    (message: unknown, fallbackText?: string) => {
      if (isAssistantSilentReplyMessage(message)) {
        return;
      }

      const parsed = parseRawMessage(message);
      const fallback = fallbackText?.trim() ?? "";
      const nextRaw =
        parsed?.role === "assistant"
          ? {
              ...parsed,
              timestamp: parsed.timestamp || Date.now(),
            }
          : buildAssistantTextMessage(fallback);

      if (!nextRaw) {
        return;
      }

      const nextText = extractText(message) || fallback;
      setRawMessages((prev) => [...prev, nextRaw]);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: nextText,
          timestamp: nextRaw.timestamp,
        },
      ]);
    },
    []
  );

  const sendImmediate = useCallback(
    async (
      text: string,
      attachments: PendingImageAttachment[]
    ): Promise<SendOutcome> => {
      if (!client || !connected) {
        return "ignored";
      }

      const trimmed = text.trim();
      const normalizedAttachments = normalizePendingAttachments(attachments);
      const serializedAttachments = serializeAttachments(normalizedAttachments);
      if (!trimmed && !serializedAttachments?.length) {
        return "ignored";
      }

      const now = Date.now();
      const localId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        {
          role: "user",
          content:
            trimmed ||
            `Image${normalizedAttachments.length > 1 ? "s" : ""} (${
              normalizedAttachments.length
            })`,
          timestamp: now,
          localId,
        },
      ]);
      setRawMessages((prev) => [
        ...prev,
        buildOptimisticUserMessage(
          trimmed,
          normalizedAttachments,
          now,
          localId
        ),
      ]);

      const runId = crypto.randomUUID();
      setActiveRunState(runId);
      streamRef.current = "";
      streamStartedAtRef.current = now;
      setStream("");
      setSendingState(true);
      setError(null);
      markSessionPending(sessionKey);

      try {
        await client.request("chat.send", {
          sessionKey,
          message: trimmed,
          deliver: false,
          idempotencyKey: runId,
          attachments: serializedAttachments,
        });
        return "sent";
      } catch (err) {
        clearStreaming();
        rollbackOptimisticMessage(localId);
        setError(String(err));
        return "error";
      } finally {
        setSendingState(false);
      }
    },
    [
      clearStreaming,
      client,
      connected,
      rollbackOptimisticMessage,
      sessionKey,
      setActiveRunState,
      setSendingState,
    ]
  );

  const flushNextQueuedMessage = useCallback(async () => {
    if (!client || !connected || sendingRef.current || runIdRef.current) {
      return;
    }

    const next = queueRef.current[0];
    if (!next) {
      return;
    }

    setQueueState((prev) => prev.slice(1));
    const outcome = await sendImmediate(next.text, next.attachments);
    if (outcome !== "sent") {
      setQueueState((prev) => [next, ...prev]);
    }
  }, [client, connected, sendImmediate, setQueueState]);

  // Subscribe to gateway chat events
  useEffect(() => {
    return subscribe((evt: EventFrame) => {
      if (evt.event !== "chat") return;
      const payload = evt.payload as ChatEventPayload;
      if (!payload || payload.sessionKey !== sessionKey) return;

      // If we know our runId, ignore events from other runs
      // but still surface their completed messages.
      const knownRunId = runIdRef.current;
      if (knownRunId && payload.runId && payload.runId !== knownRunId) {
        if (payload.state === "final") {
          appendAssistantMessage(payload.message);
          void flushNextQueuedMessage();
        }
        return;
      }

      switch (payload.state) {
        case "delta": {
          clearSessionPending(sessionKey);
          if (streamStartedAtRef.current === null) {
            streamStartedAtRef.current = Date.now();
          }
          const next = extractText(payload.message);
          if (typeof next === "string" && !isSilentReplyText(next)) {
            setStream((prev) => {
              const resolved =
                !prev || next.length >= prev.length ? next : prev;
              streamRef.current = resolved;
              return resolved;
            });
          }
          break;
        }
        case "final": {
          appendAssistantMessage(
            payload.message,
            streamRef.current ?? undefined
          );
          clearStreaming();
          void flushNextQueuedMessage();
          break;
        }
        case "aborted":
          appendAssistantMessage(
            payload.message,
            streamRef.current ?? undefined
          );
          clearStreaming();
          void flushNextQueuedMessage();
          break;
        case "error":
          clearStreaming();
          setError(payload.errorMessage ?? "chat error");
          void flushNextQueuedMessage();
          break;
      }
    });
  }, [
    appendAssistantMessage,
    clearStreaming,
    flushNextQueuedMessage,
    sessionKey,
    subscribe,
  ]);

  const sendMessage = useCallback(
    async (
      text: string,
      attachments: PendingImageAttachment[] = []
    ): Promise<SendOutcome> => {
      const normalizedAttachments = normalizePendingAttachments(attachments);
      if (!client || !connected) {
        return "ignored";
      }
      if (!text.trim() && normalizedAttachments.length === 0) {
        return "ignored";
      }

      if (sendingRef.current || runIdRef.current) {
        setQueueState((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            text: text.trim(),
            attachments: normalizedAttachments,
            createdAt: Date.now(),
          },
        ]);
        return "queued";
      }

      return sendImmediate(text, normalizedAttachments);
    },
    [client, connected, sendImmediate, setQueueState]
  );

  const abortRun = useCallback(async (): Promise<boolean> => {
    if (!client || !connected || runIdRef.current === null) {
      return false;
    }
    try {
      await client.request(
        "chat.abort",
        runIdRef.current
          ? { sessionKey, runId: runIdRef.current }
          : { sessionKey }
      );
      return true;
    } catch (err) {
      setError(String(err));
      return false;
    }
  }, [client, connected, sessionKey]);

  const removeQueuedMessage = useCallback(
    (id: string) => {
      setQueueState((prev) => prev.filter((message) => message.id !== id));
    },
    [setQueueState]
  );

  const isStreaming = stream !== null;
  const isBusy = sending || activeRunId !== null;
  const canAbort = activeRunId !== null;

  return {
    messages,
    rawMessages,
    stream,
    isBusy,
    isStreaming,
    loading,
    error,
    sendMessage,
    queue,
    canAbort,
    abortRun,
    removeQueuedMessage,
  };
}
